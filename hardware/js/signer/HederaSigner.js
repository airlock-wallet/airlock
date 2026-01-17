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
 * @property {string} encoded   - [Required] Final signed data (Hex/Base64/JSON), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data (e.g. txid, signature, rawTx etc.), for recording or debugging purposes only
 */
class HederaSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Internal utility: Convert to Long
     */
    _toLong(val) {
        if (val === undefined || val === null) return Long.fromNumber(0);
        if (Long.isLong(val)) return val;
        return Long.fromValue(val);
    }

    /**
     * Sign Hedera (HBAR) transfer transaction
     * @param {Object} txData - Transaction parameters
     * @param {string} txData.privateKey - Hex format private key
     * @param {string} txData.fromAddress - Sender account ID (e.g. "0.0.48694347")
     * @param {string} txData.toAddress - Recipient account ID (e.g. "0.0.48462050")
     * @param {string|number} txData.amount - Transfer amount (Tinybars, 1 HBAR = 10^8 Tinybars)
     * @param {string} [txData.nodeAccountID="0.0.3"] - Node account ID submitting the transaction
     * @param {string|number} [txData.maxFee=100000000] - Max willing fee (Tinybars)
     * @param {string} [txData.memo=""] - Transaction memo
     * @param {number} [txData.validDuration=120] - Transaction validity duration (seconds)
     * @param {Object} [txData.timestamp] - (Optional) Manually specify transaction start time (for testing fixed results)
     * @param {number} txData.timestamp.seconds - Seconds
     * @param {number} txData.timestamp.nanos - Nanoseconds
     * @param coinType - Coin type (Hedera=3030)
     * @returns {SignerResult} - Returns Hex encoded Signed Transaction
     */
    signTransfer(txData, coinType = this.core.CoinType.hedera) {
        const { AnySigner, HexCoding, PrivateKey } = this.core;
        const Hedera = TW.Hedera.Proto;

        // 1. Handle timestamp (Required by TransactionID)
        const now = txData.timestamp;
        const seconds = this._toLong(Math.floor(now / 1000) - 10);
        const nanos = (now % 1000) * 1000000;

        // 2. Build TransactionID
        const transactionID = Hedera.TransactionID.create({
            accountID: txData.fromAddress,
            transactionValidStart: Hedera.Timestamp.create({
                seconds: seconds,
                nanos: nanos
            })
        });

        // 3. Build TransferMessage (Simplified transfer structure)
        const transferMsg = Hedera.TransferMessage.create({
            from: txData.fromAddress,
            to: txData.toAddress,
            amount: this._toLong(txData.amount)
        });

        // 4. Build TransactionBody
        const body = Hedera.TransactionBody.create({
            transactionID: transactionID,
            nodeAccountID: txData.nodeAccountID || "0.0.3", // Default node 0.0.3
            transactionFee: this._toLong(txData.maxFee || 100000000), // Default 1 HBAR max fee
            transactionValidDuration: this._toLong(txData.validDuration || 120),
            memo: txData.memo || "",
            transfer: transferMsg // Set operation type as transfer
        });

        // 5. Build SigningInput
        // Note: Similar to TON, PrivateKey needs createWithData then .data() to ensure format
        const pkData = HexCoding.decode(txData.privateKey);
        const pkObj = PrivateKey.createWithData(pkData);

        const input = Hedera.SigningInput.create({
            privateKey: pkObj.data(),
            body: body
        });

        pkObj.delete(); // Clean up C++ object

        // Verify input
        const inputError = Hedera.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Hedera Input Verification Failed: ${inputError}`);
        }

        // 6. Sign
        const encodedInput = Hedera.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
        const output = Hedera.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Hedera.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Hedera Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Hedera Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = HederaSigner;