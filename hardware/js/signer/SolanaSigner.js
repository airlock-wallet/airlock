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
class SolanaSigner {
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
     * 1. Sign SOL main coin transfer
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - Private key in Hex format
     * @param {string} txData.toAddress - Recipient address (Base58)
     * @param {string|number} txData.amount - Amount (Lamports, 1 SOL = 10^9)
     * @param {string} txData.recentBlockhash - Recent blockhash (Base58)
     * @param {string} [txData.memo] - Memo
     * @returns {SignerResult} - Base64 signing result
     */
    signTransfer(txData, coinType = this.core.CoinType.solana) {
        const {AnySigner, HexCoding} = this.core;
        const Solana = TW.Solana.Proto;

        const input = Solana.SigningInput.create({
            transferTransaction: Solana.Transfer.create({
                recipient: txData.toAddress,
                value: this._toLong(txData.amount),
                memo: txData.memo
            }),
            recentBlockhash: txData.recentBlockhash,
            privateKey: HexCoding.decode(txData.privateKey)
        });

        // Verify input
        const inputError = Solana.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Solana Input Verification Failed: ${inputError}`);
        }

        const encodedInput = Solana.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
        const output = Solana.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Solana.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Solana Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Solana Signing Logic Error: ${msg}`);
        }

        return {encoded: output.encoded, extend: {json: output.toJSON()}};
    }

    /**
     * 2. Sign SPL Token transfer
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - Hex Private Key
     * @param {string} txData.mintAddress - Token Mint Address
     * @param {string} txData.senderTokenAddress - Sender Token Account Address (Note: NOT the main account!)
     * @param {string} txData.toTokenAddress - Recipient Token Account Address
     * @param {string|number} txData.amount - Token Amount (Raw units)
     * @param {number} txData.decimals - Token Decimals
     * @param {string} txData.recentBlockhash - Blockhash
     * @returns {SignerResult}
     */
    signTokenTransfer(txData, coinType = this.core.CoinType.solana) {
        const {AnySigner, HexCoding} = this.core;
        const Solana = TW.Solana.Proto;

        const input = Solana.SigningInput.create({
            tokenTransferTransaction: Solana.TokenTransfer.create({
                tokenMintAddress: txData.mintAddress,
                senderTokenAddress: txData.senderTokenAddress,
                recipientTokenAddress: txData.toTokenAddress,
                amount: this._toLong(txData.amount),
                decimals: txData.decimals
            }),
            recentBlockhash: txData.recentBlockhash,
            privateKey: HexCoding.decode(txData.privateKey)
        });

        // Verify input
        const inputError = Solana.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Solana Input Verification Failed: ${inputError}`);
        }

        const encodedInput = Solana.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
        const output = Solana.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Solana.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Solana Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Solana Signing Logic Error: ${msg}`);
        }

        return {encoded: output.encoded, extend: {json: output.toJSON()}};
    }

    /**
     * Sign CreateTokenAccount (Activate Token Account)
     * @param txData
     * @param coinType
     * @returns {SignerResult}
     */
    signCreateTokenAccount(txData, coinType = this.core.CoinType.solana) {
        const {AnySigner, HexCoding} = this.core;
        const Solana = TW.Solana.Proto;

        const input = Solana.SigningInput.create({
            createTokenAccountTransaction: Solana.CreateTokenAccount.create({
                mainAddress: txData.mainAddress, // Main Account
                tokenMintAddress: txData.mintAddress, // Token Mint
                tokenAddress: txData.tokenAddress // Token Account Address to create
            }),
            recentBlockhash: txData.recentBlockhash,
            privateKey: HexCoding.decode(txData.privateKey)
        });

        // Verify input
        const inputError = Solana.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Solana Input Verification Failed: ${inputError}`);
        }

        const encodedInput = Solana.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
        const output = Solana.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Solana.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Solana Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Solana Signing Logic Error: ${msg}`);
        }

        return {encoded: output.encoded, extend: {json: output.toJSON()}};
    }

    /**
     * Sign CreateAndTransferToken (Create Account and Transfer - Composite Operation)
     * This is an advanced operation, usually used to transfer tokens to someone who doesn't have a Token Account
     * @param txData
     * @param coinType
     * @returns {SignerResult}
     */
    signCreateAndTransferToken(txData, coinType = this.core.CoinType.solana) {
        const {AnySigner, HexCoding} = this.core;
        const Solana = TW.Solana.Proto;

        const input = Solana.SigningInput.create({
            createAndTransferTokenTransaction: Solana.CreateAndTransferToken.create({
                recipientMainAddress: txData.toMainAddress, // Recipient Main Account
                tokenMintAddress: txData.mintAddress,
                recipientTokenAddress: txData.toTokenAddress, // Recipient Token Account (Derived)
                senderTokenAddress: txData.senderTokenAddress,
                amount: this._toLong(txData.amount),
                decimals: txData.decimals
            }),
            recentBlockhash: txData.recentBlockhash,
            privateKey: HexCoding.decode(txData.privateKey)
        });

        // Verify input
        const inputError = Solana.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Solana Input Verification Failed: ${inputError}`);
        }

        const encodedInput = Solana.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encodedInput, coinType);
        const output = Solana.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Solana.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Solana Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Solana Signing Logic Error: ${msg}`);
        }

        return {encoded: output.encoded, extend: {json: output.toJSON()}};
    }
}

module.exports = SolanaSigner;