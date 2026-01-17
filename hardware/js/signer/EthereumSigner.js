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
class EthereumSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    // ==========================================
    // Core Utility: Universal Buffer Converter
    // WalletCore ETH signing requires Amount/Gas/Nonce to be Buffer
    // Supports input: 10 (number), "10" (string), "0x0a" (Hex)
    // ==========================================
    _toBuffer(val) {
        if (val === undefined || val === null) return Buffer.from([]);

        let hex = '';
        if (typeof val === 'number') {
            hex = val.toString(16);
        } else if (typeof val === 'string') {
            if (val.startsWith('0x')) {
                hex = val.slice(2);
            } else {
                // Assuming it's a decimal string, convert to Hex
                // If it's already Hex but without 0x, business layer needs to ensure, or use BigInt uniformly
                // For generality, handle Hex string here (e.g. nonce "0x9" from API)
                try {
                    hex = BigInt(val).toString(16);
                } catch (e) {
                    hex = val; // Fallback
                }
            }
        }

        // Pad to even length, otherwise Buffer.from will error
        if (hex.length % 2 !== 0) hex = '0' + hex;
        return Buffer.from(hex, 'hex');
    }

    /**
     * 1. Native Transfer
     * Applicable to ETH, BNB(BSC), MATIC, AVAX and all other EVM chain main coins
     * @param {Object} txData - Transaction data
     * @param {string} txData.privateKey - Hex format private key
     * @param {string} txData.toAddress - Recipient address (0x...)
     * @param {string|number} txData.amount - Transfer amount (Wei), supports Hex("0x1") or number
     * @param {number} txData.chainId - Chain ID (e.g. ETH=1, BSC=56)
     * @param {number|string} txData.nonce - Transaction Nonce
     * @param {number|string} txData.gasLimit - Gas Limit (e.g. 21000)
     * @param {string} [txData.gasPrice] - (Legacy) Gas Price (Wei)
     * @param {string} [txData.maxFeePerGas] - (EIP1559) Max Gas Fee
     * @param {string} [txData.maxInclusionFeePerGas] - (EIP1559) Priority Fee
     * @param coinType - Coin type (Default ETH, pass CoinType.smartChain for BSC)
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.ethereum) {
        const { HexCoding, AnySigner } = this.core;
        const Ethereum = TW.Ethereum.Proto;

        // 1. Build Transaction Body
        const transaction = Ethereum.Transaction.create({
            transfer: Ethereum.Transaction.Transfer.create({
                amount: this._toBuffer(txData.amount)
            })
        });

        // 2. Build Input
        const inputObj = {
            toAddress: txData.toAddress,
            chainId: this._toBuffer(txData.chainId),
            nonce: this._toBuffer(txData.nonce),
            gasLimit: this._toBuffer(txData.gasLimit),
            transaction: transaction,
            privateKey: HexCoding.decode(txData.privateKey)
        };

        // 3. Determine EIP1559 or Legacy
        if (txData.maxFeePerGas || txData.maxInclusionFeePerGas) {
            // EIP1559 Mode
            inputObj.txMode = Ethereum.TransactionMode.Enveloped;
            inputObj.maxFeePerGas = this._toBuffer(txData.maxFeePerGas);
            inputObj.maxInclusionFeePerGas = this._toBuffer(txData.maxInclusionFeePerGas);
        } else {
            // Legacy Mode
            inputObj.gasPrice = this._toBuffer(txData.gasPrice);
        }

        // Verify input
        const inputError = Ethereum.SigningInput.verify(inputObj);
        if (inputError) {
            throw new Error(`Ethereum Input Verification Failed: ${inputError}`);
        }

        const input = Ethereum.SigningInput.create(inputObj);
        const encoded = Ethereum.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encoded, coinType);
        const output = Ethereum.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Ethereum.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Ethereum Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Ethereum Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                v: HexCoding.encode(output.v),
                r: HexCoding.encode(output.r),
                s: HexCoding.encode(output.s),
                json: output.toJSON(),
            }
        };
    }

    /**
     * 2. Token Transfer (ERC20 / BEP20)
     * @param {Object} txData - Transaction data
     * @param {string} txData.privateKey - Private key
     * @param {string} txData.contractAddress - Token contract address (USDT etc.)
     * @param {string} txData.toAddress - Token recipient
     * @param {string|number} txData.amount - Token amount (Note precision! Convert manually)
     * @param {number} txData.chainId - Chain ID
     * @param {number|string} txData.nonce - Nonce
     * @param {number|string} txData.gasLimit - Gas Limit (Recommended 60000+)
     * @param {string} [txData.gasPrice] - (Legacy) Gas Price
     * @param {string} [txData.maxFeePerGas] - (EIP1559) Max Fee
     * @param {string} [txData.maxInclusionFeePerGas] - (EIP1559) Priority Fee
     * @param coinType - Coin type (Default ETH, pass CoinType.smartChain for BSC)
     * @returns {SignerResult}
     */
    signErc20Transfer(txData, coinType = this.core.CoinType.ethereum) {
        const { HexCoding, AnySigner, CoinType } = this.core;
        const Ethereum = TW.Ethereum.Proto;

        // 1. Build ERC20 Body
        const transaction = Ethereum.Transaction.create({
            erc20Transfer: Ethereum.Transaction.ERC20Transfer.create({
                to: txData.toAddress, // Token recipient
                amount: this._toBuffer(txData.amount)
            })
        });

        // 2. Build Input
        const inputObj = {
            toAddress: txData.contractAddress, // Note: Fill contract address here!
            chainId: this._toBuffer(txData.chainId),
            nonce: this._toBuffer(txData.nonce),
            gasLimit: this._toBuffer(txData.gasLimit),
            transaction: transaction,
            privateKey: HexCoding.decode(txData.privateKey)
        };

        // 3. EIP1559 / Legacy Check
        if (txData.maxFeePerGas || txData.maxInclusionFeePerGas) {
            inputObj.txMode = Ethereum.TransactionMode.Enveloped;
            inputObj.maxFeePerGas = this._toBuffer(txData.maxFeePerGas);
            inputObj.maxInclusionFeePerGas = this._toBuffer(txData.maxInclusionFeePerGas);
        } else {
            inputObj.gasPrice = this._toBuffer(txData.gasPrice);
        }

        // Verify input
        const inputError = Ethereum.SigningInput.verify(inputObj);
        if (inputError) {
            throw new Error(`Ethereum Input Verification Failed: ${inputError}`);
        }

        const input = Ethereum.SigningInput.create(inputObj);
        const encoded = Ethereum.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encoded, coinType);
        const output = Ethereum.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Ethereum.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Ethereum Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Ethereum Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON(),
            }
        };
    }

    // ==========================================
    // 3. Personal Message Signing (Personal Message / EIP191)
    // ==========================================
    signMessage(privateKeyHex, messageText) {
        const { HexCoding, Hash, PrivateKey, Curve } = this.core;

        // Build message hash with prefix
        // Prefix: "\x19Ethereum Signed Message:\n" + length
        const messageBuffer = Buffer.from(messageText);
        const prefix = Buffer.from("\x19Ethereum Signed Message:\n" + messageBuffer.length);
        const hash = Hash.keccak256(Buffer.concat([prefix, messageBuffer]));

        const key = PrivateKey.createWithData(HexCoding.decode(privateKeyHex));
        const signature = key.sign(hash, Curve.secp256k1); // Returns 65 bytes (r, s, v)

        // Add 0x prefix
        const signatureHex = HexCoding.encode(signature);

        // Correct V value (WalletCore sometimes returns 00/01, ETH standard usually requires +27 -> 27/28)
        // But here to keep raw data, return Hex directly, business layer usually can use it directly
        return signatureHex;
    }

    // ==========================================
    // 4. EIP712 Typed Data Signing
    // ==========================================
    signTypedData(privateKeyHex, jsonString) {
        const { EthereumAbi, HexCoding, PrivateKey, Curve } = this.core;

        const hash = EthereumAbi.encodeTyped(jsonString);
        const key = PrivateKey.createWithData(HexCoding.decode(privateKeyHex));
        const signature = key.sign(hash, Curve.secp256k1);

        return HexCoding.encode(signature);
    }
}

module.exports = EthereumSigner;