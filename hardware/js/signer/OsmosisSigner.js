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
 * @property {string} encoded   - [Required] Final signed data (JSON String)
 * @property {Object} [extend]  - [Optional] Extended data
 */
class OsmosisSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Get wallet address
     * @param privateKeyHex
     * @param coinType
     * @return {string}
     */
    getAddress(privateKeyHex, coinType = this.core.CoinType.osmosis) {
        const { PrivateKey, AnyAddress, CoinType, HexCoding } = this.core;
        const pk = PrivateKey.createWithData(HexCoding.decode(privateKeyHex));
        const pubKey = pk.getPublicKeySecp256k1(true);
        const address = AnyAddress.createWithPublicKey(pubKey, coinType);
        return address.description();
    }

    /**
     * Scenario 1: Osmosis Standard Transfer Signing (OsmosisTransactionSigning)
     * Independent Logic: Focuses on constructing Cosmos-structure messages, enforcing strict validation
     * @param {Object} txData
     * @param {string} txData.privateKey    - [Required] Private key (Hex)
     * @param {string} txData.toAddress     - Recipient address
     * @param {string} txData.amount        - Transfer amount (e.g., "99800")
     * @param {string} txData.denom         - Currency unit (e.g., "uosmo")
     * @param {string} txData.feeAmount     - Fee amount (e.g., "200")
     * @param {string} txData.feeDenom      - Fee unit (e.g., "uosmo")
     * @param {number} txData.gas           - Gas limit (e.g., 200000)
     * @param {string} txData.chainId       - Chain ID (e.g., "osmosis-1")
     * @param {number} txData.accountNumber - Account number
     * @param {number} txData.sequence      - Sequence
     * @param {string} [txData.memo=""]     - Memo
     * @param coinType
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.osmosis) {
        const { AnySigner, HexCoding} = this.core;
        const CosmosProto = TW.Cosmos.Proto;

        // 1. Construct amount object
        const amount = CosmosProto.Amount.create({
            amount: txData.amount,
            denom: txData.denom
        });

        // 2. Construct message body (Message.Send)
        const sendMsg = CosmosProto.Message.Send.create({
            fromAddress: this.getAddress(txData.privateKey, coinType),
            toAddress: txData.toAddress,
            amounts: [amount]
        });

        // 3. Construct generic message wrapper
        const message = CosmosProto.Message.create({
            sendCoinsMessage: sendMsg
        });

        // 4. Construct fee object
        const feeAmount = CosmosProto.Amount.create({
            amount: txData.feeAmount,
            denom: txData.feeDenom
        });

        const fee = CosmosProto.Fee.create({
            gas: Long.fromValue(txData.gas),
            amounts: [feeAmount]
        });

        // 5. Construct SigningInput
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

        // --- Input Verification ---
        const inputError = CosmosProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`OsmosisProto Input Verification Failed: ${inputError}`);
        }

        // 6. Execute signing
        const inputEncoded = CosmosProto.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(inputEncoded, coinType);
        const output = CosmosProto.SigningOutput.decode(outputBytes);

        // Output verification
        const outputVerifyError = CosmosProto.SigningOutput.verify(output);
        if (outputVerifyError) {
            throw new Error(`OsmosisProto Output Error: ${outputVerifyError}`);
        }
        if (output.errorMessage || output.error) {
            throw new Error(`OsmosisProto Signing Logic Error: ${output.errorMessage || output.error}`);
        }

        // Cosmos series usually return serialized string containing tx_bytes
        return {
            encoded: output.serialized,
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = OsmosisSigner;