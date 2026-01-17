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
 * @property {string} encoded   - [Required] Final signed data (Signed Transaction Hex)
 * @property {Object} [extend]  - [Optional] Extended data (TransactionId, Signature)
 */
class PactusSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Scenario 1: Pactus Transfer Signing (testPactusTransferSigning)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {number} txData.lockTime   - Lock height/time
     * @param {number|string} txData.fee - Fee
     * @param {string} [txData.memo]     - Memo
     * @param {string} txData.sender     - Sender address
     * @param {string} txData.receiver   - Receiver address
     * @param {number|string} txData.amount - Transfer amount
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.pactus) {
        const { AnySigner, HexCoding } = this.core;
        const PactusProto = TW.Pactus.Proto;

        // 1. Build Transfer Payload
        const transferPayload = PactusProto.TransferPayload.create({
            sender: txData.sender,
            receiver: txData.receiver,
            amount: Long.fromValue(txData.amount)
        });

        // 2. Build Transaction Message
        const transaction = PactusProto.TransactionMessage.create({
            lockTime: txData.lockTime,
            fee: Long.fromValue(txData.fee),
            memo: txData.memo || "",
            transfer: transferPayload
        });

        // 3. Build Signing Input
        const input = PactusProto.SigningInput.create({
            privateKey: HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey),
            transaction: transaction
        });

        // --- Input Verification ---
        const inputError = PactusProto.SigningInput.verify(input);
        if (inputError) throw new Error(`Pactus Input Verification Failed: ${inputError}`);

        // 4. Sign
        const inputEncoded = PactusProto.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(inputEncoded, coinType);
        const output = PactusProto.SigningOutput.decode(outputBytes);

        // --- Output Verification ---
        const outputVerifyError = PactusProto.SigningOutput.verify(output);
        if (outputVerifyError) {
            throw new Error(`Pactus Output Error: ${outputVerifyError}`);
        }
        if (output.errorMessage || output.error) {
            throw new Error(`Pactus Signing Logic Error: ${output.errorMessage || output.error}`);
        }

        return {
            encoded: HexCoding.encode(output.signedTransactionData),
            extend: {
                transactionId: HexCoding.encode(output.transactionId),
                signature: HexCoding.encode(output.signature),
                json: output.toJSON(),
            }
        };
    }

    /**
     * Scenario 2: Pactus Bond Signing (testPactusBondSigning)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {number} txData.lockTime   - Lock height/time
     * @param {number|string} txData.fee - Fee
     * @param {string} [txData.memo]     - Memo
     * @param {string} txData.sender     - Sender address
     * @param {string} txData.receiver   - Receiver address (Validator address)
     * @param {number|string} txData.stake - Stake amount
     * @param {string} [txData.publicKey] - Validator public key (Required for first Bond)
     * @returns {SignerResult}
     */
    signBond(txData, coinType = this.core.CoinType.pactus) {
        const { AnySigner, HexCoding } = this.core;
        const PactusProto = TW.Pactus.Proto;

        // 1. Build Bond Payload
        const bondPayload = PactusProto.BondPayload.create({
            sender: txData.sender,
            receiver: txData.receiver,
            stake: Long.fromValue(txData.stake),
            publicKey: txData.publicKey || ""
        });

        // 2. Build Transaction Message
        const transaction = PactusProto.TransactionMessage.create({
            lockTime: txData.lockTime,
            fee: Long.fromValue(txData.fee),
            memo: txData.memo || "",
            bond: bondPayload
        });

        // 3. Build Signing Input
        const input = PactusProto.SigningInput.create({
            privateKey: HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey),
            transaction: transaction
        });

        // --- Input Verification ---
        if (PactusProto.SigningInput.verify(input)) throw new Error("Pactus Input Error");

        // 4. Sign
        const outputBytes = AnySigner.sign(PactusProto.SigningInput.encode(input).finish(), coinType);
        const output = PactusProto.SigningOutput.decode(outputBytes);

        // --- Output Verification ---
        const outputVerifyError = PactusProto.SigningOutput.verify(output);
        if (outputVerifyError) {
            throw new Error(`Pactus Output Error: ${outputVerifyError}`);
        }
        if (output.errorMessage || output.error) {
            throw new Error(`Pactus Signing Logic Error: ${output.errorMessage || output.error}`);
        }

        return {
            encoded: HexCoding.encode(output.signedTransactionData),
            extend: {
                transactionId: HexCoding.encode(output.transactionId),
                signature: HexCoding.encode(output.signature),
                json: output.toJSON(),
            }
        };
    }
}

module.exports = PactusSigner;