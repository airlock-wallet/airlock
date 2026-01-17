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
 * @property {string} encoded   - [Required] Final signed data (JSON String), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data
 */
class NanoSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Smart amount conversion: Supports 0x hexadecimal or human-readable decimal strings
     * @private
     */
    _parseAmount(val) {
        if (!val) return "0";
        if (typeof val === 'string' && val.startsWith('0x')) {
            return BigInt(val).toString();
        }
        return val.toString();
    }

    /**
     * Core signing method - Strictly enforce validation
     * @param {Object} txData - Transaction data
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {string} txData.linkBlock - [Required] Link block (Hex, recipient public key hash for send, source block hash for receive)
     * @param {string} txData.representative - [Required] Representative address (xrb_... or nano_...)
     * @param {string|number} txData.balance - [Required] Account balance after transaction (Decimal string, unit Raw)
     * @param {string} [txData.previous] - [Optional] Hash of the previous block (Hex)
     * @param coinType - Coin type
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.nano) {
        const { AnySigner, HexCoding } = this.core;
        const Nano = TW.Nano.Proto;

        // 1. Build SigningInput
        const input = Nano.SigningInput.create({
            privateKey: HexCoding.decode(txData.privateKey),
            representative: txData.representative,
            balance: this._parseAmount(txData.balance),
            linkBlock: HexCoding.decode(txData.linkBlock),
            previous: txData.previous ? HexCoding.decode(txData.previous) : Buffer.from([])
        });

        // Input verification
        const inputError = Nano.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Nano Input Verification Failed: ${inputError}`);
        }

        // 2. Sign
        const outputBytes = AnySigner.sign(Nano.SigningInput.encode(input).finish(), coinType);
        const output = Nano.SigningOutput.decode(outputBytes);

        // Output verification
        const outputVerifyError = Nano.SigningOutput.verify(output);
        if (outputVerifyError) {
            throw new Error(`Nano Output Verification Failed: ${outputVerifyError}`);
        }

        // Business logic error verification
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Nano Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.signature),
            extend: {
                blockHash: HexCoding.encode(output.blockHash),
                json: output.toJSON(),
            }
        };
    }
}

module.exports = NanoSigner;