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
class WavesSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Scenario 1: Waves Standard Transfer Signing (Includes Native and Asset Transfer)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - [Required] Private Key (Hex)
     * @param {string} txData.toAddress  - [Required] Recipient address (3P...)
     * @param {string} txData.amount     - [Required] Decimal amount string
     * @param {string} txData.asset      - [Required] Asset ID (Pass empty string for Native WAVES)
     * @param {string} txData.fee        - [Required] Decimal fee string
     * @param {string} txData.feeAsset   - [Required] Fee Asset ID (Usually same as Asset ID)
     * @param {number} txData.timestamp  - [Required] Timestamp in milliseconds (or seconds for testing)
     * @param {string} [txData.attachment] - [Optional] Attachment info (Hex String, e.g., "68656c6c6f")
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.waves) {
        const { AnySigner, HexCoding } = this.core;
        const WavesProto = TW.Waves.Proto;

        const pkData = HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey);

        // 1. Build transfer message (Amount is always decimal)
        const transferMsg = WavesProto.TransferMessage.create({
            amount: Long.fromString(String(txData.amount)),
            asset: txData.asset,
            fee: Long.fromString(String(txData.fee)),
            feeAsset: txData.feeAsset,
            to: txData.toAddress,
        });

        // Only inject attachment if explicitly provided
        if (txData.attachment && txData.attachment.length > 0) {
            transferMsg.attachment = HexCoding.decode(txData.attachment);
        }

        // 2. Build SigningInput
        const input = WavesProto.SigningInput.create({
            timestamp: Long.fromValue(txData.timestamp),
            privateKey: pkData,
            transferMessage: transferMsg
        });

        // --- Enforce Input Verification ---
        if (WavesProto.SigningInput.verify(input)) throw new Error("Waves Input Verification Failed");

        // 3. Execute Signing
        const inputEncoded = WavesProto.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(inputEncoded, coinType);
        const output = WavesProto.SigningOutput.decode(outputBytes);

        // --- Enforce Output Verification ---
        const outputError = WavesProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Waves Output Verification Failed: ${outputError}`);
        }
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Waves Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.signature),
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = WavesSigner;