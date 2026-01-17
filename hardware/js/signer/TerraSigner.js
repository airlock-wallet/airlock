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
class TerraSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Scenario 1: Terra Standard Transfer Signing (uluna Native Transfer)
     *
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey    - [Required] Private Key (Hex)
     * @param {string} txData.toAddress     - [Required] Recipient address
     * @param {string} txData.amount        - [Required] Decimal amount string (uluna)
     * @param {string} txData.denom         - [Required] Asset unit (uluna)
     * @param {string} txData.feeAmount     - [Required] Decimal fee amount
     * @param {string} txData.feeDenom      - [Required] Fee unit
     * @param {number} txData.gas           - [Required] Gas limit
     * @param {string} txData.chainId       - [Required] Chain ID (phoenix-1)
     * @param {number} txData.accountNumber - [Required] Account number
     * @param {number} txData.sequence      - [Required] Sequence
     * @param {string} [txData.memo=""]     - Memo
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.terraV2) {
        const { HexCoding, PrivateKey, AnyAddress } = this.core;
        const CosmosProto = TW.Cosmos.Proto;

        // 1. Private key parsing and From address auto-derivation
        const pkData = HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey);
        const pk = PrivateKey.createWithData(pkData);
        const fromAddress = AnyAddress.createWithPublicKey(pk.getPublicKeySecp256k1(true), coinType).description();

        // 2. Build Message (Native Send)
        const sendMsg = CosmosProto.Message.Send.create({
            fromAddress: fromAddress,
            toAddress: txData.toAddress,
            amounts: [{ amount: String(txData.amount), denom: txData.denom }]
        });
        const msgWrapper = CosmosProto.Message.create({ sendCoinsMessage: sendMsg });

        // 3. Build Input and Execute
        const input = this._buildSigningInput(txData, pkData, [msgWrapper]);
        return this._execute(input);
    }

    /**
     * Scenario 2: Terra Wasm Contract Token Transfer Signing (CW20 Transfer)
     *
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.contractAddress - [Required] Contract address
     * @param {string} txData.amount          - [Required] Decimal amount (Contract decimals)
     * @param {string} txData.recipientAddress - [Required] Recipient address
     */
    signWasmTransfer(txData, coinType = this.core.CoinType.terraV2) {
        const { HexCoding, PrivateKey, AnyAddress } = this.core;
        const CosmosProto = TW.Cosmos.Proto;

        const pkData = HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey);
        const pk = PrivateKey.createWithData(pkData);
        const fromAddress = AnyAddress.createWithPublicKey(pk.getPublicKeySecp256k1(true), coinType).description();

        // 1. Build Wasm Transfer Message (Specific for Terra/Cosmos Wasm transfers)
        // Note: The 'amount' in WasmExecuteContractTransfer expects bytes, unlike standard Send which expects string
        const wasmTransferMsg = CosmosProto.Message.WasmExecuteContractTransfer.create({
            senderAddress: fromAddress,
            contractAddress: txData.contractAddress,
            amount: HexCoding.decode(BigInt(txData.amount).toString(16).padStart(2, '0')),
            recipientAddress: txData.recipientAddress
        });
        const msgWrapper = CosmosProto.Message.create({ wasmExecuteContractTransferMessage: wasmTransferMsg });

        // 2. Build Input and Execute
        const input = this._buildSigningInput(txData, pkData, [msgWrapper]);
        return this._execute(input);
    }

    /**
     * @private
     * Internal construction of universal SigningInput
     */
    _buildSigningInput(txData, pkData, messages) {
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
     * @private
     * Unified execution of signing and double verification
     */
    _execute(input, coinType = this.core.CoinType.terraV2) {
        const CosmosProto = TW.Cosmos.Proto;

        // --- Input Verification ---
        const inputError = CosmosProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Terra Input Verification Failed: ${inputError}`);
        }
        const inputEncoded = CosmosProto.SigningInput.encode(input).finish();
        const outputBytes = this.core.AnySigner.sign(inputEncoded, coinType);
        const output = CosmosProto.SigningOutput.decode(outputBytes);

        // --- Output Verification ---
        const outputError = CosmosProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Terra Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Terra Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.serialized,
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = TerraSigner;