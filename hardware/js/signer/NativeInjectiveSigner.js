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
class NativeInjectiveSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Smart parsing: supports 0x hexadecimal and decimal strings
     * @private
     */
    _parseAmount(val) {
        if (!val) return "0";
        if (typeof val === 'string' && val.startsWith('0x')) {
            return BigInt(val).toString();
        }
        return val.toString();
    }

    _toLong(val) {
        if (val === undefined || val === null) return Long.fromNumber(0);
        if (Long.isLong(val)) return val;
        return Long.fromValue(val);
    }

    /**
     * Core signing method - Strictly enforce validation
     * @param {Object} txData - Transaction data
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {string} txData.chainId - [Required] Chain ID (e.g., "injective-1")
     * @param {number|string} txData.accountNumber - [Required] Account number
     * @param {number|string} txData.sequence - [Required] Sequence number
     * @param {string} txData.fromAddress - [Required] Sender address (inj1...)
     * @param {string} txData.toAddress - [Required] Recipient address (inj1...)
     * @param {string|number} txData.amount - [Required] Transfer amount (decimal or 0x)
     * @param {string} txData.denom - [Required] Currency unit (e.g., "inj")
     * @param {Object} txData.fee - [Required] Fee object {gas: 110000, amount: "100000000000000", denom: "inj"}
     * @param {string} [txData.memo=""] - Memo
     * @param coinType - Coin type
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.nativeInjective) {
        const { AnySigner, HexCoding } = this.core;
        const Cosmos = TW.Cosmos.Proto;

        // 1. Build Message (SendCoins)
        const message = Cosmos.Message.create({
            sendCoinsMessage: Cosmos.Message.Send.create({
                fromAddress: txData.fromAddress,
                toAddress: txData.toAddress,
                amounts: [Cosmos.Amount.create({
                    amount: this._parseAmount(txData.amount),
                    denom: txData.denom
                })]
            })
        });

        // 2. Build Fee
        const fee = Cosmos.Fee.create({
            gas: this._toLong(txData.fee.gas),
            amounts: [Cosmos.Amount.create({
                amount: this._parseAmount(txData.fee.amount),
                denom: txData.fee.denom
            })]
        });

        // 3. Build SigningInput
        const input = Cosmos.SigningInput.create({
            signingMode: Cosmos.SigningMode.Protobuf, // Must enforce correspondence to Kotlin's Protobuf mode
            accountNumber: this._toLong(txData.accountNumber),
            chainId: txData.chainId,
            sequence: this._toLong(txData.sequence),
            memo: txData.memo || "",
            privateKey: HexCoding.decode(txData.privateKey),
            fee: fee,
            messages: [message]
        });

        // Input verification
        const inputError = Cosmos.SigningInput.verify(input);
        if (inputError) throw new Error(`Injective Input Error: ${inputError}`);

        // 4. Sign
        const outputBytes = AnySigner.sign(Cosmos.SigningInput.encode(input).finish(), coinType);
        const output = Cosmos.SigningOutput.decode(outputBytes);

        // Output verification
        const outputVerifyError = Cosmos.SigningOutput.verify(output);
        if (outputVerifyError) throw new Error(`Injective Output Error: ${outputVerifyError}`);

        // Business logic error
        if (output.errorMessage || output.error) {
            throw new Error(`Injective Signing Logic Error: ${output.errorMessage || output.error}`);
        }

        return {
            encoded: output.serialized, // Corresponds to Kotlin's output.serialized
            extend: {
                signature: output.signature ? HexCoding.encode(output.signature) : "",
                json: output.toJSON(),
            }
        };
    }
}

module.exports = NativeInjectiveSigner;