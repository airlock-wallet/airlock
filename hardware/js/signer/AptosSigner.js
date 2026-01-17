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
class AptosSigner {
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
     * Sign Aptos transfer transaction
     * @param {Object} txData - Transaction parameters
     * @param {string} txData.privateKey - Hex format private key
     * @param {string} txData.fromAddress - Sender address (Hex string)
     * @param {string} txData.toAddress - Recipient address (Hex string)
     * @param {string|number} txData.amount - Transfer amount (Octas, 1 APT = 10^8 Octas)
     * @param {string|number} txData.sequenceNumber - Transaction sequence number (similar to Nonce)
     * @param {string|number} txData.expirationTimestampSecs - Expiration timestamp (seconds)
     * @param {number} [txData.chainId=1] - Chain ID (Mainnet=1)
     * @param {string|number} [txData.gasUnitPrice=100] - Gas unit price
     * @param {string|number} [txData.maxGasAmount=2000] - Max Gas limit
     * @param coinType - Coin type (Aptos=637)
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.aptos) {
        const { AnySigner, HexCoding } = this.core;
        const Aptos = TW.Aptos.Proto;

        // 1. Build SigningInput
        const input = Aptos.SigningInput.create({
            chainId: txData.chainId || 1,
            sender: txData.fromAddress,
            sequenceNumber: this._toLong(txData.sequenceNumber),
            expirationTimestampSecs: this._toLong(txData.expirationTimestampSecs),
            gasUnitPrice: this._toLong(txData.gasUnitPrice || 100),
            maxGasAmount: this._toLong(txData.maxGasAmount || 2000),
            privateKey: HexCoding.decode(txData.privateKey),
            // Set Transfer Payload
            transfer: Aptos.TransferMessage.create({
                to: txData.toAddress,
                amount: this._toLong(txData.amount)
            })
        });

        // Verify input
        const inputError = Aptos.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Aptos Input Verification Failed: ${inputError}`);
        }

        // 2. Encode and Sign
        const encodedInput = Aptos.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
        const output = Aptos.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Aptos.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Aptos Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Aptos Signing Logic Error: ${msg}`);
        }

        // 3. Return result
        // Aptos needs to return more fields for different scenarios
        return {
            encoded: HexCoding.encode(output.encoded), // Complete transaction Hex containing the signature
            extend: {
                rawTxn: HexCoding.encode(output.rawTxn),   // Unsigned raw transaction Hex (used for simulation/Debug)
                // The signature part might be in the authenticator object, add a null check
                signature: output.authenticator ? HexCoding.encode(output.authenticator.signature) : "",
                json: output.toJSON()
            }
        };
    }
}

module.exports = AptosSigner;