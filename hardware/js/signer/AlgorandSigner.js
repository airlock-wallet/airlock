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
const { Buffer } = require('buffer');
const Long = require('long');

/**
 * Universal signing result
 * @typedef {Object} SignerResult
 * @property {string} encoded   - [Required] Final signed data (Hex/Base64/JSON), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data (e.g. txid, signature, rawTx etc.), for recording or debugging purposes only
 */
class AlgorandSigner {
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
     * Smart Buffer conversion
     * Supports: Hex String, Base64 String (auto-detect), Buffer
     */
    _toBuffer(val) {
        if (!val) return Buffer.from([]);
        if (Buffer.isBuffer(val)) return val;
        if (typeof val !== 'string') return Buffer.from([]);

        // Simple heuristic detection: if it contains non-Hex characters (like +, /, =), or has Base64 length characteristics, and is not Hex characteristics
        // Algorand GenesisHash Base64 is usually 44 characters, Hex is 64 characters
        // To be safe, we assume if it is 64 characters and pure hex, parse as hex; otherwise try base64
        const isHex = /^[0-9a-fA-F]+$/.test(val);
        if (isHex && val.length % 2 === 0) {
            return Buffer.from(val, 'hex');
        } else {
            // Default fallback to Base64
            return Buffer.from(val, 'base64');
        }
    }

    /**
     * Sign Algorand transaction
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - Hex private key
     * @param {string} txData.genesisId - Network ID (e.g. "mainnet-v1.0")
     * @param {string} txData.genesisHash - Genesis Hash (Hex or Base64)
     * @param {string|number} txData.firstRound - First round
     * @param {string|number} txData.lastRound - Last round
     * @param {string|number} txData.fee - Fee (MicroAlgos)
     * @param {string} [txData.note] - Note (Hex or Base64 or plain text needs to be transcoded manually)
     * * // Transfer ALGO specific parameters:
     * @param {string} [txData.toAddress]
     * @param {string|number} [txData.amount]
     * * // Transfer NFT/ASA specific parameters:
     * @param {string} [txData.assetToAddress]
     * @param {string|number} [txData.assetAmount]
     * @param {string|number} [txData.assetId]
     * * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.algorand) {
        const { AnySigner, HexCoding } = this.core;
        const Algorand = TW.Algorand.Proto;

        const input = Algorand.SigningInput.create({
            genesisId: txData.genesisId,
            genesisHash: this._toBuffer(txData.genesisHash),
            note: this._toBuffer(txData.note),
            privateKey: HexCoding.decode(txData.privateKey),
            firstRound: this._toLong(txData.firstRound),
            lastRound: this._toLong(txData.lastRound),
            fee: this._toLong(txData.fee)
        });

        // Mode A: ALGO Transfer
        if (txData.amount !== undefined) {
            input.transfer = Algorand.Transfer.create({
                toAddress: txData.toAddress,
                amount: this._toLong(txData.amount)
            });
        }

        // Mode B: ASA (Asset) Transfer / NFT
        else if (txData.assetId !== undefined) {
            input.assetTransfer = Algorand.AssetTransfer.create({
                toAddress: txData.assetToAddress || txData.toAddress,
                amount: this._toLong(txData.assetAmount || 1), // Default is 1 (NFT)
                assetId: this._toLong(txData.assetId)
            });
        }

        // Verify input
        const inputError = Algorand.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Algorand Input Verification Failed: ${inputError}`);
        }

        const encodedInput = Algorand.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
        const output = Algorand.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Algorand.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Algorand Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Algorand Signing Logic Error: ${msg}`);
        }

        return {
            // Algorand broadcasts Hex encoded MsgPack data (encoded)
            encoded: HexCoding.encode(output.encoded),
            extend: {
                // signature is just the signature itself in Base64 format
                signature: output.signature,
                json: output.toJSON()
            }
        };
    }
}

module.exports = AlgorandSigner;