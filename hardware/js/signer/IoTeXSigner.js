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
 * @property {string} encoded   - [Required] Final signed data (Hex String)
 * @property {Object} [extend]  - [Optional] Extended data
 */
class IoTeXSigner {
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

    _toBuffer(val) {
        if (!val) return Buffer.from([]);
        if (Buffer.isBuffer(val)) return val;
        if (typeof val === 'string') {
            const hex = val.startsWith('0x') ? val.slice(2) : val;
            return Buffer.from(hex, 'hex');
        }
        return Buffer.from([]);
    }

    /**
     * Core signing method - Strictly enforce validation
     * @param {Object} txData - Transaction data object
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {number|string} txData.nonce - [Required] Account Nonce
     * @param {number|string} [txData.version=1] - Protocol version
     * @param {number|string} [txData.gasLimit=20000] - Gas Limit
     * @param {string} [txData.gasPrice="1000000000000"] - Gas Price (Unit: RAU)
     * @param {Object} txData.action - [Required] Specific Action message body (e.g. {transfer: ...} or {stakeCreate: ...})
     * @param {Object} [coinType=this.core.CoinType.ioTeX] - Coin type
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.ioTeX) {
        const { AnySigner, HexCoding } = this.core;
        const IoTeX = TW.IoTeX.Proto;

        // 1. Build SigningInput
        // Dynamic injection of txData.action is used here to ensure capability to handle all IoTeX Action types
        const input = IoTeX.SigningInput.create({
            version: txData.version || 1,
            nonce: this._toLong(txData.nonce || 0),
            gasLimit: this._toLong(txData.gasLimit || 20000),
            gasPrice: txData.gasPrice,
            privateKey: HexCoding.decode(txData.privateKey),
            // Dynamically inject action (transfer, stakeCreate, etc.)
            ...txData.action
        });

        // Input verification
        const inputError = IoTeX.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`IoTeX Input Verification Failed: ${inputError}`);
        }

        // 2. Sign
        const outputBytes = AnySigner.sign(IoTeX.SigningInput.encode(input).finish(), coinType);
        const output = IoTeX.SigningOutput.decode(outputBytes);

        // Output verification
        const outputVerifyError = IoTeX.SigningOutput.verify(output);
        if (outputVerifyError) {
            throw new Error(`IoTeX Output Verification Failed: ${outputVerifyError}`);
        }

        // Business logic error verification
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`IoTeX Signing Logic Error: ${msg}`);
        }

        return {
            encoded:  HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = IoTeXSigner;