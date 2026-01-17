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
 * @property {string} encoded   - [Required] Final signed data (Hex/Base64/JSON), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data (e.g. txid, signature, rawTx etc.), for recording or debugging purposes only
 */
class BitcoinDiamondSigner {
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
        } else if (typeof val === 'number') {
            hex = val.toString(16);
        }
        if (hex.length % 2 !== 0) hex = '0' + hex;
        return Buffer.from(hex, 'hex');
    }

    /**
     * Your exclusive optimization method: Handling UTXO Hash
     * Assuming input is Big Endian (API format), output is Little Endian (Proto format)
     */
    _toHashReversed(hexStr) {
        const { HexCoding } = this.core;
        return HexCoding.decode(hexStr).reverse();
    }

    /**
     * Sign Bitcoin Diamond transaction
     * Characteristics: Legacy Input + PreBlockHash + Version 12
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.toAddress - Recipient address
     * @param {string} txData.changeAddress - Change address
     * @param {string|number} [txData.fee]  - Manually input fee
     * @param {string|number} txData.amount - Transfer amount (Satoshi)
     * @param {string|number} txData.byteFee - Fee rate (Sats/Byte)
     * @param {string[]} txData.privateKeys - List of private keys (Hex)
     * @param {Object[]} txData.inputs - List of UTXO inputs
     * @param {string} txData.preBlockHash - [BCD specific] Previous block Hash (Hex, Big Endian)
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.bitcoinDiamond) {
        const { AnySigner, HexCoding, BitcoinScript } = this.core;
        const Bitcoin = TW.Bitcoin.Proto;
        const Utxo = TW.Utxo.Proto;

        // 1. Build UTXO (Legacy format)
        const utxos = txData.inputs.map(utxo => {
            const outPoint = Utxo.OutPoint.create({
                // Core specification: Input Big Endian -> Internal automatic Reverse
                hash: this._toHashReversed(utxo.hash),
                index: utxo.index,
                sequence: utxo.sequence ? utxo.sequence : 4294967295 // Long.MAX_VALUE (uint32)
            });

            return Bitcoin.UnspentTransaction.create({
                outPoint: outPoint,
                amount: this._toLong(utxo.amount),
                // Must build Script, otherwise Legacy signing might fail
                script: BitcoinScript.lockScriptForAddress(utxo.address, coinType).data()
            });
        });

        // 2. Build initial SigningInput (for calculating Plan)
        const initialInput = Bitcoin.SigningInput.create({
            hashType: BitcoinScript.hashTypeForCoin(coinType),
            amount: this._toLong(txData.amount),
            byteFee: this._toLong(txData.byteFee || 1),
            toAddress: txData.toAddress,
            changeAddress: txData.changeAddress,
            coinType: coinType.value,
            privateKey: txData.privateKeys.map(k => HexCoding.decode(k)),
            utxo: utxos
        });

        // 3. Key step: Generate Plan (Transaction planning)
        // BCD needs to plan first, then insert preBlockHash
        const plan = Bitcoin.TransactionPlan.decode(
            AnySigner.plan(Bitcoin.SigningInput.encode(initialInput).finish(), coinType)
        );

        // 4. Inject PreBlockHash (BCD unique logic)
        // Note: According to Output Hex analysis, PreBlockHash does not need to be reversed, write directly as bytes
        if (txData.preBlockHash) {
            plan.preblockhash = this._toBuffer(txData.preBlockHash);
        }

        // 5. Secure Override Logic (Smart Override)
        // Only override plan when fee is explicitly passed in txData (usually for testing or advanced control)
        if (txData.fee !== undefined && !isNaN(Number(txData.fee)) && Number(txData.fee) > 0) {
            // Calculate total input amount
            const totalAmount = txData.inputs.reduce((sum, input) => sum + Number(input.amount), 0);
            const sendAmount = Number(txData.amount);
            const fee = Number(txData.fee);

            // Dynamically calculate change
            // Change = Total Input - Transfer Amount - Fee
            const change = totalAmount - sendAmount - fee;
            if (change < 0) {
                throw new Error("Insufficient funds: Total inputs < Amount + Fee");
            }

            plan.fee = this._toLong(fee);
            plan.amount = this._toLong(sendAmount);
            plan.change = this._toLong(change);
        }

        // 6. Set the modified Plan back to Input
        initialInput.plan = plan;
        // BCD usually doesn't need to automatically select inputs (because we manually planned or specified in input)
        // But the Legacy interface is flexible, setting it this way is safe

        // Verify input
        const inputError = Bitcoin.SigningInput.verify(initialInput);
        if (inputError) {
            throw new Error(`Bitcoin Input Verification Failed: ${inputError}`);
        }

        // 7. Final signing
        const outputBytes = AnySigner.sign(Bitcoin.SigningInput.encode(initialInput).finish(), coinType);
        const output = Bitcoin.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Bitcoin.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Bitcoin Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Bitcoin Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded), // Legacy interface returns encoded directly
            extend: {
                transaction: output.transaction, // Contains detailed structure
                txid: output.transactionId, // Legacy interface sometimes returns transactionId
                json: output.toJSON(),
            }
        };
    }
}

module.exports = BitcoinDiamondSigner;