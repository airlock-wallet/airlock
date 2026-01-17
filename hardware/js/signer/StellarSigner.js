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
 * @property {string} encoded   - [Required] Final signed data (Base64 String)
 * @property {Object} [extend]  - [Optional] Extended data
 */
class StellarSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Scenario 1: Standard Transfer Payment (OperationPayment)
     * Corresponding test: testStellarTransactionSigning
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {string} txData.toAddress  - [Required] Recipient address (G...)
     * @param {string} txData.amount     - [Required] Decimal amount (Stroops)
     * @param {number} txData.fee        - [Required] Fee
     * @param {number} txData.sequence   - [Required] Sequence number
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.stellar) {
        const { AnySigner, HexCoding, PrivateKey, AnyAddress, CoinType, describeStellarPassphrase, StellarPassphrase } = this.core;
        const StellarProto = TW.Stellar.Proto;

        // 1. Private key parsing and address auto-derivation
        const pkData = HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey);
        const pk = PrivateKey.createWithData(pkData);
        if (!pk) throw new Error("StellarSigner: Invalid Private Key");

        // Derive From address from private key (Ed25519)
        const fromAddress = AnyAddress.createWithPublicKey(pk.getPublicKeyEd25519(), coinType).description();

        // 2. Construct SigningInput
        const input = StellarProto.SigningInput.create({
            account: fromAddress,
            fee: txData.fee,
            sequence: Long.fromValue(txData.sequence),
            passphrase: describeStellarPassphrase(StellarPassphrase.stellar),
            privateKey: pkData,
            opPayment: StellarProto.OperationPayment.create({
                destination: txData.toAddress,
                amount: Long.fromString(String(txData.amount))
            })
        });

        // Verify input
        const inputError = StellarProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Stellar Input Verification Failed: ${inputError}`);
        }

        const outputBytes = AnySigner.sign(StellarProto.SigningInput.encode(input).finish(), coinType);
        const output = StellarProto.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = StellarProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Stellar Output Verification Failed: ${outputError}`);
        }
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Stellar Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.signature,
            extend: {
                json: output.toJSON(),
            }
        };
    }

    /**
     * Scenario 2: Asset Trust Interaction (OperationChangeTrust)
     * Corresponding test: testStellarTransactionSigningChangeTrust
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey  - [Required] Private key (Hex)
     * @param {string} txData.assetIssuer - [Required] Asset issuer address
     * @param {string} txData.assetCode   - [Required] Asset code (e.g. "MOBI")
     * @param {number} txData.fee         - [Required] Fee
     * @param {number} txData.sequence    - [Required] Sequence number (Long)
     * @param {number} txData.validBefore - [Required] Expiration time (Long)
     * @returns {SignerResult}
     */
    signChangeTrust(txData, coinType = this.core.CoinType.stellar) {
        const { AnySigner, HexCoding, PrivateKey, AnyAddress, CoinType, StellarPassphrase, describeStellarPassphrase} = this.core;
        const StellarProto = TW.Stellar.Proto;

        const pkData = HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey);
        const pk = PrivateKey.createWithData(pkData);
        if (!pk) throw new Error("StellarSigner: Invalid Private Key");

        const fromAddress = AnyAddress.createWithPublicKey(pk.getPublicKeyEd25519(), coinType).description();

        const input = StellarProto.SigningInput.create({
            account: fromAddress,
            fee: txData.fee,
            sequence: Long.fromValue(txData.sequence),
            passphrase: describeStellarPassphrase(StellarPassphrase.stellar),
            privateKey: pkData,
            opChangeTrust: StellarProto.OperationChangeTrust.create({
                asset: StellarProto.Asset.create({
                    issuer: txData.assetIssuer,
                    alphanum4: txData.assetCode
                }),
                // If testing, pass 1613336576; if production, pass 0 or future timestamp
                validBefore: txData.validBefore || 0
            })
        });

        // Verify input
        const inputError = StellarProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Stellar Input Verification Failed: ${inputError}`);
        }

        const outputBytes = AnySigner.sign(StellarProto.SigningInput.encode(input).finish(), coinType);
        const output = StellarProto.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = StellarProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Stellar Output Verification Failed: ${outputError}`);
        }
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Stellar Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.signature,
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = StellarSigner;