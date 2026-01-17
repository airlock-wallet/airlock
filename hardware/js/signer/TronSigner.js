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
 * @property {Object} [extend]  - [Optional] Extended data (including txId)
 */
class TronSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Scenario 1: Pre-signed transaction direct signing (testSignDirect)
     * Used when txId is already available, typically in scenarios where the backend has already constructed the transaction body and only requires the wallet to sign.
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {string} txData.txId       - [Required] Transaction ID (Hex)
     * @returns {SignerResult}
     */
    signDirect(txData, coinType = this.core.CoinType.tron) {
        const { AnySigner, HexCoding } = this.core;
        const TronProto = TW.Tron.Proto;

        const pkData = HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey);

        const input = TronProto.SigningInput.create({
            txId: txData.txId,
            privateKey: pkData
        });

        // --- Enforce Input Verification ---
        const inputError = TronProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Tron Input Verification Failed: ${inputError}`);
        }

        const outputBytes = AnySigner.sign(TronProto.SigningInput.encode(input).finish(), coinType);
        const output = TronProto.SigningOutput.decode(outputBytes);

        // --- Enforce Output Verification ---
        const outputError = TronProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Tron Output Verification Failed: ${outputError}`);
        }
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Tron Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.signature),
            extend: {
                txId: HexCoding.encode(output.id),
                json: output.toJSON(),
            }
        };
    }

    /**
     * Scenario: Native TRX Transfer Signing (Fully automated raw material assembly version)
     *
     * @param {Object} txData - Raw transaction data
     * @param coinType
     * @param {string} txData.privateKey    - [Required] Sender Private Key (Hex)
     * @param {string} txData.toAddress     - [Required] Recipient TRON Address (T...)
     * @param {number} txData.timestamp     - [Required] Current timestamp
     * @param {string} [txData.feeLimit]    - [Required] Fee Limit
     * @param {string} txData.amount        - [Required] Decimal Amount (1 TRX = 1,000,000 drop)
     */
    signTransfer(txData, coinType = this.core.CoinType.tron) {
        const { AnySigner, HexCoding, PrivateKey, AnyAddress } = this.core;
        const TronProto = TW.Tron.Proto;

        // 1. Prepare key and address
        const pkData = HexCoding.decode(txData.privateKey);
        const pk = PrivateKey.createWithData(pkData);
        const fromAddress = AnyAddress.createWithPublicKey(pk.getPublicKeySecp256k1(false), coinType).description();

        // 2. Construct Raw Material: Native TRX Transfer Contract
        const transferContract = TronProto.TransferContract.create({
            ownerAddress: fromAddress,
            toAddress: txData.toAddress,
            amount: Long.fromString(txData.amount),
        });

        // 3. Construct BlockHeader
        const blockHeader = TronProto.BlockHeader.create({
            timestamp: txData.blockHeader.timestamp,
            txTrieRoot: HexCoding.decode(txData.blockHeader.txTrieRoot),
            parentHash: HexCoding.decode(txData.blockHeader.parentHash),
            number: txData.blockHeader.number,
            witnessAddress: HexCoding.decode(txData.blockHeader.witnessAddress),
            version: txData.blockHeader.version
        });

        // 4. Get current time and expiration time
        const now = txData.timestamp;

        // 5. Assemble into Transaction Body
        const transaction = TronProto.Transaction.create({
            transfer: transferContract,
            timestamp: Long.fromNumber(now),
            expiration: Long.fromNumber(now + 3600000), // Set 1 hour validity
            blockHeader: blockHeader,
            feeLimit: Long.fromNumber(txData.feeLimit || 0)
        });

        // 6. Construct SigningInput
        const input = TronProto.SigningInput.create({
            transaction: transaction,
            privateKey: pkData
        });

        const inputError = TronProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Tron Input Verification Failed: ${inputError}`);
        }

        // 7. Execute Signing
        const inputEncoded = TronProto.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(inputEncoded, coinType);
        const output = TronProto.SigningOutput.decode(outputBytes);

        // 8. Error Checking
        const outputError = TronProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Tron Output Verification Failed: ${outputError}`);
        }
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Tron Signing Logic Error: ${msg}`);
        }

        // 9. Return Result: Pass full JSON string to backend
        return {
            encoded: output.json,
            extend: {
                txId: HexCoding.encode(output.id), // For backend to query transaction
                signature: JSON.parse(output.json), // For Node debugging to view structure
                json: output.toJSON(),
            }
        };
    }


    /**
     * Scenario 2: TRC20 Contract Transfer Signing (testSignTransferTrc20Contract)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey      - [Required] Private Key (Hex)
     * @param {string} txData.contractAddress - [Required] TRC20 Contract Address
     * @param {number} txData.timestamp       - [Required] Current timestamp
     * @param {string} txData.toAddress       - [Required] Recipient TRON Address
     * @param {string} txData.amount          - [Required] Decimal amount string
     * @param {Object} txData.blockHeader     - [Required] TRON Block Header Snapshot
     */
    signTrc20Transfer(txData, coinType = this.core.CoinType.tron) {
        const { AnySigner, HexCoding, PrivateKey, AnyAddress } = this.core;
        const TronProto = TW.Tron.Proto;

        const pkData = HexCoding.decode(txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey);
        const pk = PrivateKey.createWithData(pkData);
        // Derive From address from private key
        const fromAddress = AnyAddress.createWithPublicKey(pk.getPublicKeySecp256k1(false), coinType).description();

        // 1. Construct TRC20 Contract Call Payload
        // TRON requires amount to be a 32-byte padded byte stream
        let amountHex = BigInt(txData.amount).toString(16).padStart(64, '0');
        const amountBytes = HexCoding.decode(amountHex);

        const trc20Contract = TronProto.TransferTRC20Contract.create({
            ownerAddress: fromAddress,
            contractAddress: txData.contractAddress,
            toAddress: txData.toAddress,
            amount: amountBytes
        });

        // 2. Construct Block Header and Transaction Body
        const blockHeader = TronProto.BlockHeader.create({
            timestamp: txData.blockHeader.timestamp,
            txTrieRoot: HexCoding.decode(txData.blockHeader.txTrieRoot),
            parentHash: HexCoding.decode(txData.blockHeader.parentHash),
            number: txData.blockHeader.number,
            witnessAddress: HexCoding.decode(txData.blockHeader.witnessAddress),
            version: txData.blockHeader.version
        });

        const now = txData.timestamp;
        const transaction = TronProto.Transaction.create({
            transferTrc20Contract: trc20Contract,
            timestamp: Long.fromNumber(now),
            expiration: Long.fromNumber(now + 3600000),
            blockHeader: blockHeader,
            feeLimit: Long.fromNumber(txData.feeLimit || 50000000)
        });

        // 3. Construct Signing Input
        const input = TronProto.SigningInput.create({
            transaction: transaction,
            privateKey: pkData
        });

        const inputError = TronProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Tron Input Verification Failed: ${inputError}`);
        }

        const outputBytes = AnySigner.sign(TronProto.SigningInput.encode(input).finish(), coinType);
        const output = TronProto.SigningOutput.decode(outputBytes);

        const outputError = TronProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Tron Output Verification Failed: ${outputError}`);
        }
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Tron Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.json,
            extend: {
                txId: HexCoding.encode(output.id),
                json: output.toJSON(),
            }
        };
    }
}

module.exports = TronSigner;