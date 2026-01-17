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
const {TW} = require('@trustwallet/wallet-core');
const Long = require('long');

/**
 * Universal signing result
 * @typedef {Object} SignerResult
 * @property {string} encoded   - [Required] Final signed data (Hex/Base64/JSON), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data (e.g. txid, signature, rawTx etc.), for recording or debugging purposes only
 */
class AgoricSigner {
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
     * Sign Agoric transfer transaction
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - Hex format private key
     * @param {string} txData.toAddress - Recipient address
     * @param {string|number} txData.amount - Transfer amount
     * @param {string} [txData.denom="ubld"] - Token denomination
     * @param {string} [txData.chainId="agoric-3"] - Chain ID
     * @param {string|number} txData.accountNumber - Account number
     * @param {string|number} txData.sequence - Sequence number
     * @param {string|number} [txData.feeAmount=2000] - Fee amount
     * @param {string|number} [txData.gas=100000] - Gas Limit
     * @param {string} [txData.memo=""] - Memo
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.agoric) {
        const {AnySigner, HexCoding, AnyAddress, PrivateKey} = this.core;
        const Cosmos = TW.Cosmos.Proto;

        // 0. If fromAddress is not provided, try to derive it from private key (for logic integrity verification)
        let fromAddress = txData.fromAddress;
        if (!fromAddress) {
            const pk = PrivateKey.createWithData(HexCoding.decode(txData.privateKey));
            const pubKey = pk.getPublicKeySecp256k1(true);
            const address = AnyAddress.createWithPublicKey(pubKey, coinType);
            fromAddress = address.description();
        }

        // 1. Build transfer message
        const sendMsg = Cosmos.Message.Send.create({
            fromAddress: fromAddress,
            toAddress: txData.toAddress,
            amounts: [Cosmos.Amount.create({
                amount: txData.amount.toString(),
                denom: txData.denom || "ubld"
            })]
        });

        const message = Cosmos.Message.create({
            sendCoinsMessage: sendMsg
        });

        // 2. Build fee
        const fee = Cosmos.Fee.create({
            gas: this._toLong(txData.gas || 100000),
            amounts: [Cosmos.Amount.create({
                amount: (txData.feeAmount || 2000).toString(),
                denom: txData.denom || "ubld"
            })]
        });

        // 3. Build SigningInput
        const input = Cosmos.SigningInput.create({
            signingMode: Cosmos.SigningMode.Protobuf, // Key: Agoric uses Protobuf mode
            chainId: txData.chainId || "agoric-3",
            accountNumber: this._toLong(txData.accountNumber),
            sequence: this._toLong(txData.sequence),
            memo: txData.memo || "",
            fee: fee,
            privateKey: HexCoding.decode(txData.privateKey),
            messages: [message]
        });

        // Verify input
        const inputError = Cosmos.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Cosmos Input Verification Failed: ${inputError}`);
        }

        // 4. Sign
        const encodedInput = Cosmos.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
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

        // 5. Return
        return {
            encoded: output.serialized, // JSON string, used directly for broadcasting
            extend: {
                signature: output.signature,    // Raw signature data
                json: output.toJSON(),           // Another JSON format (optional)
            }
        };
    }
}

module.exports = AgoricSigner;