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
class IcpSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Convert input to Long object
     */
    _toLong(val) {
        if (val === undefined || val === null) return Long.fromNumber(0);
        if (Long.isLong(val)) return val;
        return Long.fromValue(val);
    }

    /**
     * Internet Computer (ICP) transfer signing
     * * @param {Object} txData - Transaction parameters
     * @param {string} txData.privateKey - Hex format private key
     * @param {string} txData.toAccountIdentifier - Recipient Account ID (Hex string, 64 chars)
     * @param {string|number} txData.amount - Transfer amount (e8s, 1 ICP = 10^8 e8s)
     * @param {string|number} [txData.memo=0] - Memo, used for exchange deposits etc.
     * @param {string|number} [txData.timestamp] - Nanosecond timestamp. If not passed, use current time.
     * @param coinType - Coin type (ICP=714)
     * @returns {SignerResult} - Returns Hex encoded Signed Envelope
     */
    signTransfer(txData, coinType = this.core.CoinType.internetComputer) {
        const { AnySigner, HexCoding } = this.core;
        const ICP = TW.InternetComputer.Proto;

        // 1. Process timestamp (nanoseconds)
        const nowNanos = BigInt(txData.timestamp) * BigInt(1000000);
        const timestampLong = Long.fromString(nowNanos.toString());

        // 2. Build SigningInput
        const input = ICP.SigningInput.create({
            transaction: ICP.Transaction.create({
                transfer: ICP.Transaction.Transfer.create({
                    toAccountIdentifier: txData.toAccountIdentifier,
                    amount: this._toLong(txData.amount),
                    memo: this._toLong(txData.memo || 0),
                    currentTimestampNanos: timestampLong
                })
            }),
            privateKey: HexCoding.decode(txData.privateKey)
        });

        // Verify input
        const inputError = ICP.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`ICP Input Verification Failed: ${inputError}`);
        }

        // 3. Sign
        const encodedInput = ICP.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
        const output = ICP.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = ICP.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`ICP Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`ICP Signing Logic Error: ${msg}`);
        }

        return {
            // This is the final Hex string for broadcasting (contains Request ID, Public Key, Signature etc.)
            encoded: HexCoding.encode(output.signedTransaction),
            extend: {
                json: output.toJSON(),
            }
        };
    }

    /**
     * Get ICP Account Identifier from private key
     * (Helper method, used for testing address verification)
     */
    getAddress(privateKeyHex) {
        const { PrivateKey, HexCoding, AnyAddress, CoinType } = this.core;
        const pk = PrivateKey.createWithData(HexCoding.decode(privateKeyHex));
        const pubKey = pk.getPublicKeySecp256k1(false); // ICP uses uncompressed public key? It's false in official tests
        const address = AnyAddress.createWithPublicKey(pubKey, CoinType.internetComputer);
        return address.description();
    }
}

module.exports = IcpSigner;