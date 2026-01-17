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
class KusamaSigner {
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
        if (val === undefined || val === null) return Buffer.from([]);

        let hex = '';
        if (typeof val === 'number') {
            hex = val.toString(16);
        } else if (typeof val === 'string') {
            if (val.startsWith('0x')) {
                hex = val.slice(2);
            } else {
                try {
                    hex = BigInt(val).toString(16);
                } catch (e) {
                    hex = val; // Fallback
                }
            }
        }
        if (hex.length % 2 !== 0) hex = '0' + hex;
        return Buffer.from(hex, 'hex');
    }

    /**
     * Core signing method - Strictly enforce validation
     * @param {Object} txData - Transaction basic data
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {string} txData.genesisHash - [Required] Genesis hash (Hex)
     * @param {string} txData.blockHash - [Required] Recent block hash (Hex)
     * @param {number|string} txData.nonce - [Required] Account Nonce
     * @param {number} txData.specVersion - [Required] Runtime spec version
     * @param {number} txData.transactionVersion - [Required] Transaction version
     * @param {number} txData.network - [Required] SS58 network prefix (Kusama is 2)
     * @param {Object} txData.action - [Required] Specific Action message body (e.g. {balanceCall: ...})
     * @param coinType - Coin type
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.kusama) {
        const { AnySigner, HexCoding } = this.core;
        const Polkadot = TW.Polkadot.Proto;

        // 1. Build SigningInput
        const input = Polkadot.SigningInput.create({
            genesisHash: this._toBuffer(txData.genesisHash),
            blockHash: this._toBuffer(txData.blockHash),
            nonce: this._toLong(txData.nonce),
            specVersion: txData.specVersion,
            transactionVersion: txData.transactionVersion,
            network: txData.network,
            privateKey: this._toBuffer(txData.privateKey),
            ...txData.action // Dynamically inject specific Call (e.g. balanceCall)
        });

        // Input verification (Fail Fast)
        const inputError = Polkadot.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Polkadot Input Verification Failed: ${inputError}`);
        }

        // 2. Sign
        const outputBytes = AnySigner.sign(Polkadot.SigningInput.encode(input).finish(), coinType);
        const output = Polkadot.SigningOutput.decode(outputBytes);

        // Output verification
        const outputVerifyError = Polkadot.SigningOutput.verify(output);
        if (outputVerifyError) {
            throw new Error(`Polkadot Output Verification Failed: ${outputVerifyError}`);
        }

        // Business logic error verification
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Polkadot Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = KusamaSigner;