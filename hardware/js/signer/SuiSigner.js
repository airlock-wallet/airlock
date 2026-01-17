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
class SuiSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    toLong(val) {
        if (val === undefined || val === null) return Long.fromNumber(0);
        if (Long.isLong(val)) return val;
        return Long.fromValue(val);
    }

    /**
     * Sui transaction signing
     * Usually returned by Tatum API or Sui SDK build()
     * @param {Object} txData - Transaction data
     * @param {string} txData.privateKey - Private key in Hex format (0x...)
     * @param {Object[]} txData.utxos - Transaction data to be signed
     * @param coinType - Coin type (default ETH, for BSC pass CoinType.smartChain)
     * @returns {SignerResult} - Signature in Base64 format
     */
    signTransfer(txData, coinType = this.core.CoinType.sui) {
        const {AnySigner, HexCoding} = this.core;
        const Sui = TW.Sui.Proto;

        // 1. Process Private Key
        // Ensure private key is Hex Buffer
        const privateKey = HexCoding.decode(txData.privateKey);

        // 2. Convert Input Coins (ObjectRef)
        // Frontend passes [{objectId, version, objectDigest}, ...]
        const inputCoins = txData.utxos.map(c => {
            return Sui.ObjectRef.create({
                objectId: c.objectId, // Hex String
                version: this.toLong(c.version), // uint64
                objectDigest: c.objectDigest // Base58 String
            });
        });

        // 3. Build PaySui Message (Standard Transfer)
        const paySui = Sui.PaySui.create({
            inputCoins: inputCoins,
            recipients: [txData.toAddress],
            amounts: [this.toLong(txData.amount)]
        });

        // 4. Build SigningInput
        const input = Sui.SigningInput.create({
            paySui: paySui, // Use PaySui mode instead of SignDirect
            privateKey: privateKey,
            gasBudget: this.toLong(txData.gasLimit),
            referenceGasPrice: this.toLong(txData.gasPrice)
        });

        // Verify input
        const inputError = Sui.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Sui Input Verification Failed: ${inputError}`);
        }

        // 2. Encode Input
        const encoded = Sui.SigningInput.encode(input).finish();

        // 3. Sign (CoinType.sui)
        const outputBytes = AnySigner.sign(encoded, coinType);

        // 4. Decode Output
        const output = Sui.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Sui.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Sui Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Sui Signing Logic Error: ${msg}`);
        }

        // Assemble object
        const result = {signature: output.signature, txBytes: output.unsignedTx}

        // Sui signature result is usually a Base64 string directly
        return {
            encoded: JSON.stringify(result),
            extend: {
                json: output.toJSON(),
            }
        };
    }

    /**
     * Get Sui Address (Helper method)
     * Sui uses Ed25519 algorithm by default to generate addresses
     */
    getAddress(privateKeyHex) {
        const {CoinType, HexCoding, AnyAddress, PrivateKey} = this.core;
        const key = PrivateKey.createWithData(HexCoding.decode(privateKeyHex));
        // Sui uses Ed25519 public key
        const pubKey = key.getPublicKeyEd25519();
        const address = AnyAddress.createWithPublicKey(pubKey, CoinType.sui);
        return address.description();
    }
}

module.exports = SuiSigner;