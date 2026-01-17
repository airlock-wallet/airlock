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
class TezosSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Scenario 1: Tezos FA2 Token Transfer Signing (Multi-asset/NFT standard)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey    - [Required] Private Key (Hex)
     * @param {string} txData.tokenContract - [Required] Contract address (KT1...)
     * @param {string} txData.toAddress     - [Required] Recipient address
     * @param {string} txData.amount        - [Required] Decimal amount string
     * @param {string} txData.tokenId       - [Required] Token ID (usually "0")
     * @param {string} txData.branch        - [Required] Current block hash (Branch)
     * @param {number} txData.counter       - [Required] Account counter
     * @param {number} txData.fee           - [Required] Decimal fee (mutez)
     * @param {number} txData.gasLimit      - [Required] Gas limit
     * @param {number} txData.storageLimit  - [Required] Storage limit
     * @returns {SignerResult}
     */
    signFA2Transfer(txData, coinType = this.core.CoinType.tezos) {
        const { HexCoding, PrivateKey, AnyAddress } = this.core;
        const TezosProto = TW.Tezos.Proto;

        // 1. Private key parsing and From address auto-derivation
        const pkData = HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey);
        const pk = PrivateKey.createWithData(pkData);
        const fromAddress = AnyAddress.createWithPublicKey(pk.getPublicKeyEd25519(), coinType).description();

        // 2. Build FA2 Parameters
        const txObj = TezosProto.TxObject.create({
            from: fromAddress,
            txs: [TezosProto.Txs.create({
                to: txData.toAddress,
                tokenId: txData.tokenId,
                amount: txData.amount // Decimal string
            })]
        });

        const fa2Params = TezosProto.FA2Parameters.create({
            entrypoint: "transfer",
            txsObject: [txObj]
        });

        const operation = TezosProto.Operation.create({
            source: fromAddress,
            fee: Long.fromValue(txData.fee),
            counter: Long.fromValue(txData.counter),
            gasLimit: Long.fromValue(txData.gasLimit),
            storageLimit: Long.fromValue(txData.storageLimit),
            kind: TezosProto.Operation.OperationKind.TRANSACTION,
            transactionOperationData: TezosProto.TransactionOperationData.create({
                amount: Long.fromValue(0), // Token transfer usually consumes 0 XTZ
                destination: txData.tokenContract,
                parameters: TezosProto.OperationParameters.create({
                    fa2Parameters: fa2Params
                })
            })
        });

        const operationList = TezosProto.OperationList.create({
            branch: txData.branch,
            operations: [operation]
        });

        const input = TezosProto.SigningInput.create({
            privateKey: pkData,
            operationList: operationList
        });

        return this._execute(input, coinType);
    }

    /**
     * Scenario 2: Tezos FA1.2 Token Transfer Signing (Classic token standard)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey    - [Required] Private Key (Hex)
     * @param {string} txData.tokenContract - [Required] Contract address (KT1...)
     * @param {string} txData.toAddress     - [Required] Recipient address
     * @param {string} txData.value         - [Required] Decimal amount string
     * @param {string} txData.branch        - [Required] Current block hash (Branch)
     * @param {number} txData.counter       - [Required] Account counter
     * @param {number} txData.fee           - [Required] Decimal fee (mutez)
     * @param {number} txData.gasLimit      - [Required] Gas limit
     * @param {number} txData.storageLimit  - [Required] Storage limit
     */
    signFA12Transfer(txData, coinType = this.core.CoinType.tezos) {
        const { HexCoding, PrivateKey, AnyAddress } = this.core;
        const TezosProto = TW.Tezos.Proto;

        const pkData = HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey);
        const pk = PrivateKey.createWithData(pkData);
        const fromAddress = AnyAddress.createWithPublicKey(pk.getPublicKeyEd25519(), coinType).description();

        const fa12Params = TezosProto.FA12Parameters.create({
            entrypoint: "transfer",
            from: fromAddress,
            to: txData.toAddress,
            value: txData.value // Decimal string
        });

        const operation = TezosProto.Operation.create({
            source: fromAddress,
            fee: Long.fromValue(txData.fee),
            counter: Long.fromValue(txData.counter),
            gasLimit: Long.fromValue(txData.gasLimit),
            storageLimit: Long.fromValue(txData.storageLimit),
            kind: TezosProto.Operation.OperationKind.TRANSACTION,
            transactionOperationData: TezosProto.TransactionOperationData.create({
                amount: Long.fromValue(0),
                destination: txData.tokenContract,
                parameters: TezosProto.OperationParameters.create({
                    fa12Parameters: fa12Params
                })
            })
        });

        const operationList = TezosProto.OperationList.create({
            branch: txData.branch,
            operations: [operation]
        });

        const input = TezosProto.SigningInput.create({
            privateKey: pkData,
            operationList: operationList
        });

        return this._execute(input, coinType);
    }

    /**
     * @private
     * Unified execution of signing and double verification
     */
    _execute(input, coinType = this.core.CoinType.tezos) {
        const TezosProto = TW.Tezos.Proto;

        // --- Input Verification ---
        const inputError = TezosProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Tezos Input Verification Failed: ${inputError}`);
        }

        const inputEncoded = TezosProto.SigningInput.encode(input).finish();
        const outputBytes = this.core.AnySigner.sign(inputEncoded, coinType);
        const output = TezosProto.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = TezosProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Tezos Output Verification Failed: ${outputError}`);
        }
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Tezos Signing Logic Error: ${msg}`);
        }

        return {
            encoded: this.core.HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = TezosSigner;