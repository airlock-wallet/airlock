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
 * @property {string} encoded   - [Required] Final signed data (JSON String), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data
 */
class EosSigner {
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
        let hex = '';
        if (typeof val === 'string') {
            hex = val.startsWith('0x') ? val.slice(2) : val;
        }
        return Buffer.from(hex, 'hex');
    }

    /**
     * Sign EOS transaction
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.chainId - Chain ID (Hex)
     * @param {string} txData.referenceBlockId - Reference Block ID (Hex)
     * @param {number} txData.referenceBlockTime - Reference Block Time (Unix seconds)
     * @param {string} txData.currency - Token contract account name (e.g. "token")
     * @param {string} txData.sender - Sender account name
     * @param {string} txData.recipient - Recipient account name
     * @param {string} txData.memo - Memo
     * @param {string} txData.privateKey - Private key (Hex)
     * @param {Object} txData.asset - Asset object
     * @param {number|string} txData.asset.amount - Amount
     * @param {number} txData.asset.decimals - Decimals
     * @param {string} txData.asset.symbol - Symbol (e.g. "TKN")
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.eos) {
        const { AnySigner, HexCoding } = this.core;
        const EOS = TW.EOS.Proto;

        // 1. Build Asset
        const asset = EOS.Asset.create({
            amount: this._toLong(txData.asset.amount),
            decimals: txData.asset.decimals,
            symbol: txData.asset.symbol
        });

        // 2. Build SigningInput
        // Note: Strictly corresponds to privateKeyType = EOS.KeyType.MODERNK1 in Kotlin
        const input = EOS.SigningInput.create({
            chainId: this._toBuffer(txData.chainId),
            referenceBlockId: this._toBuffer(txData.referenceBlockId),
            referenceBlockTime: txData.referenceBlockTime,
            currency: txData.currency,
            sender: txData.sender,
            recipient: txData.recipient,
            memo: txData.memo,
            asset: asset,
            privateKey: HexCoding.decode(txData.privateKey),
            // Key: Set key type to MODERNK1 (value 1)
            privateKeyType: EOS.KeyType.MODERNK1
        });

        // Verify input
        const inputError = EOS.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`EOS Input Verification Failed: ${inputError}`);
        }

        // 3. Sign
        const outputBytes = AnySigner.sign(EOS.SigningInput.encode(input).finish(), coinType);
        const output = EOS.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = EOS.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`EOS Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`EOS Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.jsonEncoded, // EOS usually returns Payload in JSON format directly
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = EosSigner;