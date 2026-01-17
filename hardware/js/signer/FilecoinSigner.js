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
 * @property {string} encoded   - [Required] Final signed data (Hex/Base64/JSON), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data (e.g. txid, signature, rawTx etc.), for recording or debugging purposes only
 */
class FilecoinSigner {
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
     * Convert various types of values to Big Endian Buffer (for Filecoin value/gas)
     */
    _toBigIntBuffer(val) {
        if (!val) return Buffer.from([]);
        if (Buffer.isBuffer(val)) return val;

        // If Hex string (starts with 0x or pure Hex) - Treat as direct bytes
        // Note: Kotlin tests pass Hex byte stream, so need to support parsing Hex directly here
        if (typeof val === 'string') {
            if (val.startsWith('0x')) {
                return Buffer.from(val.slice(2), 'hex');
            }
            // Simple heuristic: If it contains non-numeric characters and is not Hex format, might need to error
            // But for flexibility, try to parse as BigInt (Decimal)
            // If strictly corresponding to Kotlin's toHexByteArray, caller should pass Buffer or 0x string
            try {
                // Try parsing as decimal BigInt
                const bigVal = BigInt(val);
                let hex = bigVal.toString(16);
                if (hex.length % 2 !== 0) hex = '0' + hex;
                return Buffer.from(hex, 'hex');
            } catch (e) {
                // If parsing fails, fallback to treat as Hex string (for pure Hex string like in Kotlin)
                return Buffer.from(val, 'hex');
            }
        }

        if (typeof val === 'number') {
            const bigVal = BigInt(val);
            let hex = bigVal.toString(16);
            if (hex.length % 2 !== 0) hex = '0' + hex;
            return Buffer.from(hex, 'hex');
        }

        return Buffer.from([]);
    }

    /**
     * Sign Filecoin transaction
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - Private key (Hex)
     * @param {string} txData.to - Recipient address
     * @param {number} txData.nonce - Nonce
     * @param {string|number|Buffer} txData.value - Amount (FIL/AttoFIL)
     * @param {number} txData.gasLimit - Gas Limit
     * @param {string|number|Buffer} txData.gasFeeCap - Gas Fee Cap
     * @param {string|number|Buffer} txData.gasPremium - Gas Premium
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.filecoin) {
        const { AnySigner, HexCoding } = this.core;
        const Filecoin = TW.Filecoin.Proto;

        // 1. Build SigningInput
        const input = Filecoin.SigningInput.create({
            privateKey: HexCoding.decode(txData.privateKey),
            to: txData.to,
            nonce: this._toLong(txData.nonce),
            value: this._toBigIntBuffer(txData.value),
            gasLimit: this._toLong(txData.gasLimit),
            gasFeeCap: this._toBigIntBuffer(txData.gasFeeCap),
            gasPremium: this._toBigIntBuffer(txData.gasPremium)
        });

        // Input Verification
        const inputError = Filecoin.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Filecoin Input Verification Failed: ${inputError}`);
        }

        // 2. Sign
        const outputBytes = AnySigner.sign(Filecoin.SigningInput.encode(input).finish(), coinType);
        const output = Filecoin.SigningOutput.decode(outputBytes);

        // Output Verification
        const outputError = Filecoin.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Filecoin Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Filecoin Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.json, // Filecoin returns JSON format
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = FilecoinSigner;