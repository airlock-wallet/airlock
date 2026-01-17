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
 * @property {string} encoded   - [Required] Final signed data (JSON String), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data
 */
class KavaSigner {
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
     * Core signing method - Strictly enforce validation
     * @param {Object} txData - Transaction basic data
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {string} txData.chainId - [Required] Chain ID (e.g. "kava-2")
     * @param {number|string} txData.accountNumber - [Required] Account number
     * @param {number|string} txData.sequence - [Required] Sequence number
     * @param {Object} txData.fee - [Required] Fee object {gas: 200000, amounts: [{amount: "100", denom: "ukava"}]}
     * @param {Array} txData.messages - [Required] Message array (can be RawJSON or standard Send)
     * @param {string} [txData.memo=""] - Memo
     * @param {Object} [coinType=this.core.CoinType.kava] - Coin type
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.kava) {
        const { AnySigner, HexCoding } = this.core;
        const Cosmos = TW.Cosmos.Proto;

        // 1. Build Fee
        const fee = Cosmos.Fee.create({
            gas: this._toLong(txData.fee.gas),
            amounts: (txData.fee.amounts || []).map(a => Cosmos.Amount.create({
                amount: a.amount,
                denom: a.denom
            }))
        });

        // 2. Build Messages
        const messages = (txData.messages || []).map(m => {
            const msg = {};
            if (m.rawJson) {
                msg.rawJsonMessage = Cosmos.Message.RawJSON.create({
                    type: m.rawJson.type,
                    value: m.rawJson.value
                });
            } else if (m.sendCoinsMessage) {
                // Can extend here if it's standard transfer logic
                msg.sendCoinsMessage = m.sendCoinsMessage;
            }
            return Cosmos.Message.create(msg);
        });

        // 3. Build SigningInput
        const input = Cosmos.SigningInput.create({
            accountNumber: this._toLong(txData.accountNumber),
            chainId: txData.chainId,
            sequence: this._toLong(txData.sequence),
            memo: txData.memo || "",
            privateKey: HexCoding.decode(txData.privateKey),
            fee: fee,
            messages: messages
        });

        // Input verification
        const inputError = Cosmos.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Kava Input Verification Failed: ${inputError}`);
        }

        // 4. Sign
        const outputBytes = AnySigner.sign(Cosmos.SigningInput.encode(input).finish(), coinType);
        const output = Cosmos.SigningOutput.decode(outputBytes);

        // Output verification
        const outputVerifyError = Cosmos.SigningOutput.verify(output);
        if (outputVerifyError) {
            throw new Error(`Kava Output Verification Failed: ${outputVerifyError}`);
        }

        // Business logic error verification
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Kava Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.json, // Cosmos returns JSON for broadcasting
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = KavaSigner;