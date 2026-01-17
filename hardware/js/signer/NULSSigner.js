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
const { Buffer } = require('buffer');

/**
 * Universal signing result
 * @typedef {Object} SignerResult
 * @property {string} encoded   - [Required] Final signed data (Hex String)
 * @property {Object} [extend]  - [Optional] Extended data
 */
class NULSSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * @private
     */
    _toByteString(val) {
        if (!val) return new Uint8Array([]);
        const { HexCoding } = this.core;
        if (typeof val === 'string') {
            if (val.startsWith('0x')) return HexCoding.decode(val.slice(2));
            return new Uint8Array(Buffer.from(val));
        }
        return new Uint8Array(val);
    }

    /**
     * Scenario 1: Standard NULS Transfer (NULSTransactionSigning)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {string} txData.from       - Sender address
     * @param {string} txData.to         - Recipient address
     * @param {string} txData.amount     - Amount (Hex, e.g. 0x989680)
     * @param {number} [txData.chainId=1] - Chain ID
     * @param {string} txData.nonce      - Nonce (16-bit placeholder or Hex)
     * @param {string} txData.balance    - Balance (Hex)
     * @param {number} txData.timestamp  - Timestamp
     * @param {string} [txData.remark=""] - Remark
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.nuls) {
        return this._executeSign(txData, coinType);
    }

    /**
     * Scenario 2: NULS Token Transfer (NULSTokenTransactionSigning)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey      - [Required] Private key (Hex)
     * @param {string} txData.from            - Sender address
     * @param {string} txData.to              - Recipient address
     * @param {string} txData.amount          - Amount (Hex)
     * @param {number} [txData.chainId=9]     - Token Chain ID
     * @param {string} txData.nonce           - Nonce
     * @param {string} txData.balance         - Balance (Hex)
     * @param {number} txData.timestamp       - Timestamp
     * @param {string} txData.feePayer        - Fee payer address (usually same as From)
     * @param {string} txData.feePayerBalance - Fee payer balance (Hex)
     * @param {string} txData.feePayerNonce   - Fee payer Nonce
     * @returns {SignerResult}
     */
    signToken(txData, coinType = this.core.CoinType.nuls) {
        return this._executeSign({ ...txData, chainId: txData.chainId || 9 }, coinType);
    }

    /**
     * Scenario 3: Standard Transfer with 3rd Party Fee Payer (NULSTransactionWithFeePayerSigning)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey          - [Required] Signing private key (Hex)
     * @param {string} txData.from                - Sender address
     * @param {string} txData.to                  - Recipient address
     * @param {string} txData.amount              - Amount (Hex)
     * @param {string} txData.nonce               - Nonce
     * @param {string} txData.balance             - Balance (Hex)
     * @param {number} txData.timestamp           - Timestamp
     * @param {string} txData.feePayer            - 3rd party fee payer address
     * @param {string} txData.feePayerBalance     - Fee payer balance (Hex)
     * @param {string} txData.feePayerNonce       - Fee payer Nonce
     * @param {string} txData.feePayerPrivateKey  - Fee payer private key (Hex)
     * @returns {SignerResult}
     */
    signStandardWithFeePayer(txData, coinType = this.core.CoinType.nuls) {
        return this._executeSign(txData, coinType);
    }

    /**
     * Scenario 4: Token Transfer with 3rd Party Fee Payer (NULSTokenTransactionWithFeePayerSigning)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey          - [Required] Signing private key (Hex)
     * @param {string} txData.from                - Sender address
     * @param {string} txData.to                  - Recipient address
     * @param {string} txData.amount              - Amount (Hex)
     * @param {number} [txData.chainId=9]         - Token Chain ID
     * @param {string} txData.nonce               - Nonce
     * @param {string} txData.balance             - Balance (Hex)
     * @param {number} txData.timestamp           - Timestamp
     * @param {string} txData.feePayer            - 3rd party fee payer address
     * @param {string} txData.feePayerBalance     - Fee payer balance (Hex)
     * @param {string} txData.feePayerNonce       - Fee payer Nonce
     * @param {string} txData.feePayerPrivateKey  - Fee payer private key (Hex)
     * @returns {SignerResult}
     */
    signTokenWithFeePayer(txData, coinType = this.core.CoinType.nuls) {
        return this._executeSign({ ...txData, chainId: txData.chainId || 9 }, coinType);
    }

    /**
     * Internal method
     * @param txData
     * @param coinType
     * @return {{extend: {}, encoded: string}}
     * @private
     */
    _executeSign(txData, coinType = this.core.CoinType.nuls) {
        const { AnySigner, HexCoding } = this.core;
        const NULSProto = TW.NULS.Proto;

        const input = NULSProto.SigningInput.create({
            privateKey: HexCoding.decode(txData.privateKey),
            from: txData.from,
            to: txData.to,
            amount: this._toByteString(txData.amount),
            chainId: txData.chainId || 1,
            idassetsId: txData.idassetsId || 1,
            nonce: this._toByteString(txData.nonce),
            remark: txData.remark || "",
            balance: this._toByteString(txData.balance),
            timestamp: txData.timestamp,
            feePayer: txData.feePayer || "",
            feePayerBalance: this._toByteString(txData.feePayerBalance),
            feePayerNonce: this._toByteString(txData.feePayerNonce),
            feePayerPrivateKey: txData.feePayerPrivateKey ? HexCoding.decode(txData.feePayerPrivateKey) : new Uint8Array([])
        });

        // Input verification
        const inputError = NULSProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`NULSProto Input Verification Failed: ${input}`);
        }

        const outputBytes = AnySigner.sign(NULSProto.SigningInput.encode(input).finish(), coinType);
        const output = NULSProto.SigningOutput.decode(outputBytes);

        // Output verification
        const outputError = NULSProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`NULSProto Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`NULSProto Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON(),
            }
        };
    }
}

module.exports = NULSSigner;