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
 * @property {string} encoded   - [Required] Final signed data (Base64 String), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data
 */
class NebulasSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Convert value (decimal or hexadecimal) to Big-endian bytes required by Nebulas
     * @private
     */
    _toBigEndianBuffer(val) {
        if (!val) return Buffer.from([]);
        let hex = "";
        if (typeof val === 'string' && val.startsWith('0x')) {
            hex = val.slice(2);
        } else {
            hex = BigInt(val).toString(16);
        }
        // Pad to even length
        if (hex.length % 2 !== 0) hex = '0' + hex;
        return Buffer.from(hex, 'hex');
    }

    /**
     * Core signing method - Strictly enforce validation
     * @param {Object} txData - Transaction data
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {string} txData.fromAddress - [Required] Sender address (n1...)
     * @param {string} txData.toAddress - [Required] Recipient address (n1...)
     * @param {string|number} txData.amount - [Required] Amount (decimal or 0x)
     * @param {string|number} txData.nonce - [Required] Nonce
     * @param {string|number} [txData.chainId=1] - Chain ID
     * @param {string|number} [txData.gasPrice=1000000] - Gas Price
     * @param {string|number} [txData.gasLimit=200000] - Gas Limit
     * @param {string|number} [txData.timestamp] - Timestamp (milliseconds)
     * @param {string} [txData.payload=""] - Extra data
     * @param coinType - Coin type
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.nebulas) {
        const { AnySigner, HexCoding } = this.core;
        const Nebulas = TW.Nebulas.Proto;

        // 1. Build SigningInput
        // Nebulas requires all numbers to be converted to bytes
        const input = Nebulas.SigningInput.create({
            fromAddress: txData.fromAddress,
            toAddress: txData.toAddress,
            chainId: this._toBigEndianBuffer(txData.chainId || "1"),
            nonce: this._toBigEndianBuffer(txData.nonce),
            gasPrice: this._toBigEndianBuffer(txData.gasPrice || "1000000"),
            gasLimit: this._toBigEndianBuffer(txData.gasLimit || "200000"),
            amount: this._toBigEndianBuffer(txData.amount),
            timestamp: this._toBigEndianBuffer(Math.floor(txData.timestamp / 1000).toString()),
            payload: txData.payload || "",
            privateKey: HexCoding.decode(txData.privateKey)
        });

        // Input verification
        const inputError = Nebulas.SigningInput.verify(input);
        if (inputError) throw new Error(`Nebulas Input Error: ${inputError}`);

        // 2. Execute signing
        const outputBytes = AnySigner.sign(Nebulas.SigningInput.encode(input).finish(), coinType);
        const output = Nebulas.SigningOutput.decode(outputBytes);

        // Output verification
        const outputVerifyError = Nebulas.SigningOutput.verify(output);
        if (outputVerifyError) throw new Error(`Nebulas Output Error: ${outputVerifyError}`);

        if (output.errorMessage || output.error) {
            throw new Error(`Nebulas Signing Logic Error: ${output.errorMessage || output.error}`);
        }

        return {
            encoded: output.raw,
            extend: {
                signature: HexCoding.encode(output.signature),
                algorithm: output.algorithm,
                json: output.toJSON(),
            }
        };
    }
}

module.exports = NebulasSigner;