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
class GroestlcoinSigner {
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
        if (typeof val === 'string') {
            const hex = val.startsWith('0x') ? val.slice(2) : val;
            return Buffer.from(hex, 'hex');
        }
        return Buffer.from([]);
    }

    /**
     * General signing method
     * @param txData
     * @param coinType
     * @return {SignerResult}
     * @private
     */
    _signCommon(txData, coinType = this.core.CoinType.groestlcoin) {
        const { AnySigner, HexCoding } = this.core;
        const Bitcoin = TW.Bitcoin.Proto;
        const BitcoinV2 = TW.BitcoinV2.Proto;
        const Utxo = TW.Utxo.Proto;

        // 1. Build Inputs (UTXO)
        const inputs = (txData.inputs || []).map(input => {
            return BitcoinV2.Input.create({
                outPoint: Utxo.OutPoint.create({
                    hash: this._toBuffer(input.hash),
                    vout: input.vout
                }),
                value: this._toLong(input.value),
                sighashType: input.sighashType || this.core.BitcoinSigHashType.all.value,
                receiverAddress: input.receiverAddress
            });
        });

        // 2. Build Outputs
        const outputs = (txData.outputs || []).map(output => {
            return BitcoinV2.Output.create({
                value: this._toLong(output.value),
                toAddress: output.toAddress
            });
        });

        // 3. Build TransactionBuilder
        const builder = BitcoinV2.TransactionBuilder.create({
            version: BitcoinV2.TransactionVersion.UseDefault,
            inputs: inputs,
            outputs: outputs,
            inputSelector: BitcoinV2.InputSelector.UseAll,
            fixedDustThreshold: this._toLong(txData.dustSatoshis || 546)
        });

        // 4. Build BitcoinV2 SigningInput
        const v2Input = BitcoinV2.SigningInput.create({
            builder: builder,
            privateKeys: (txData.privateKeys || []).map(k => HexCoding.decode(k)),
            chainInfo: BitcoinV2.ChainInfo.create({
                p2pkhPrefix: txData.p2pkhPrefix || 36,
                p2shPrefix: txData.p2shPrefix || 5
            })
        });

        // 5. Wrap into Legacy Bitcoin SigningInput (corresponds to Kotlin structure)
        const legacyInput = Bitcoin.SigningInput.create({
            signingV2: v2Input,
            coinType: coinType.value
        });

        // Input verification
        const inputError = Bitcoin.SigningInput.verify(legacyInput);
        if (inputError) {
            throw new Error(`Groestlcoin Input Verification Failed: ${inputError}`);
        }

        // 6. Sign
        const outputBytes = AnySigner.sign(Bitcoin.SigningInput.encode(legacyInput).finish(), coinType);
        const output = Bitcoin.SigningOutput.decode(outputBytes);

        // Output verification
        const outputVerifyError = Bitcoin.SigningOutput.verify(output);
        if (outputVerifyError) {
            throw new Error(`Groestlcoin Output Verification Failed: ${outputVerifyError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Groestlcoin Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.signingResultV2.encoded),
            extend: {
                txid: HexCoding.encode(output.signingResultV2.txid),
                json: output.toJSON(),
            }
        };
    }

    /**
     * Sign Groestlcoin transaction
     * @param {Object} txData
     * @param {string[]} txData.privateKeys - Array of private keys (Hex)
     * @param {Array} txData.inputs - UTXO input list
     * @param {Array} txData.outputs - Output list
     * @param {number|string} [txData.dustSatoshis=546] - Dust threshold
     * @param {number} [txData.p2pkhPrefix=36] - Chain prefix
     * @param {number} [txData.p2shPrefix=5] - Script hash prefix
     * @param coinType
     */
    signTransfer(txData, coinType = this.core.CoinType.groestlcoin) {
        return this._signCommon(txData, coinType);
    }
}

module.exports = GroestlcoinSigner;