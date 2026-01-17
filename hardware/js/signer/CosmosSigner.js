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
 * @property {string} encoded   - [Required] Final signed data (JSON String), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data
 */
class CosmosSigner {
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
     * General build and sign logic
     * @param txData
     * @param message
     * @param coinType
     * @return {SignerResult}
     * @private
     */
    _signCommon(txData, message, coinType = this.core.CoinType.cosmos) {
        const { AnySigner, HexCoding } = this.core;
        const Cosmos = TW.Cosmos.Proto;

        // 1. Build Fee
        const fee = Cosmos.Fee.create({
            gas: this._toLong(txData.gas || 200000),
            amounts: [
                Cosmos.Amount.create({
                    amount: String(txData.feeAmount || 200),
                    denom: txData.denom || "uatom"
                })
            ]
        });

        // 2. Build SigningInput
        const input = Cosmos.SigningInput.create({
            signingMode: Cosmos.SigningMode.Protobuf,
            chainId: txData.chainId,
            accountNumber: this._toLong(txData.accountNumber),
            sequence: this._toLong(txData.sequence),
            memo: txData.memo || "",
            fee: fee,
            privateKey: HexCoding.decode(txData.privateKey),
            messages: [message]
        });

        // Verify input
        const inputError = Cosmos.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Cosmos Input Verification Failed: ${inputError}`);
        }

        // 3. Sign
        const outputBytes = AnySigner.sign(Cosmos.SigningInput.encode(input).finish(), coinType);
        const output = Cosmos.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Cosmos.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Cosmos Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Cosmos Signing Logic Error: ${msg}`);
        }

        return {
            encoded: output.serialized,
            extend: {
                json: output.toJSON(),
                signature: output.signature,
            }
        };
    }

    /**
     * 1. Sign normal transfer transaction (MsgSend)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.chainId
     * @param {string} txData.toAddress
     * @param {string|number} txData.amount
     * @param {string} txData.privateKey
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.cosmos) {
        const { HexCoding, AnyAddress, PrivateKey } = this.core;
        const Cosmos = TW.Cosmos.Proto;

        // Derive sender address
        const privateKey = PrivateKey.createWithData(HexCoding.decode(txData.privateKey));
        const publicKey = privateKey.getPublicKeySecp256k1(true);
        const fromAddress = AnyAddress.createWithPublicKey(publicKey, coinType).description();

        const sendMsg = Cosmos.Message.Send.create({
            fromAddress: fromAddress,
            toAddress: txData.toAddress,
            amounts: [
                Cosmos.Amount.create({
                    amount: String(txData.amount),
                    denom: txData.denom || "uatom"
                })
            ]
        });

        const message = Cosmos.Message.create({
            sendCoinsMessage: sendMsg
        });

        return this._signCommon(txData, message, coinType);
    }

    /**
     * 2. Sign authorization grant transaction (MsgGrant / StakeAuthorization)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.granteeAddress - Grantee address
     * @param {string} txData.granterAddress - Granter address
     * @param {string} txData.validatorAddress - Validator address
     * @param {number} txData.expiration - Expiration timestamp (seconds)
     * @returns {SignerResult}
     */
    signAuthGrant(txData, coinType = this.core.CoinType.cosmos) {
        const Cosmos = TW.Cosmos.Proto;

        const stakeAuth = Cosmos.Message.StakeAuthorization.create({
            allowList: Cosmos.Message.StakeAuthorization.Validators.create({
                address: [txData.validatorAddress]
            }),
            authorizationType: Cosmos.Message.AuthorizationType.DELEGATE
        });

        const authGrant = Cosmos.Message.AuthGrant.create({
            grantee: txData.granteeAddress,
            granter: txData.granterAddress,
            grantStake: stakeAuth,
            expiration: this._toLong(txData.expiration)
        });

        const message = Cosmos.Message.create({
            authGrant: authGrant
        });

        return this._signCommon(txData, message, coinType);
    }

    /**
     * 3. Sign authorization revoke transaction (MsgRevoke)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.granteeAddress
     * @param {string} txData.granterAddress
     * @param {string} [txData.msgTypeUrl]
     * @returns {SignerResult}
     */
    signAuthRevoke(txData, coinType = this.core.CoinType.cosmos) {
        const Cosmos = TW.Cosmos.Proto;

        const authRevoke = Cosmos.Message.AuthRevoke.create({
            grantee: txData.granteeAddress,
            granter: txData.granterAddress,
            msgTypeUrl: txData.msgTypeUrl || "/cosmos.staking.v1beta1.MsgDelegate"
        });

        const message = Cosmos.Message.create({
            authRevoke: authRevoke
        });

        return this._signCommon(txData, message, coinType);
    }
}

module.exports = CosmosSigner;