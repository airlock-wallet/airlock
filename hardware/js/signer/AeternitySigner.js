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

/**
 * Universal signing result
 * @typedef {Object} SignerResult
 * @property {string} encoded   - [Required] Final signed data (Hex/Base64/JSON), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data (e.g. txid, signature, rawTx etc.), for recording or debugging purposes only
 */
class AeternitySigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Convert value to Buffer (Big Endian)
     * @param val "10" (decimal string) | 10 (number) | "0x0a" (Hex string)
     * @returns {*}
     * @private
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
                // Try to parse as decimal, if it contains non-numeric characters assume it's Hex (Kotlin use case passes pure Hex)
                if (/^\d+$/.test(val)) {
                    hex = BigInt(val).toString(16);
                } else {
                    hex = val; // Assume Raw Hex
                }
            }
        }

        // Pad to even length
        if (hex.length % 2 !== 0) hex = '0' + hex;
        return Buffer.from(hex, 'hex');
    }

    /**
     * Sign Aeternity transaction
     * * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - Hex private key
     * @param {string} txData.fromAddress - Sender (ak_...)
     * @param {string} txData.toAddress - Recipient (ak_...)
     * @param {string|number} txData.amount - Amount (aettos, 1 AE = 10^18 aettos)
     * @param {string|number} txData.fee - Fee
     * @param {string} [txData.payload=""] - Transaction payload/note
     * @param {number} txData.ttl - Time to Live (block height)
     * @param {number} txData.nonce - Transaction Nonce
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.aeternity){
        const { AnySigner, HexCoding } = this.core;
        const Aeternity = TW.Aeternity.Proto;

        // 1. Build SigningInput
        const input = Aeternity.SigningInput.create({
            fromAddress: txData.fromAddress,
            toAddress: txData.toAddress,
            amount: this._toBuffer(txData.amount),
            fee: this._toBuffer(txData.fee),
            payload: txData.payload || "",
            ttl: txData.ttl,
            nonce: txData.nonce,
            privateKey: HexCoding.decode(txData.privateKey)
        });

        // Verify input
        const inputError = Aeternity.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Aeternity Input Verification Failed: ${inputError}`);
        }

        // 2. Encode and Sign
        const encodedInput = Aeternity.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
        const output = Aeternity.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Aeternity.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Aeternity Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Aeternity Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.encoded,   // String with tx_ prefix
            extend: {
                signature: output.signature, // String with sg_ prefix
                json: output.toJSON()
            }
        };
    }
}

module.exports = AeternitySigner;