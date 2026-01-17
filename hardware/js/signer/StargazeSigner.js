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
 * @property {string} encoded   - [Required] Final signed data (JSON string)
 * @property {Object} [extend]  - [Optional] Extended data
 */
class StargazeSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Scenario 1: Stargaze Standard Transfer Signing
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey    - [Required] Private Key (Hex)
     * @param {string} txData.toAddress     - [Required] Recipient address
     * @param {string} txData.amount        - [Required] Decimal amount string (e.g. "10000")
     * @param {string} txData.denom         - [Required] Asset unit (e.g. "ustars")
     * @param {string} txData.feeAmount     - [Required] Decimal fee amount (e.g. "1000")
     * @param {string} txData.feeDenom      - [Required] Fee unit (e.g. "ustars")
     * @param {number} txData.gas           - [Required] Gas limit (e.g. 80000)
     * @param {string} txData.chainId       - [Required] Chain ID (e.g. "stargaze-1")
     * @param {number} txData.accountNumber - [Required] Account number
     * @param {number} txData.sequence      - [Required] Sequence
     * @param {string} [txData.memo=""]     - Memo
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.stargaze) {
        const { HexCoding, PrivateKey, AnyAddress } = this.core;
        const CosmosProto = TW.Cosmos.Proto;

        // 1. Private key parsing and From address auto-derivation
        const pkData = HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey);
        const pk = PrivateKey.createWithData(pkData);
        const fromAddress = AnyAddress.createWithPublicKey(pk.getPublicKeySecp256k1(true), coinType).description();

        // 2. Build Message body (Send)
        const sendMsg = CosmosProto.Message.Send.create({
            fromAddress: fromAddress,
            toAddress: txData.toAddress,
            amounts: [{ amount: String(txData.amount), denom: txData.denom }]
        });

        const message = CosmosProto.Message.create({ sendCoinsMessage: sendMsg });

        // 3. Build Fee and Signing Input
        const input = this._buildInput(txData, pkData, [message]);

        return this._sign(input, coinType);
    }

    /**
     * Scenario 2: Stargaze Wasm Contract Execution (CW721 NFT transfer etc.)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.contractAddress - [Required] Contract address
     * @param {string} txData.executeMsg      - [Required] Execution message in JSON format
     * ... Other parameters same as signTransfer
     */
    signWasmExecute(txData, coinType = this.core.CoinType.stargaze) {
        const { HexCoding, PrivateKey, AnyAddress } = this.core;
        const CosmosProto = TW.Cosmos.Proto;

        const pkData = HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey);
        const pk = PrivateKey.createWithData(pkData);
        const fromAddress = AnyAddress.createWithPublicKey(pk.getPublicKeySecp256k1(true), coinType).description();

        // 1. Build Wasm Message
        const wasmMsg = CosmosProto.Message.WasmExecuteContractGeneric.create({
            senderAddress: fromAddress,
            contractAddress: txData.contractAddress,
            executeMsg: txData.executeMsg
        });

        // Note: JS version Proto assignment can be defined directly in create
        const msgWrapper = CosmosProto.Message.create({ wasmExecuteContractGeneric: wasmMsg });

        // 2. Build Input
        const input = this._buildInput(txData, pkData, [msgWrapper]);

        return this._sign(input, coinType);
    }

    /**
     * @private
     * Internal construction of universal SigningInput
     */
    _buildInput(txData, pkData, messages) {
        const CosmosProto = TW.Cosmos.Proto;
        return CosmosProto.SigningInput.create({
            signingMode: CosmosProto.SigningMode.Protobuf,
            accountNumber: Long.fromValue(txData.accountNumber),
            chainId: txData.chainId,
            memo: txData.memo || "",
            sequence: Long.fromValue(txData.sequence),
            fee: {
                gas: Long.fromValue(txData.gas),
                amounts: [{ amount: String(txData.feeAmount), denom: txData.feeDenom }]
            },
            privateKey: pkData,
            messages: messages
        });
    }

    /**
     * Internal unified signing and verification
     * @param input
     * @param coinType
     * @return {SignerResult}
     * @private
     */
    _sign(input, coinType = this.core.CoinType.stargaze) {
        const CosmosProto = TW.Cosmos.Proto;

        // --- Input Verification ---
        if (CosmosProto.SigningInput.verify(input)) throw new Error("Stargaze Signing Input Invalid");

        const outputBytes = this.core.AnySigner.sign(CosmosProto.SigningInput.encode(input).finish(), coinType);
        const output = CosmosProto.SigningOutput.decode(outputBytes);

        // --- Output Verification ---
        const outputError = CosmosProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Stargaze Output Verification Failed: ${outputError}`);
        }
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Stargaze Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.serialized,
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = StargazeSigner;