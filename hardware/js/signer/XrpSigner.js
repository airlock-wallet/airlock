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
class XrpSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    toLong(val) {
        if (val === undefined || val === null) return Long.fromNumber(0);
        if (Long.isLong(val)) return val;
        return Long.fromValue(val);
    }

    /**
     * Sign XRP Payment Transaction
     *
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - Hex Private Key
     * @param {string} txData.fromAddress - Sender rAddress
     * @param {number} txData.byteFee - Fee (Drops)
     * @param {number} txData.sequenceNumber - Account Sequence
     * @param {number} txData.lastLedgerSequence - Last Valid Ledger Sequence (TTL)
     * @param {number} txData.amount - Transfer Amount (Drops)
     * @param {string} txData.toAddress - Recipient rAddress
     * @param {number} [txData.memo] - (Optional) Destination Tag, required for transfers to exchanges
     * @return {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.xrp) {
        const { AnySigner, HexCoding } = this.core;
        const Ripple = TW.Ripple.Proto;

        // 1. Build Payment Operation
        const paymentObj = {
            amount: this.toLong(txData.amount),
            destination: txData.toAddress
        };

        // Must add Destination Tag if present (Critical for exchange deposits)
        if (txData.memo) {
            paymentObj.destinationTag = this.toLong(txData.memo);
        }

        // 2. Build SigningInput
        const input = Ripple.SigningInput.create({
            fee: this.toLong(txData.byteFee),
            sequence: txData.sequenceNumber,
            lastLedgerSequence: txData.lastLedgerSequence,
            account: txData.fromAddress,
            privateKey: HexCoding.decode(txData.privateKey),
            // Set operation type to Payment
            opPayment: Ripple.OperationPayment.create(paymentObj)
        });

        // Verify input
        const inputError = Ripple.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Ripple Input Verification Failed: ${inputError}`);
        }

        // 3. Encode and Sign
        const encodedInput = Ripple.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
        const output = Ripple.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Ripple.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Ripple Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Ripple Signing Logic Error: ${msg}`);
        }

        return {
            // Return Hex encoded transaction Blob (for broadcasting)
            encoded: HexCoding.encode(output.encoded),
            // XRP TXID is usually the hash of the encoded data, but the API will return the accurate one after broadcasting.
            // If WalletCore doesn't return hash field here, rely on broadcast result.
            // Some versions of WalletCore Output might contain hash, focusing on encoded here.
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = XrpSigner;