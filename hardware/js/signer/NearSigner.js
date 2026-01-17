/**
 * Copyright (C) 2026 Le Wang
 *
 * This file is part of Airlock.
 *
 * Airlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Airlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Airlock.  If not, see <https://www.gnu.org/licenses/>.
 */

const TrustWalletCoreModule = require('@trustwallet/wallet-core');
const { TW } = require('@trustwallet/wallet-core');
const Long = require('long');
const { Buffer } = require('buffer');

/**
 * Universal signing result
 * @typedef {Object} SignerResult
 * @property {string} encoded   - [Required] Final signed data (Base64 String), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data
 */
class NearSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * [Internal Tool] Convert decimal string amount to 16-byte Little Endian Buffer required by NEAR
     * @private
     */
    _decTo16ByteLittleEndian(decString) {
        let hex = BigInt(decString).toString(16);
        if (hex.length % 2 !== 0) hex = '0' + hex;
        let buf = Buffer.from(hex, 'hex').reverse(); // Convert to bytes then reverse to get Little Endian

        // Must pad to 16 bytes
        const finalBuf = Buffer.alloc(16, 0);
        buf.copy(finalBuf);
        return finalBuf;
    }

    /**
     * Smart amount parsing: supports 0x hexadecimal, decimal string or direct byte stream
     * @private
     */
    _parseAmountToBuffer(val) {
        if (Buffer.isBuffer(val)) return val;
        let dec = "0";
        if (typeof val === 'string' && val.startsWith('0x')) {
            dec = BigInt(val).toString();
        } else {
            dec = val.toString();
        }
        return this._decTo16ByteLittleEndian(dec);
    }

    /**
     * Core signing method - Strictly enforce validation
     * @param {Object} txData - Transaction data
     * @param {string} txData.privateKey - [Required] Private key (Hex or Base58)
     * @param {string} txData.signerId - [Required] Sender account ID (test.near)
     * @param {string} txData.receiverId - [Required] Receiver account ID (whatever.near)
     * @param {number|string} txData.nonce - [Required] Nonce
     * @param {string} txData.blockHash - [Required] Block hash (Base58 format)
     * @param {string|number} txData.amount - [Required] Deposit/Transfer amount (Human-readable decimal)
     * @param coinType - Coin type
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.near) {
        const { AnySigner, Base58, HexCoding } = this.core;
        const NEAR = TW.NEAR.Proto;

        // 1. Handle private key (NEAR often gives Base58, sometimes Hex)
        let privKeyBytes;
        if (txData.privateKey.length > 64) { // Simple check for Base58
            privKeyBytes = Base58.decodeNoCheck(txData.privateKey).slice(0, 32);
        } else {
            privKeyBytes = HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey);
        }

        // 2. Build Action
        const transferAction = NEAR.Transfer.create({
            deposit: this._parseAmountToBuffer(txData.amount)
        });

        const action = NEAR.Action.create({
            transfer: transferAction
        });

        // 3. Build SigningInput
        const input = NEAR.SigningInput.create({
            signerId: txData.signerId,
            nonce: Long.fromString(txData.nonce.toString(), true),
            receiverId: txData.receiverId,
            blockHash: Base58.decodeNoCheck(txData.blockHash),
            privateKey: privKeyBytes,
            actions: [action]
        });

        // Input verification
        const inputError = NEAR.SigningInput.verify(input);
        if (inputError) throw new Error(`NEAR Input Error: ${inputError}`);

        // 4. Execute signing
        const outputBytes = AnySigner.sign(NEAR.SigningInput.encode(input).finish(), coinType);
        const output = NEAR.SigningOutput.decode(outputBytes);

        // Output verification
        const outputVerifyError = NEAR.SigningOutput.verify(output);
        if (outputVerifyError) throw new Error(`NEAR Output Error: ${outputVerifyError}`);

        if (output.errorMessage || output.error) {
            throw new Error(`NEAR Logic Error: ${output.errorMessage || output.error}`);
        }

        return {
            encoded: Buffer.from(output.signedTransaction).toString('base64'),
            extend: {
                hash: output.hash ? HexCoding.encode(output.hash) : "",
                json: output.toJSON(),
            }
        };
    }
}

module.exports = NearSigner;