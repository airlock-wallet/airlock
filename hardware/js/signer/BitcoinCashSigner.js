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
class BitcoinCashSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    toLong(val) {
        if (val === undefined || val === null) return Long.fromNumber(0);
        if (Long.isLong(val)) return val;
        return Long.fromValue(val);
    }

    toHashReversed(hexStr) {
        const { HexCoding } = this.core;
        return HexCoding.decode(hexStr).reverse();
    }

    /**
     * Sign Bitcoin Cash transaction (using BitcoinV2 interface)
     * @param {Object} txData
     * @param coinType
     * @param {string[]} txData.privateKeys - List of private keys
     * @param {Object[]} txData.utxos       - List of UTXO inputs
     * @param {Object[]} txData.outputs     - List of outputs
     * @param {string} txData.changeAddress - Change address
     * @param {string} [txData.chainHrp="bitcoincash"] - Bech32 HRP
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.bitcoinCash) {
        const { AnySigner, HexCoding, BitcoinSigHashType } = this.core;
        const Bitcoin = TW.Bitcoin.Proto;

        // 1. Basic validation
        if (!txData.changeAddress) throw new Error("Missing changeAddress");

        // 2. Build UTXO (same as BTC)
        const utxos = txData.utxos.map(u => {
            return Bitcoin.UnspentTransaction.create({
                amount: this.toLong(u.amount),
                outPoint: {
                    hash: this.toHashReversed(u.txHash),
                    index: u.index,
                    sequence: u.sequence ? u.sequence : 4294967295,
                },
                script: HexCoding.decode(u.script)
            });
        });

        // 3. Core difference: BCH must explicitly specify HashType
        // BCH uses Replay Protection, HashType = SIGHASH_ALL | SIGHASH_FORKID
        // 0x01 | 0x40 = 0x41 (decimal 65)
        const bchHashType = BitcoinSigHashType.all.value | BitcoinSigHashType.fork.value;

        const isMaxAmount = txData.useMax === true;

        // 4. Build V1 Input (Easy mode)
        // The library will automatically calculate: input total - amount - fee = change
        const input = Bitcoin.SigningInput.create({
            amount: isMaxAmount ? 0 : this.toLong(txData.amount),
            hashType: bchHashType,
            toAddress: txData.toAddress,
            changeAddress: txData.changeAddress,
            byteFee: this.toLong(txData.byteFee || 1),
            useMaxAmount: isMaxAmount,
            privateKey: txData.privateKeys.map(k => HexCoding.decode(k)),
            utxo: utxos,
            coinType: coinType.value
        });

        // Verify input
        const inputError = Bitcoin.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`BCH Input Verification Failed: ${inputError}`);
        }

        const encoded = Bitcoin.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encoded, coinType);
        const output = Bitcoin.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Bitcoin.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`BCH Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`BCH Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                txid: output.transactionId,
                json: output.toJSON(),
            }
        }
    }
}

module.exports = BitcoinCashSigner;