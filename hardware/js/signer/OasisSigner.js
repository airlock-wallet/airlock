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

/**
 * Universal signing result
 * @typedef {Object} SignerResult
 * @property {string} encoded   - [Required] Final signed data (Hex String)
 * @property {Object} [extend]  - [Optional] Extended data
 */
class OasisSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Core signing method
     * @param {Object} txData - Transaction data object
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {Object} txData.transfer   - [Required] Transfer message body
     * @param {string} txData.transfer.to        - Recipient address
     * @param {number} txData.transfer.gasPrice - Gas Price
     * @param {string} txData.transfer.gasAmount - Gas Amount (String)
     * @param {number} txData.transfer.nonce    - Nonce
     * @param {string} txData.transfer.amount   - Transfer Amount (String)
     * @param {string} txData.transfer.context  - Chain Context
     * @param coinType - Coin type
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.oasis) {
        const { AnySigner, HexCoding } = this.core;
        const OasisProto = TW.Oasis.Proto;

        // 1. Build TransferMessage
        const transferMessage = OasisProto.TransferMessage.create({
            to: txData.transfer.to,
            gasPrice: Long.fromValue(txData.transfer.gasPrice),
            gasAmount: txData.transfer.gasAmount,
            nonce: Long.fromValue(txData.transfer.nonce),
            amount: txData.transfer.amount,
            context: txData.transfer.context
        });

        // 2. Build SigningInput
        const input = OasisProto.SigningInput.create({
            privateKey: HexCoding.decode(txData.privateKey),
            transfer: transferMessage
        });

        // Input verification
        const inputError = OasisProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Oasis Input Verification Failed: ${inputError}`);
        }

        // 3. Execute signing
        const inputEncoded = OasisProto.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(inputEncoded, coinType);
        const output = OasisProto.SigningOutput.decode(outputBytes);

        // Output verification
        const outputError = OasisProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Oasis Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Oasis Signing Logic Error: ${msg}`);
        }

        // 4. Format output (According to Kotlin test cases, needs 0x prefix)
        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = OasisSigner;