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
class SecretSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Get wallet address from private key
     * (Helper method, used for testing address verification)
     */
    getAddress(privateKeyHex, coinType = this.core.CoinType.secret) {
        const { PrivateKey, HexCoding, AnyAddress } = this.core;
        const pk = PrivateKey.createWithData(HexCoding.decode(privateKeyHex));
        const pubKey = pk.getPublicKeySecp256k1(true);
        const address = AnyAddress.createWithPublicKey(pubKey, coinType);
        return address.description();
    }

    /**
     * Scenario 1: Secret Network Standard Transfer Signing
     * Independent method, logic extraction is strictly prohibited to ensure Secret protocol parameter accuracy
     * @param {Object} txData
     * @param {string} txData.privateKey    - [Required] Private Key (Hex)
     * @param {string} txData.toAddress     - [Required] Recipient address (Bech32 format)
     * @param {string} txData.amount        - [Required] Decimal transfer amount (e.g. "100000")
     * @param {string} txData.denom         - [Required] Asset unit (e.g. "uscrt")
     * @param {string} txData.feeAmount     - [Required] Decimal fee amount (e.g. "2500")
     * @param {string} txData.feeDenom      - [Required] Fee unit (e.g. "uscrt")
     * @param {number} txData.gas           - [Required] Gas limit (e.g. 25000)
     * @param {string} txData.chainId       - [Required] Chain ID (e.g. "secret-4")
     * @param {number} txData.accountNumber - [Required] Account number
     * @param {number} txData.sequence      - [Required] Sequence
     * @param {string} [txData.memo=""]     - [Optional] Memo
     * @param coinType
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.secret) {
        const { AnySigner, HexCoding } = this.core;
        const CosmosProto = TW.Cosmos.Proto;

        // 1. Build transfer amount object (Amount is always decimal)
        const amount = CosmosProto.Amount.create({
            amount: txData.amount,
            denom: txData.denom
        });

        // 2. Build Send Message body
        const sendMsg = CosmosProto.Message.Send.create({
            fromAddress: this.getAddress(txData.privateKey, coinType),
            toAddress: txData.toAddress,
            amounts: [amount]
        });

        const message = CosmosProto.Message.create({
            sendCoinsMessage: sendMsg
        });

        // 3. Build Fee object
        const feeAmount = CosmosProto.Amount.create({
            amount: txData.feeAmount,
            denom: txData.feeDenom
        });

        const fee = CosmosProto.Fee.create({
            gas: Long.fromValue(txData.gas),
            amounts: [feeAmount]
        });

        // 4. Build SigningInput
        const input = CosmosProto.SigningInput.create({
            signingMode: CosmosProto.SigningMode.Protobuf,
            accountNumber: Long.fromValue(txData.accountNumber),
            chainId: txData.chainId,
            memo: txData.memo || "",
            sequence: Long.fromValue(txData.sequence),
            fee: fee,
            privateKey: HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey),
            messages: [message]
        });

        // --- Enforce Input Verification ---
        const inputError = CosmosProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Secret Input Verification Failed: ${inputError}`);
        }

        // 5. Execute Signing
        const inputEncoded = CosmosProto.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(inputEncoded, coinType);
        const output = CosmosProto.SigningOutput.decode(outputBytes);

        // --- Enforce Output Verification ---
        const outputError = CosmosProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Secret Output Verification Failed: ${outputError}`);
        }
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Secret Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.serialized,
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = SecretSigner;