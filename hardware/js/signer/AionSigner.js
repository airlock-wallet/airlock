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
const { Buffer } = require('buffer');
const Long = require('long');

/**
 * Universal signing result
 * @typedef {Object} SignerResult
 * @property {string} encoded   - [Required] Final signed data (Hex/Base64/JSON), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data (e.g. txid, signature, rawTx etc.), for recording or debugging purposes only
 */
class AionSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Convert to Long (for uint64 timestamp)
     */
    _toLong(val) {
        if (val === undefined || val === null) return Long.fromNumber(0);
        if (Long.isLong(val)) return val;
        return Long.fromValue(val);
    }

    /**
     * Convert to Buffer (for bytes type amount/nonce/gas)
     * Supports Hex string, decimal string, number
     */
    _toBuffer(val) {
        if (!val) return Buffer.from([]);
        if (Buffer.isBuffer(val)) return val;

        let hex = '';
        if (typeof val === 'number') {
            hex = BigInt(val).toString(16);
        } else if (typeof val === 'string') {
            if (val.startsWith('0x')) {
                hex = val.slice(2);
            } else {
                // If pure numeric string, treat as decimal
                if (/^\d+$/.test(val)) {
                    hex = BigInt(val).toString(16);
                } else {
                    // Otherwise assume Hex
                    hex = val;
                }
            }
        }
        if (hex.length % 2 !== 0) hex = '0' + hex;
        return Buffer.from(hex, 'hex');
    }

    /**
     * Get wallet address
     * @param privateKeyHex
     * @return {string}
     */
    getAddress(privateKeyHex) {
        const { PrivateKey, AnyAddress, CoinType, HexCoding } = this.core;
        const pk = PrivateKey.createWithData(HexCoding.decode(privateKeyHex));
        // Note: Aion uses Ed25519
        const pubKey = pk.getPublicKeyEd25519();
        const address = AnyAddress.createWithPublicKey(pubKey, CoinType.aion);
        return address.description();
    }

    /**
     * Sign Aion transaction
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - Hex private key
     * @param {string} txData.toAddress - Recipient
     * @param {string|number} txData.amount - Amount
     * @param {string|number} txData.nonce - Nonce
     * @param {string|number} txData.gasPrice - Gas Price
     * @param {string|number} txData.gasLimit - Gas Limit
     * @param {string|number} txData.timestamp - Timestamp (milliseconds)
     * @returns {Object} { encoded: string, extend: Object }
     */
    signTransfer(txData, coinType = this.core.CoinType.aion) {
        const { AnySigner, HexCoding } = this.core;
        const Aion = TW.Aion.Proto;

        const input = Aion.SigningInput.create({
            toAddress: txData.toAddress,
            privateKey: HexCoding.decode(txData.privateKey),
            // Note: These fields are bytes in Proto definition
            nonce: this._toBuffer(txData.nonce),
            gasPrice: this._toBuffer(txData.gasPrice),
            gasLimit: this._toBuffer(txData.gasLimit),
            amount: this._toBuffer(txData.amount),
            // timestamp is uint64
            timestamp: this._toLong(txData.timestamp)
        });

        // Verify input
        const inputError = Aion.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Aion Input Verification Failed: ${inputError}`);
        }

        const encodedInput = Aion.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
        const output = Aion.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Aion.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Aion Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Aion Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded), // For broadcasting
            extend: {
                signature: HexCoding.encode(output.signature),
                json: output.toJSON()
            }
        };
    }
}

module.exports = AionSigner;