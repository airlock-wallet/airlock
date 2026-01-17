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
 * @property {string} encoded   - [Required] Final signed data (Hex String), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data
 */
class HarmonySigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    _toLong(val) {
        if (val === undefined || val === null) return Long.fromNumber(0);
        if (Long.isLong(val)) return val;
        return Long.fromValue(val);
    }

    /**
     * Convert number or Hex string to Big-Endian Buffer
     */
    _toBuffer(val) {
        if (!val) return Buffer.from([]);
        if (Buffer.isBuffer(val)) return val;
        if (typeof val === 'string') {
            const hex = val.startsWith('0x') ? val.slice(2) : val;
            // Ensure even length
            const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
            return Buffer.from(paddedHex, 'hex');
        }
        // Handle number to hex byte stream
        if (typeof val === 'number') {
            let hex = val.toString(16);
            if (hex.length % 2 !== 0) hex = '0' + hex;
            return Buffer.from(hex, 'hex');
        }
        return Buffer.from([]);
    }

    /**
     * General signing method
     * @param txData
     * @param coinType
     * @return {SignerResult}
     * @private
     */
    _signCommon(txData, coinType = this.core.CoinType.harmony) {
        const { AnySigner, HexCoding } = this.core;
        const Harmony = TW.Harmony.Proto;

        // 1. Build TransactionMessage
        const transaction = Harmony.TransactionMessage.create({
            nonce: this._toBuffer(txData.nonce),
            gasPrice: this._toBuffer(txData.gasPrice || "0x0"),
            gasLimit: this._toBuffer(txData.gasLimit || "0x5208"),
            toAddress: txData.toAddress,
            amount: this._toBuffer(txData.amount),
            fromShardId: this._toBuffer(txData.fromShardId || "0x0"),
            toShardId: this._toBuffer(txData.toShardId || "0x0")
        });

        // 2. Build SigningInput
        const input = Harmony.SigningInput.create({
            privateKey: HexCoding.decode(txData.privateKey),
            chainId: this._toBuffer(txData.chainId),
            transactionMessage: transaction
        });

        // Input verification
        const inputError = Harmony.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Harmony Input Verification Failed: ${inputError}`);
        }

        // 3. Sign
        const outputBytes = AnySigner.sign(Harmony.SigningInput.encode(input).finish(), coinType);
        const output = Harmony.SigningOutput.decode(outputBytes);

        // Output verification
        const outputVerifyError = Harmony.SigningOutput.verify(output);
        if (outputVerifyError) {
            throw new Error(`Harmony Output Verification Failed: ${outputVerifyError}`);
        }

        // Business logic error verification
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Harmony Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                v: HexCoding.encode(output.v),
                r: HexCoding.encode(output.r),
                s: HexCoding.encode(output.s),
                json: output.toJSON(),
            }
        };
    }

    /**
     * Sign Harmony transaction
     * @param {Object} txData
     * @param {string} txData.privateKey - Private key (Hex)
     * @param {string|number} txData.chainId - Chain ID
     * @param {string|number} txData.nonce - Nonce (Hex or number)
     * @param {string} txData.toAddress - Recipient address (one1...)
     * @param {string|number} txData.amount - Amount (Hex or number)
     * @param {string|number} [txData.gasPrice="0x0"] - Gas Price
     * @param {string|number} [txData.gasLimit="0x5208"] - Gas Limit
     * @param {string|number} [txData.fromShardId="0x0"] - Source Shard ID
     * @param {string|number} [txData.toShardId="0x0"] - Destination Shard ID
     * @param coinType
     */
    signTransfer(txData, coinType = this.core.CoinType.harmony) {
        return this._signCommon(txData, coinType);
    }
}

module.exports = HarmonySigner;