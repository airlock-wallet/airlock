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
class PolymeshSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Scenario: Polymesh Standard Transfer Signing (PolymeshTransactionSigning)
     * @param {Object} txData
     * @param {string} txData.privateKey        - [Required] Private key (Hex)
     * @param {string} txData.toAddress         - [Required] Recipient address (SS58 format)
     * @param {string} txData.amount            - [Required] Decimal amount string (e.g. "1000000")
     * @param {string} txData.genesisHash        - Genesis Hash (Hex)
     * @param {string} txData.blockHash          - Block Hash (Hex)
     * @param {number} txData.nonce              - Nonce
     * @param {number} txData.specVersion        - Spec Version
     * @param {number} txData.transactionVersion - Transaction Version
     * @param {Object} txData.era                - [Required] Era object
     * @param {number} txData.era.blockNumber    - Era start block number
     * @param {number} txData.era.period         - Era period
     * @param {number} [txData.network]          - Network prefix (Polymesh Mainnet usually 12)
     * @param coinType
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.polymesh) {
        const { AnySigner, HexCoding } = this.core;
        const PolymeshProto = TW.Polymesh.Proto;
        const PolkadotProto = TW.Polkadot.Proto;

        // 1. Internal parameter conversion function
        const toUint8 = (val) => {
            const clean = val.startsWith('0x') ? val.slice(2) : val;
            return HexCoding.decode(clean);
        };

        // 2. Amount handling: convert decimal to SCALE encoded byte stream (handles large numbers automatically)
        let amountHex = BigInt(txData.amount).toString(16);
        if (amountHex.length % 2 !== 0) amountHex = '0' + amountHex;
        const amountBytes = toUint8(amountHex);

        // 3. Build Polymesh Transfer Call
        const transferCall = PolymeshProto.Balance.Transfer.create({
            toAddress: txData.toAddress,
            value: amountBytes
        });

        // 4. Build RuntimeCall wrapper
        const runtimeCall = PolymeshProto.RuntimeCall.create({
            balanceCall: PolymeshProto.Balance.create({
                transfer: transferCall
            })
        });

        // 5. Build SigningInput
        const input = PolymeshProto.SigningInput.create({
            privateKey: toUint8(txData.privateKey),
            genesisHash: toUint8(txData.genesisHash),
            blockHash: toUint8(txData.blockHash),
            nonce: Long.fromValue(txData.nonce),
            specVersion: txData.specVersion,
            transactionVersion: txData.transactionVersion,
            network: txData.network || this.core.CoinType.polymesh.ss58Prefix(),
            era: PolkadotProto.Era.create({
                blockNumber: Long.fromValue(txData.era.blockNumber),
                period: Long.fromValue(txData.era.period)
            }),
            runtimeCall: runtimeCall
        });

        // --- Input Verification ---
        const inputError = PolymeshProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Polymesh Input Verification Failed: ${inputError}`);
        }

        // 6. Execute Signing
        const inputEncoded = PolymeshProto.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(inputEncoded, coinType);
        const output = PolymeshProto.SigningOutput.decode(outputBytes);

        // --- Output Verification ---
        const outputError = PolymeshProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Polymesh Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Polymesh Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = PolymeshSigner;