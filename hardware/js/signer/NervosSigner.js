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
 * @property {string} encoded   - [Required] Final signed data (JSON String / Hex)
 * @property {Object} [extend]  - [Optional] Extended data
 */
class NervosSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    _toLong(val) {
        if (val === undefined || val === null) return Long.fromNumber(0);
        if (Long.isLong(val)) return val;
        // CKB amount is large, suggest using fromString
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
     * Core signing method - Strictly enforce validation
     * @param {Object} txData - Transaction data object
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {string|number} txData.byteFee - Byte fee rate
     * @param {Object} txData.nativeTransfer - Transfer object {toAddress, changeAddress, amount}
     * @param {Array} txData.cells - Input Cell array
     * @param coinType - Coin type
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.nervos) {
        const { AnySigner, HexCoding, PrivateKey } = this.core;
        const Nervos = TW.Nervos.Proto;

        // 1. Calculate PrivateKey
        const rawPrivKey = HexCoding.decode(txData.privateKey);
        const keyObject = PrivateKey.createWithData(rawPrivKey);
        if (!keyObject) throw new Error("Invalid Private Key Object");
        const byteStringData = keyObject.data();

        // 2. Build SigningInput
        const input = Nervos.SigningInput.create({
            byteFee: this._toLong(txData.byteFee || 1),
            privateKey: [byteStringData],
            nativeTransfer: Nervos.NativeTransfer.create({
                toAddress: txData.nativeTransfer.toAddress,
                changeAddress: txData.nativeTransfer.changeAddress,
                amount: this._toLong(txData.nativeTransfer.amount)
            }),
            cell: (txData.cells || []).map(c => Nervos.Cell.create({
                capacity: this._toLong(c.capacity),
                outPoint: Nervos.OutPoint.create({
                    txHash: HexCoding.decode(c.outPoint.txHash),
                    index: c.outPoint.index
                }),
                lock: Nervos.Script.create({
                    codeHash: HexCoding.decode(c.lock.codeHash.toString()),
                    hashType: c.lock.hashType,
                    args: HexCoding.decode(c.lock.args.toString())
                })
            }))
        });

        // Input verification
        const inputError = Nervos.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Nervos Input Verification Failed: ${inputError}`);
        }

        // 3. Sign
        const inputEncoded = Nervos.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(inputEncoded, coinType);
        const output = Nervos.SigningOutput.decode(outputBytes);

        // Output verification
        const outputVerifyError = Nervos.SigningOutput.verify(output);
        if (outputVerifyError) {
            throw new Error(`Nervos Output Verification Failed: ${outputVerifyError}`);
        }

        // Business logic error verification
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Nervos Signing Logic Error: ${msg}`);
        }

        // CKB signing output is usually transactionJson
        return {
            encoded: output.transactionJson,
            extend: {
                transactionId: output.transactionId,
                json: output.toJSON(),
            }
        };
    }
}

module.exports = NervosSigner;