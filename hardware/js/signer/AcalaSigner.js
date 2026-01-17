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
class AcalaSigner {
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
     * Convert Hex string or number to Buffer
     * Does the value field in Polkadot Proto require a Little Endian Buffer?
     * No, the official Kotlin uses toHexBytesInByteString, which is BigEndian direct Hex to Bytes.
     */
    _toBuffer(val) {
        if (!val) return Buffer.from([]);
        if (Buffer.isBuffer(val)) return val;

        let hex = '';
        if (typeof val === 'number') {
            hex = val.toString(16);
        } else if (typeof val === 'string') {
            hex = val.startsWith('0x') ? val.slice(2) : val;
        }

        if (hex.length % 2 !== 0) hex = '0' + hex;
        return Buffer.from(hex, 'hex');
    }

    /**
     * Sign Acala transfer transaction
     * @param coinType
     * @param {Object} txData
     * @param {string} txData.privateKey - Hex private key
     * @param {string} txData.toAddress - Recipient address (SS58 format)
     * @param {string|number|Buffer} txData.amount - Transfer amount (Hex string or Buffer)
     * @param {string} txData.genesisHash - Genesis block hash
     * @param {string} txData.blockHash - Current/Latest block hash
     * @param {number} txData.blockNumber - Current block height
     * @param {number} txData.nonce - Transaction Nonce
     * @param {number} [txData.specVersion=2170] - Chain Spec Version
     * @param {number} [txData.transactionVersion=2] - Transaction version
     * @param {number} [txData.eraPeriod=64] - Survival period
     * @param {Object} [txData.callIndices] - (Advanced) Custom call indices
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.acala) {
        const { AnySigner, HexCoding, CoinTypeExt } = this.core;
        const Polkadot = TW.Polkadot.Proto;

        // 1. Set Call Indices (Acala Transfer is Module 10, Method 0)
        // Reference Kotlin: moduleIndex = 0x0a (10), methodIndex = 0x00
        const indices = Polkadot.CallIndices.create({
            custom: Polkadot.CustomCallIndices.create({
                moduleIndex: txData.callIndices?.moduleIndex || 10,
                methodIndex: txData.callIndices?.methodIndex || 0
            })
        });

        // 2. Build transfer call (Balance Transfer)
        const transferCall = Polkadot.Balance.Transfer.create({
            toAddress: txData.toAddress,
            value: this._toBuffer(txData.amount),
            callIndices: indices
        });

        // 3. Build SigningInput
        const input = Polkadot.SigningInput.create({
            genesisHash: this._toBuffer(txData.genesisHash),
            blockHash: this._toBuffer(txData.blockHash),
            nonce: this._toLong(txData.nonce),
            specVersion: txData.specVersion || 2170,
            transactionVersion: txData.transactionVersion || 2,

            // Automatically get Acala SS58 prefix (usually 10)
            network: CoinTypeExt.ss58Prefix(coinType),

            privateKey: HexCoding.decode(txData.privateKey),

            // Set Era (Survival period)
            era: Polkadot.Era.create({
                blockNumber: this._toLong(txData.blockNumber),
                period: this._toLong(txData.eraPeriod || 64)
            }),

            // Set Balance Call
            balanceCall: Polkadot.Balance.create({
                transfer: transferCall
            }),

            // Must enable MultiAddress support (Substrate new standard)
            multiAddress: true
        });

        // Verify input
        const inputError = Polkadot.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Polkadot Input Verification Failed: ${inputError}`);
        }

        // 4. Sign
        // Note: Polkadot series usually don't need pre-encoding encode(input).finish(), passing input object directly to AnySigner
        // But JS binding sometimes needs encoded. We follow previous habits, encode first.
        // Wait, in Kotlin it is input.build() passed directly to AnySigner.
        // Here in JS AnySigner.sign accepts Uint8Array (encoded input).
        const encodedInput = Polkadot.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
        const output = Polkadot.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Polkadot.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Polkadot Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Polkadot Signing Logic Error: ${msg}`);
        }

        return {
            // JS returns Buffer, convert to Hex string
            encoded: HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON()
            }
        };
    }
}

module.exports = AcalaSigner;