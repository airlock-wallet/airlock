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
 * @property {string} encoded   - [Required] Final signed data (Hex String), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data
 */
class NeoSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Smart amount recognition: process decimal or 0x hex
     * @private
     */
    _parseAmountToLong(val) {
        if (!val) return Long.ZERO;
        const decStr = (typeof val === 'string' && val.startsWith('0x'))
            ? BigInt(val).toString()
            : val.toString();
        return Long.fromString(decStr);
    }

    _toBuffer(hex) {
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
        return Buffer.from(cleanHex, 'hex');
    }

    /**
     * Core signing method - Strictly enforce validation
     * @param {Object} txData - Transaction data
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {Array} txData.inputs - [Required] UTXO input array
     * @param {Array} txData.outputs - [Required] Transaction output array
     * @param {number|string} [txData.fee=0] - Fee
     * @param {string} [txData.gasAssetId] - Gas Asset ID
     * @param {string} [txData.gasChangeAddress] - Gas change address
     * @param coinType - Coin type
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.neo) {
        const { AnySigner, HexCoding } = this.core;
        const NEO = TW.NEO.Proto;

        // 1. Explicitly construct inputs array
        const allInputs = (txData.inputs || []).map(i => NEO.TransactionInput.create({
            prevHash: this._toBuffer(i.prevHash),
            prevIndex: i.prevIndex,
            assetId: i.assetId,
            value: this._parseAmountToLong(i.value)
        }));

        // 2. Explicitly construct outputs array
        const allOutputs = (txData.outputs || []).map(o => NEO.TransactionOutput.create({
            assetId: o.assetId,
            amount: this._parseAmountToLong(o.amount),
            toAddress: o.toAddress,
            changeAddress: o.changeAddress
        }));

        // 3. Construct Input for Plan
        const inputForPlan = NEO.SigningInput.create({
            privateKey: this._toBuffer(txData.privateKey),
            fee: this._parseAmountToLong(txData.fee || 0),
            gasAssetId: txData.gasAssetId || "",
            gasChangeAddress: txData.gasChangeAddress || "",
            inputs: allInputs,
            outputs: allOutputs
        });

        // 4. Get Plan
        const planBytes = AnySigner.plan(NEO.SigningInput.encode(inputForPlan).finish(), coinType);
        const plan = NEO.TransactionPlan.decode(planBytes);

        // 5. Explicitly re-inject all fields
        const finalInput = NEO.SigningInput.create({
            privateKey: this._toBuffer(txData.privateKey),
            fee: this._parseAmountToLong(txData.fee || 0),
            gasAssetId: txData.gasAssetId || "",
            gasChangeAddress: txData.gasChangeAddress || "",
            inputs: allInputs,
            outputs: allOutputs,
            plan: plan  // Inject Plan
        });

        // Input verification
        const inputError = NEO.SigningInput.verify(finalInput);
        if (inputError) throw new Error(`Nebulas Input Error: ${inputError}`);

        // 6. Final signing
        const inputEncoded = NEO.SigningInput.encode(finalInput).finish();
        const outputBytes = AnySigner.sign(inputEncoded, coinType);
        const output = NEO.SigningOutput.decode(outputBytes);

        // Output verification
        const outputVerifyError = NEO.SigningOutput.verify(output);
        if (outputVerifyError) throw new Error(`Nebulas Output Error: ${outputVerifyError}`);

        if (output.errorMessage || output.error) {
            throw new Error(`Nebulas Signing Logic Error: ${output.errorMessage || output.error}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = NeoSigner;