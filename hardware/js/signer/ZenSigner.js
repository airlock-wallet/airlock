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
 * @property {string} encoded   - [Required] Final signed data (Hex String)
 * @property {Object} [extend]  - [Optional] Extended data
 */
class ZenSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Scenario: Horizen (ZEN) UTXO Transaction Signing
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.toAddress      - [Required] Recipient address
     * @param {string} txData.changeAddress  - [Required] Change address
     * @param {string} txData.amount         - [Required] Decimal transfer amount (Satoshi)
     * @param {number} txData.byteFee        - [Required] Fee rate per byte
     * @param {Array}  txData.utxos          - [Required] UTXO array
     * @param {Array}  txData.privateKeys    - [Required] Private keys array (Hex)
     * @param {string} txData.preblockhash   - [Required] Previous block hash (Hex)
     * @param {number} txData.preblockheight - [Required] Previous block height
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.zen) {
        const { AnySigner, HexCoding, BitcoinScript } = this.core;
        const BitcoinProto = TW.Bitcoin.Proto;

        // 1. Initialize SigningInput
        const input = BitcoinProto.SigningInput.create({
            hashType: BitcoinScript.hashTypeForCoin(coinType),
            amount: Long.fromString(String(txData.amount)),
            byteFee: Long.fromString(String(txData.byteFee)),
            toAddress: txData.toAddress,
            changeAddress: txData.changeAddress,
            coinType: coinType.value
        });

        // 2. Inject private keys
        txData.privateKeys.forEach(key => {
            const pk = HexCoding.decode(key.startsWith('0x') ? key.slice(2) : key);
            input.privateKey.push(pk);
        });

        // 3. Inject UTXOs
        txData.utxos.forEach(u => {
            const utxo = BitcoinProto.UnspentTransaction.create({
                amount: Long.fromString(String(u.amount)),
                script: HexCoding.decode(u.script),
                outPoint: BitcoinProto.OutPoint.create({
                    hash: HexCoding.decode(u.txHash),
                    index: u.index,
                    sequence: u.sequence || 0xffffffff
                })
            });
            input.utxo.push(utxo);
        });

        // 4. Step 1: Get Plan (Estimate fees and change)
        const planResult = AnySigner.plan(BitcoinProto.SigningInput.encode(input).finish(), coinType);
        const plan = BitcoinProto.TransactionPlan.decode(planResult);

        // 5. Step 2: Merge Plan and inject ZEN specific branch info
        input.plan = BitcoinProto.TransactionPlan.create({
            ...plan,
            preblockhash: HexCoding.decode(txData.preblockhash),
            preblockheight: txData.preblockheight
        });

        // --- Enforce Input Verification ---
        const inputError = BitcoinProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Zen Input Verification Failed: ${inputError}`);
        }

        // 6. Execute Signing
        const outputBytes = AnySigner.sign(BitcoinProto.SigningInput.encode(input).finish(), coinType);
        const output = BitcoinProto.SigningOutput.decode(outputBytes);

        // --- Enforce Output Verification ---
        const outputError = BitcoinProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Zen Output Verification Failed: ${outputError}`);
        }
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Zen Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = ZenSigner;