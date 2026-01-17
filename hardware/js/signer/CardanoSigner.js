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
class CardanoSigner {
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
     * Helper: Build TokenAmount object
     * @param token
     * @returns {TW.Cardano.Proto.TokenAmount}
     * @private
     */
    _createTokenAmount(token) {
        const { HexCoding } = this.core;
        const Cardano = TW.Cardano.Proto;

        // amount is usually hex byte array converted from BigInt (BigEndian)
        // Supported number, string, or buffer for compatibility
        let amountBytes;
        // If it's already Buffer/Uint8Array, use it directly
        if (token.amount && (token.amount instanceof Uint8Array || Buffer.isBuffer(token.amount))) {
            amountBytes = token.amount;
        } else {
            // Otherwise convert to Hex Buffer
            // Note: Cardano Token Amount is arbitrary length bytes in BigEndian, not fixed uint64
            let valStr = token.amount.toString();
            try {
                let hex = BigInt(valStr).toString(16);
                if (hex.length % 2 !== 0) hex = '0' + hex;
                amountBytes = HexCoding.decode(hex);
            } catch (e) {
                console.error("Token amount conversion error:", e);
                amountBytes = HexCoding.decode("00");
            }
        }

        return Cardano.TokenAmount.create({
            policyId: token.policyId,
            assetName: token.assetName,
            amount: amountBytes
        });
    }

    /**
     * Calculate minimum ADA required when including specific Tokens (Min-ADA-Value)
     * @param {string} toAddress - Recipient address
     * @param {Object[]} tokens - Token list [{policyId, assetName, amount}]
     * @param {string} [coinsPerUtxoByte="4310"] - Protocol parameter (Current mainnet is usually 4310)
     * @returns {string} - Required minimum ADA (Lovelace)
     */
    calculateMinAda(toAddress, tokens = [], coinsPerUtxoByte = "4310") {
        const { Cardano } = this.core;
        const Proto = TW.Cardano.Proto;

        // 1. Build a dummy TxOutput
        const tokenBundle = Proto.TokenBundle.create({
            token: tokens.map(t => this._createTokenAmount(t))
        });

        const output = Proto.TxOutput.create({
            tokenBundle: tokenBundle
        });

        // 2. Serialize
        const outputData = Proto.TxOutput.encode(output).finish();

        // 3. Call low-level calculation
        return Cardano.outputMinAdaAmount(toAddress, outputData, coinsPerUtxoByte);
    }

    /**
     * Sign Cardano transfer (Supports ADA + Token/NFT)
     * @param {Object} txData
     * @param {string[]} txData.privateKeys - Private key array (Usually only one needed, but multiple needed when UTXOs come from different addresses)
     * @param {Object[]} txData.utxos - UTXO input list
     * @param {string} txData.toAddress - Recipient
     * @param {string} txData.changeAddress - Change address
     * @param {string|number} txData.transferAmount - ADA amount to send (Lovelace)
     * @param {Object[]} [txData.transferTokens] - Token list to send
     * @param {number} [txData.ttl] - Time to Live (Slot number)
     * @param coinType - Cardano
     * @returns {SignerResult} - Hex encoded transaction
     */
    signTransfer(txData, coinType = this.core.CoinType.cardano) {
        const { AnySigner, HexCoding } = this.core;
        const Cardano = TW.Cardano.Proto;

        // 1. Build Inputs (UTXOs)
        const inputs = txData.utxos.map(utxo => {
            const inputObj = {
                outPoint: Cardano.OutPoint.create({
                    txHash: HexCoding.decode(utxo.txHash),
                    outputIndex: this._toLong(utxo.index)
                }),
                address: utxo.address,
                amount: this._toLong(utxo.amount)
            };

            // If UTXO contains Tokens
            if (utxo.tokens && utxo.tokens.length > 0) {
                inputObj.tokenAmount = utxo.tokens.map(t => this._createTokenAmount(t));
            }

            return Cardano.TxInput.create(inputObj);
        });

        // 2. Build TransferMessage (Output)
        const transferMsgObj = {
            toAddress: txData.toAddress,
            changeAddress: txData.changeAddress,
            amount: this._toLong(txData.transferAmount)
        };

        // If sending Tokens
        if (txData.transferTokens && txData.transferTokens.length > 0) {
            transferMsgObj.tokenAmount = Cardano.TokenBundle.create({
                token: txData.transferTokens.map(t => this._createTokenAmount(t))
            });
        }

        const transferMessage = Cardano.Transfer.create(transferMsgObj);

        // 3. Build SigningInput
        const signingInput = Cardano.SigningInput.create({
            utxos: inputs,
            privateKey: txData.privateKeys.map(k => HexCoding.decode(k)),
            ttl: this._toLong(txData.ttl || 0),
            transferMessage: transferMessage,
            // Automatic UTXO selection algorithm (Default no Plan, use transferMessage directly for WC to calculate automatically)
        });

        // Verify input
        const inputError = Cardano.SigningInput.verify(signingInput);
        if (inputError) {
            throw new Error(`Cardano Input Verification Failed: ${inputError}`);
        }

        // 4. Sign
        const encodedInput = Cardano.SigningInput.encode(signingInput).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
        const output = Cardano.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Cardano.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Cardano Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Cardano Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON()
            }
        };
    }
}

module.exports = CardanoSigner;