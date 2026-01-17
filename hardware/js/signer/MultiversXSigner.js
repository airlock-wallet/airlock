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
class MultiversXSigner {
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
     * Smart amount conversion: Automatically handles 0x hexadecimal or human-readable decimal strings
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
     * @param {Object} txData - Basic transaction data
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {string} txData.chainId - [Required] Chain ID (Mainnet is "1")
     * @param {number|string} [txData.gasPrice=1000000000] - Gas Price
     * @param {number|string} [txData.gasLimit=50000] - Gas Limit
     * @param {Object} actionBuilder - [Required] Dynamically injected Action (e.g. {egldTransfer: ...})
     * @param coinType - Coin type
     * @returns {SignerResult}
     */
    _signCommon(txData, actionBuilder, coinType = this.core.CoinType.multiversX) {
        const { AnySigner, HexCoding } = this.core;
        const MultiversX = TW.MultiversX.Proto;

        const input = MultiversX.SigningInput.create({
            privateKey: HexCoding.decode(txData.privateKey),
            chainId: txData.chainId || "1",
            gasPrice: this._toLong(txData.gasPrice || 1000000000),
            gasLimit: this._toLong(txData.gasLimit || 50000),
            ...actionBuilder
        });

        // Input verification
        const inputError = MultiversX.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`MultiversX Input Verification Failed: ${inputError}`);
        }

        const outputBytes = AnySigner.sign(MultiversX.SigningInput.encode(input).finish(), coinType);
        const output = MultiversX.SigningOutput.decode(outputBytes);

        // Output verification
        const outputVerifyError = MultiversX.SigningOutput.verify(output);
        if (outputVerifyError) {
            throw new Error(`MultiversX Output Verification Failed: ${outputVerifyError}`);
        }

        // Business logic error
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`MultiversX Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.encoded,
            extend: {
                signature: output.signature,
                json: output.toJSON(),
            }
        };
    }

    /**
     * Sign EGLD Transfer (Native Token)
     * @param {Object} txData - Basic transaction data
     * @param coinType
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {string} txData.chainId - [Required] Chain ID (Mainnet is "1")
     * @param {number|string} [txData.gasPrice=1000000000] - Gas Price
     * @param {number|string} [txData.gasLimit=50000] - Gas Limit
     * @param {number|string} txData.nonce - Nonce
     * @param {string|number} txData.amount - Human-readable amount (Decimal or 0x)
     */
    signEGLDTransfer(txData, coinType = this.core.CoinType.multiversX) {
        const MultiversX = TW.MultiversX.Proto;
        return this._signCommon(txData, {
            egldTransfer: MultiversX.EGLDTransfer.create({
                accounts: MultiversX.Accounts.create({
                    senderNonce: this._toLong(txData.nonce),
                    sender: txData.sender,
                    receiver: txData.receiver
                }),
                amount: this._parseAmount(txData.amount)
            })
        }, coinType);
    }

    /**
     * Sign ESDT Token Transfer (Custom Token)
     * @param {Object} txData - Basic transaction data
     * @param coinType
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {string} txData.chainId - [Required] Chain ID (Mainnet is "1")
     * @param {number|string} [txData.gasPrice=1000000000] - Gas Price
     * @param {number|string} [txData.gasLimit=50000] - Gas Limit
     */
    signESDTTransfer(txData, coinType = this.core.CoinType.multiversX) {
        const MultiversX = TW.MultiversX.Proto;
        return this._signCommon(txData, {
            esdtTransfer: MultiversX.ESDTTransfer.create({
                accounts: MultiversX.Accounts.create({
                    senderNonce: this._toLong(txData.nonce),
                    sender: txData.sender,
                    receiver: txData.receiver
                }),
                tokenIdentifier: txData.tokenIdentifier,
                amount: this._parseAmount(txData.amount)
            })
        }, coinType);
    }
}

module.exports = MultiversXSigner;