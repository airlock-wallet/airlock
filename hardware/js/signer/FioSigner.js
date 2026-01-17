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
 * @property {string} encoded   - [Required] Final signed data (JSON String), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data
 */
class FioSigner {
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

    _toBuffer(val) {
        if (!val) return Buffer.from([]);
        if (Buffer.isBuffer(val)) return val;
        if (typeof val === 'string') {
            const hex = val.startsWith('0x') ? val.slice(2) : val;
            return Buffer.from(hex, 'hex');
        }
        return Buffer.from([]);
    }

    /**
     * General signing method
     * @param txData
     * @param actionBuilder
     * @param coinType
     * @return {{extend: {}, encoded: string}}
     * @private
     */
    _signCommon(txData, actionBuilder, coinType = this.core.CoinType.fio) {
        const { AnySigner, HexCoding } = this.core;
        const FIO = TW.FIO.Proto;

        // 1. Build ChainParams
        const chainParams = FIO.ChainParams.create({
            chainId: this._toBuffer(txData.chainId),
            headBlockNumber: this._toLong(txData.headBlockNumber),
            refBlockPrefix: this._toLong(txData.refBlockPrefix)
        });

        // 2. Build SigningInput
        const input = FIO.SigningInput.create({
            expiry: txData.expiry,
            chainParams: chainParams,
            privateKey: HexCoding.decode(txData.privateKey),
            tpid: txData.tpid || "",
            action: actionBuilder
        });

        // Input Verification
        const inputError = FIO.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`FIO Input Verification Failed: ${inputError}`);
        }

        // 3. Sign
        const outputBytes = AnySigner.sign(FIO.SigningInput.encode(input).finish(), coinType);
        const output = FIO.SigningOutput.decode(outputBytes);

        // Output Verification
        const outputVerifyError = FIO.SigningOutput.verify(output);
        if (outputVerifyError) {
            throw new Error(`FIO Output Verification Failed: ${outputVerifyError}`);
        }

        // Business Logic Error Verification
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`FIO Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.json, // FIO returns JSON string
            extend: {
                json: output.toJSON(),
            }
        };
    }

    /**
     * 1. Register FIO Address (RegisterFioAddress)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - Private key (Hex)
     * @param {string} txData.chainId - Chain ID (Hex)
     * @param {number} txData.expiry - Expiration time
     * @param {number} txData.headBlockNumber - Head block number
     * @param {number} txData.refBlockPrefix - Reference block prefix
     * @param {string} txData.fioAddress - FIO address to register
     * @param {string|number} txData.fee - Fee (suFIO)
     * @param {string} [txData.ownerFioPublicKey] - Optional, owner public key
     * @param {string} [txData.tpid] - Optional, TPID
     */
    registerFioAddress(txData, coinType = this.core.CoinType.fio) {
        const { HexCoding, PrivateKey, AnyAddress } = this.core;
        const FIO = TW.FIO.Proto;

        // If owner key is not provided, derive from private key
        let ownerFioPublicKey = txData.ownerFioPublicKey;
        if (!ownerFioPublicKey) {
            const privateKey = PrivateKey.createWithData(HexCoding.decode(txData.privateKey));
            const publicKey = privateKey.getPublicKeySecp256k1(false);
            ownerFioPublicKey = AnyAddress.createWithPublicKey(publicKey, coinType).description();
        }

        const regAction = FIO.Action.RegisterFioAddress.create({
            fioAddress: txData.fioAddress,
            ownerFioPublicKey: ownerFioPublicKey,
            fee: this._toLong(txData.fee)
        });

        const action = FIO.Action.create({
            registerFioAddressMessage: regAction
        });

        return this._signCommon(txData, action, coinType);
    }

    /**
     * 2. Add Public Address (AddPubAddress)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.fioAddress - Owned FIO address
     * @param {Array} txData.publicAddresses - Mapping list [{symbol: "BTC", address: "..."}]
     * @param {string|number} txData.fee - Fee
     */
    addPubAddress(txData, coinType = this.core.CoinType.fio) {
        const FIO = TW.FIO.Proto;

        // Build PublicAddress list
        const publicAddresses = (txData.publicAddresses || []).map(addr => {
            return FIO.PublicAddress.create({
                coinSymbol: addr.symbol,
                address: addr.address
            });
        });

        const addAction = FIO.Action.AddPubAddress.create({
            fioAddress: txData.fioAddress,
            publicAddresses: publicAddresses,
            fee: this._toLong(txData.fee)
        });

        const action = FIO.Action.create({
            addPubAddressMessage: addAction
        });

        return this._signCommon(txData, action, coinType);
    }

    /**
     * 3. Transfer FIO Token (Transfer)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.payeePublicKey - Payee FIO public key
     * @param {string|number} txData.amount - Transfer amount (suFIO)
     * @param {string|number} txData.fee - Fee
     */
    signTransfer(txData, coinType = this.core.CoinType.fio) {
        const FIO = TW.FIO.Proto;

        const transferAction = FIO.Action.Transfer.create({
            payeePublicKey: txData.payeePublicKey,
            amount: this._toLong(txData.amount),
            fee: this._toLong(txData.fee)
        });

        const action = FIO.Action.create({
            transferMessage: transferAction
        });

        return this._signCommon(txData, action, coinType);
    }
}

module.exports = FioSigner;