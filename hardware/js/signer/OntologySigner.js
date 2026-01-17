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
 * @property {string} encoded   - [Required] Final signed data (Hex String)
 * @property {Object} [extend]  - [Optional] Extended data
 */
class OntologySigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Scenario 1: Query balance (ONT/ONG balanceOf)
     * Independent Logic: Does not enforce private key validation, focuses on constructing query Payload
     * @param {Object} txData
     * @param {string} txData.contract      - Contract name ("ONT" or "ONG")
     * @param {string} txData.method        - Method name ("balanceOf")
     * @param {string} txData.queryAddress   - Query address
     * @param {number} txData.nonce         - Nonce (UInt32)
     * @param coinType
     * @returns {SignerResult}
     */
    signQuery(txData, coinType = this.core.CoinType.ontology) {
        const { AnySigner, HexCoding } = this.core;
        const OntologyProto = TW.Ontology.Proto;

        // 1. Strict parameter preprocessing
        const safeNonce = txData.nonce >>> 0;

        // 2. Construct Query Specific SigningInput (Amount, Gas, Private Key not needed for query)
        const input = OntologyProto.SigningInput.create({
            contract: txData.contract,
            method: txData.method,
            nonce: safeNonce,
            queryAddress: txData.queryAddress || "",
            // In query scenario, private keys, amount, gas default to empty/zero
            amount: Long.ZERO,
            gasPrice: Long.ZERO,
            gasLimit: Long.ZERO,
            ownerPrivateKey: new Uint8Array([]),
            payerPrivateKey: new Uint8Array([])
        });

        // Input verification
        const inputError = OntologyProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`ontology Input Verification Failed: ${inputError}`);
        }

        // 3. Execute signing and output
        const inputEncoded = OntologyProto.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(inputEncoded, coinType);
        const output = OntologyProto.SigningOutput.decode(outputBytes);

        // Output verification
        const outputVerifyError = OntologyProto.SigningOutput.verify(output);
        if (outputVerifyError) {
            throw new Error(`ontology Output Verification Failed: ${outputVerifyError}`);
        }

        // Business logic error verification
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`ontology Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON(),
            }
        };
    }

    /**
     * Scenario 2: Asset Transfer (ONT/ONG transfer)
     * Independent Logic: Enforces validation for all private keys and amount parameters, focuses on constructing transaction Payload
     * @param {Object} txData
     * @param {string} txData.contract           - Contract name ("ONT" or "ONG")
     * @param {string} txData.method            - Method name ("transfer")
     * @param {string} txData.ownerPrivateKey   - Sender private key (Hex)
     * @param {string} txData.payerPrivateKey   - Payer private key (Hex)
     * @param {string} txData.toAddress         - Recipient address
     * @param {number|string} txData.amount     - Amount
     * @param {number} txData.gasPrice          - Gas Price
     * @param {number} txData.gasLimit          - Gas Limit
     * @param {number} txData.nonce             - Nonce
     * @param coinType
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.ontology) {
        const { AnySigner, HexCoding } = this.core;
        const OntologyProto = TW.Ontology.Proto;

        // 1. Mandatory parameter validation: Transfers must have keys
        if (!txData.ownerPrivateKey) throw new Error("signTransfer: ownerPrivateKey is required.");
        if (!txData.payerPrivateKey) throw new Error("signTransfer: payerPrivateKey is required.");

        // 2. Strict parameter preprocessing
        const safeNonce = txData.nonce >>> 0;
        const safeAmount = Long.fromValue(txData.amount || 0);
        const safeGasPrice = Long.fromValue(txData.gasPrice || 0);
        const safeGasLimit = Long.fromValue(txData.gasLimit || 0);

        const decodeKey = (key) => {
            const clean = key.startsWith('0x') ? key.slice(2) : key;
            return HexCoding.decode(clean);
        };

        // 3. Construct Transfer Specific SigningInput
        const input = OntologyProto.SigningInput.create({
            contract: txData.contract,
            method: txData.method,
            nonce: safeNonce,
            toAddress: txData.toAddress,
            amount: safeAmount,
            gasPrice: safeGasPrice,
            gasLimit: safeGasLimit,
            ownerPrivateKey: decodeKey(txData.ownerPrivateKey),
            payerPrivateKey: decodeKey(txData.payerPrivateKey),
            queryAddress: ""
        });

        // Input verification
        const inputError = OntologyProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`ontology Input Verification Failed: ${inputError}`);
        }

        // 4. Execute signing and output
        const inputEncoded = OntologyProto.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(inputEncoded, coinType);
        const output = OntologyProto.SigningOutput.decode(outputBytes);

        // Output verification
        const outputVerifyError = OntologyProto.SigningOutput.verify(output);
        if (outputVerifyError) {
            throw new Error(`ontology Output Verification Failed: ${outputVerifyError}`);
        }

        // Business logic error verification
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`ontology Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = OntologySigner;