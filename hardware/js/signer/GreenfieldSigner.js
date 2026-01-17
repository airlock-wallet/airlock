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
 * @property {string} encoded   - [Required] Final signed data (Hex/Base64/JSON), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data (e.g. txid, signature, rawTx etc.), for recording or debugging purposes only
 */
class GreenfieldSigner {
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
     * Sign BNB Greenfield transfer transaction
     * @param {Object} txData - Transaction parameters
     * @param coinType
     * @param {string} txData.privateKey - Hex format private key
     * @param {string} txData.fromAddress - Sender address (0x...)
     * @param {string} txData.toAddress - Recipient address (0x...)
     * @param {string|number} txData.amount - Transfer amount (wei/atomic units)
     * @param {string} [txData.denom="BNB"] - Token denomination, default BNB
     * @param {string|number} txData.accountNumber - Account Number
     * @param {string|number} txData.sequence - Sequence
     * @param {string} [txData.cosmosChainId="greenfield_5600-1"] - Cosmos layer chain ID
     * @param {string} [txData.ethChainId="5600"] - EVM layer chain ID
     * @param {string|number} [txData.gasLimit=1200] - Gas limit
     * @param {string|number} [txData.feeAmount=6000000000000] - Fee amount
     * @param {string} [txData.memo=""] - Transaction memo
     * @returns {SignerResult} - Returns JSON string for broadcasting
     */
    signTransfer(txData, coinType = this.core.CoinType.greenfield) {
        const { AnySigner, HexCoding } = this.core;
        const Greenfield = TW.Greenfield.Proto;

        // 1. Build Transfer Message (MsgSend)
        const msgSend = Greenfield.Message.create({
            sendCoinsMessage: Greenfield.Message.Send.create({
                fromAddress: txData.fromAddress,
                toAddress: txData.toAddress,
                amounts: [Greenfield.Amount.create({
                    amount: txData.amount.toString(),
                    denom: txData.denom || "BNB"
                })]
            })
        });

        // 2. Build SigningInput
        const input = Greenfield.SigningInput.create({
            signingMode: Greenfield.SigningMode.Eip712, // Greenfield must use EIP712
            encodingMode: Greenfield.EncodingMode.Protobuf,
            accountNumber: this._toLong(txData.accountNumber),
            sequence: this._toLong(txData.sequence),
            cosmosChainId: txData.cosmosChainId || "greenfield_5600-1", // Mainnet default
            ethChainId: txData.ethChainId || "5600",
            mode: Greenfield.BroadcastMode.SYNC, // Default SYNC broadcast
            memo: txData.memo || "",
            messages: [msgSend], // Supports multiple messages, demo with single one
            fee: Greenfield.Fee.create({
                amounts: [Greenfield.Amount.create({
                    amount: (txData.feeAmount || "6000000000000").toString(),
                    denom: txData.denom || "BNB" // Fee denomination usually consistent with transfer denomination
                })],
                gas: this._toLong(txData.gasLimit || 200000)
            }),
            privateKey: HexCoding.decode(txData.privateKey)
        });

        // Verify input
        const inputError = Greenfield.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Greenfield Input Verification Failed: ${inputError}`);
        }

        // 3. Encode and Sign
        const encoded = Greenfield.SigningInput.encode(input).finish();
        const outputData = AnySigner.sign(encoded, coinType);
        const output = Greenfield.SigningOutput.decode(outputData);

        // Verify output
        const outputError = Greenfield.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Greenfield Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Greenfield Signing Logic Error: ${msg}`);
        }

        // Greenfield also returns JSON structure for broadcasting
        return {
            encoded: output.serialized,
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = GreenfieldSigner;