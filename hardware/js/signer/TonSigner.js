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
const { Buffer } = require('buffer');

/**
 * Universal signing result
 * @typedef {Object} SignerResult
 * @property {string} encoded   - [Required] Final signed data (Hex/Base64/JSON), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data (e.g. txid, signature, rawTx etc.), for recording or debugging purposes only
 */
class TonSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Core utility: Smart number converter
     * Unifies user input decimal (String/Number) or hexadecimal (0xString) into Buffer
     * @param val
     * @returns {*}
     * @private
     */
    _toBuffer(val) {
        if (val === undefined || val === null) return Buffer.from([]);
        let hex = '';
        try {
            // BigInt constructor is powerful:
            // BigInt(10) -> 10n
            // BigInt("10") -> 10n
            // BigInt("0x0a") -> 10n
            const bigIntVal = BigInt(val);
            hex = bigIntVal.toString(16);
        } catch (e) {
            // Fault tolerance: If user insists on passing raw Hex string without 0x (e.g., official test case "0A" "1DCD6500")
            // BigInt("0A") throws error, so we do a fallback here
            if (typeof val === 'string') {
                hex = val;
            } else {
                throw new Error(`Invalid numeric format: ${val}`);
            }
        }

        // Pad to even length (0xa -> 0x0a)
        if (hex.length % 2 !== 0) hex = '0' + hex;
        return Buffer.from(hex, 'hex');
    }

    /**
     * TON Transfer Signing (Native & Jetton)
     *
     * @param {Object} txData - Transaction parameters
     * @param {string} txData.privateKey - Hex Private Key
     * @param {number} txData.sequenceNumber - Wallet Sequence
     * @param {number} txData.timestamp - Timestamp
     * @param {string} txData.toAddress - Recipient address
     * @param {number} txData.amount - Transfer amount (NanoTON), recommended to pass decimal string "1000000000"
     * @param {string} [txData.comment] - (Optional) Comment
     * @param {boolean} [txData.isJetton=false] - Whether it is a Jetton transfer
     * @param {Object} [txData.jetton] - Jetton parameters
     * @param {number} txData.jetton.jettonAmount - Jetton amount (smallest unit), recommended to pass decimal string
     * @param {string} txData.jetton.toOwner - Jetton actual recipient
     * @param {string} txData.jetton.responseAddress - Response address
     * @param {number} [txData.jetton.forwardAmount="1"] - Forward TON amount (NanoTON)
     * @param coinType
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.ton) {
        const { AnySigner, HexCoding } = this.core;
        const Ton = TW.TheOpenNetwork.Proto;

        // 1. Build Transfer Message
        const transferObj = {
            dest: txData.toAddress,
            amount: this._toBuffer(txData.amount), // Auto handle decimal
            mode: txData.sendMode,
            bounceable: false
        };

        if (txData.comment) {
            transferObj.comment = txData.comment;
        }

        // 2. Jetton logic
        if (txData.isJetton && txData.jetton) {
            transferObj.jettonTransfer = Ton.JettonTransfer.create({
                jettonAmount: this._toBuffer(txData.jetton.jettonAmount),
                toOwner: txData.jetton.toOwner,
                responseAddress: txData.jetton.responseAddress,
                forwardAmount: this._toBuffer(txData.jetton.forwardAmount || 1)
            });
        }

        const transfer = Ton.Transfer.create(transferObj);

        // 3. SigningInput
        const input = Ton.SigningInput.create({
            messages: [transfer],
            privateKey: HexCoding.decode(txData.privateKey),
            sequenceNumber: txData.sequenceNumber,
            expireAt: Math.floor(txData.timestamp / 1000) + 3600,
            walletVersion: Ton.WalletVersion.WALLET_V4_R2
        });

        // Input verification
        const inputError = Ton.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Ton Input Verification Failed: ${inputError}`);
        }

        // 4. Sign
        const encodedInput = Ton.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
        const output = Ton.SigningOutput.decode(outputBytes);

        // Output verification
        const outputError = Ton.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Ton Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Ton Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.encoded,
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = TonSigner;