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
const {TW} = require('@trustwallet/wallet-core');
const Long = require('long');

/**
 * Universal signing result
 * @typedef {Object} SignerResult
 * @property {string} encoded   - [Required] Final signed data (Hex/Base64/JSON), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data (e.g. txid, signature, rawTx etc.), for recording or debugging purposes only
 */
class EverscaleSigner {
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
     * Sign Everscale transaction
     * @param {Object} txData
     * @param coinType
     * @param {boolean} [txData.bounce=false] - Whether to bounce (Bounce)
     * @param {string|number} txData.amount - Transfer amount (nanotons)
     * @param {number} txData.expiredAt - Expiration timestamp (Unix seconds)
     * @param {string} txData.to - Recipient address
     * @param {string} txData.encodedContractData - Encoded contract data (Base64)
     * @param {string} txData.privateKey - Private key (Hex)
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.everscale) {
        const {AnySigner, HexCoding} = this.core;
        const Everscale = TW.Everscale.Proto;

        // 1. Build Transfer message
        const transferMessage = Everscale.Transfer.create({
            bounce: txData.bounce || false,
            behavior: Everscale.MessageBehavior.SimpleTransfer, // Default is SimpleTransfer
            amount: this._toLong(txData.amount),
            expiredAt: txData.expiredAt,
            to: txData.to,
            encodedContractData: txData.encodedContractData // Pass Base64 string directly
        });

        // 2. Build SigningInput
        const input = Everscale.SigningInput.create({
            transfer: transferMessage,
            privateKey: HexCoding.decode(txData.privateKey)
        });

        // Verify input
        const inputError = Everscale.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Everscale Input Verification Failed: ${inputError}`);
        }

        // 4. Sign
        const encodedInput = Everscale.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
        const output = Everscale.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Everscale.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Everscale Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Everscale Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.encoded, // Everscale returns Base64 string
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = EverscaleSigner;