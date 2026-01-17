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
 * @property {string} encoded   - [Required] Final signed data (JSON String), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data
 */
class BluzelleSigner {
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
     * Sign Bluzelle transaction (Based on Cosmos SDK)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.chainId - Chain ID (e.g. "net-6")
     * @param {string|number} txData.accountNumber - Account number
     * @param {string|number} txData.sequence - Sequence number
     * @param {string} txData.privateKey - Private key (Hex)
     * @param {string} txData.toAddress - Recipient address (bluzelle1...)
     * @param {string|number} txData.amount - Transfer amount
     * @param {string} [txData.denom="ubnt"] - Token denomination
     * @param {string|number} [txData.feeAmount=1000] - Fee amount
     * @param {string|number} [txData.gas=500000] - Gas Limit
     * @param {string} [txData.memo=""] - Memo
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.bluzelle) {
        const { AnySigner, HexCoding, AnyAddress, PrivateKey } = this.core;
        const Cosmos = TW.Cosmos.Proto;

        // 1. Prepare private key and address
        const privateKeyBytes = HexCoding.decode(txData.privateKey);
        const privateKey = PrivateKey.createWithData(privateKeyBytes);
        const publicKey = privateKey.getPublicKeySecp256k1(true);
        const fromAddress = AnyAddress.createWithPublicKey(publicKey, coinType).description();

        // 2. Build transfer message (MsgSend)
        const sendMsg = Cosmos.Message.Send.create({
            fromAddress: fromAddress,
            toAddress: txData.toAddress,
            amounts: [
                Cosmos.Amount.create({
                    amount: String(txData.amount), // Cosmos Amount is usually String type
                    denom: txData.denom || "ubnt"
                })
            ]
        });

        // 3. Wrap into Message
        const message = Cosmos.Message.create({
            sendCoinsMessage: sendMsg
        });

        // 4. Build Fee
        const fee = Cosmos.Fee.create({
            gas: this._toLong(txData.gas || 500000),
            amounts: [
                Cosmos.Amount.create({
                    amount: String(txData.feeAmount || 1000),
                    denom: txData.denom || "ubnt"
                })
            ]
        });

        // 5. Build SigningInput
        const input = Cosmos.SigningInput.create({
            chainId: txData.chainId,
            accountNumber: this._toLong(txData.accountNumber),
            sequence: this._toLong(txData.sequence),
            memo: txData.memo || "",
            fee: fee,
            privateKey: privateKeyBytes,
            messages: [message]
        });

        // Verify input
        const inputError = Cosmos.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Cosmos Input Verification Failed: ${inputError}`);
        }

        // 6. Sign
        // Bluzelle uses Cosmos signing logic
        const outputBytes = AnySigner.sign(Cosmos.SigningInput.encode(input).finish(), coinType);
        const output = Cosmos.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Cosmos.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Cosmos Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Cosmos Signing Logic Error: ${msg}`);
        }

        // For Cosmos type Output, the most important result is usually the json field (used for REST API broadcasting)
        return {
            encoded: output.json, // Return JSON string
            extend: {
                signature: output.signature, // Signature Hex
                serialized: output.serialized, // Serialized Tx (Protobuf)
                json: output.toJSON()
            }
        };
    }
}

module.exports = BluzelleSigner;