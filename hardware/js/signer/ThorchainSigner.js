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
class ThorchainSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Scenario 1: THORChain Standard Transfer Signing (Native RUNE Transfer)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey    - [Required] Private Key (Hex)
     * @param {string} txData.toAddress     - [Required] Recipient address (thor1...)
     * @param {string} txData.amount        - [Required] Decimal amount string (e.g. "38000000")
     * @param {string} txData.denom         - [Required] Asset unit (e.g. "rune")
     * @param {string} txData.feeAmount     - [Required] Decimal fee amount (e.g. "200")
     * @param {string} txData.feeDenom      - [Required] Fee unit
     * @param {number} txData.gas           - [Required] Gas limit (e.g. 2500000)
     * @param {string} txData.chainId       - [Required] Chain ID (thorchain-mainnet-v1)
     * @param {number} txData.accountNumber - [Required] Account number
     * @param {number} txData.sequence      - [Required] Sequence
     * @param {string} [txData.memo=""]     - [Optional] Memo
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.thorchain) {
        const { AnySigner, HexCoding, PrivateKey, AnyAddress } = this.core;
        const CosmosProto = TW.Cosmos.Proto;

        // 1. Private key parsing and derivation
        const pkData = HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey);
        const pk = PrivateKey.createWithData(pkData);

        // THORChain requires Data format addresses in Proto
        const fromAddrObj = AnyAddress.createWithPublicKey(pk.getPublicKeySecp256k1(true), coinType);
        const fromData = fromAddrObj.data();

        const toAddrObj = AnyAddress.createWithString(txData.toAddress, coinType);
        const toData = toAddrObj.data();

        // 2. Build THORChain specific message
        const thorMsg = CosmosProto.Message.THORChainSend.create({
            fromAddress: fromData,
            toAddress: toData,
            amounts: [{
                amount: String(txData.amount),
                denom: txData.denom
            }]
        });

        const message = CosmosProto.Message.create({
            thorchainSendMessage: thorMsg
        });

        // 3. Build SigningInput
        const input = CosmosProto.SigningInput.create({
            signingMode: CosmosProto.SigningMode.Protobuf,
            chainId: txData.chainId,
            accountNumber: Long.fromValue(txData.accountNumber),
            sequence: Long.fromValue(txData.sequence),
            memo: txData.memo || "",
            fee: {
                gas: Long.fromValue(txData.gas),
                amounts: [{
                    amount: String(txData.feeAmount),
                    denom: txData.feeDenom
                }]
            },
            privateKey: pkData,
            messages: [message]
        });

        // Input Verification
        const inputError = CosmosProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Thorchain Input Verification Failed: ${inputError}`);
        }

        // 4. Execute Signing
        const inputEncoded = CosmosProto.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(inputEncoded, coinType);
        const output = CosmosProto.SigningOutput.decode(outputBytes);

        // Output Verification
        const outputError = CosmosProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Thorchain Output Verification Failed: ${outputError}`);
        }
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Thorchain Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.serialized,
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = ThorchainSigner;