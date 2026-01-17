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
 */
class PolkadotSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Scenario: Balance Transfer (Standard transfer signing)
     * @param {Object} txData
     * @param coinType
     * @param {string} txData.privateKey - Private Key (Hex)
     * @param {string} txData.toAddress  - Recipient address
     * @param {string} txData.amount     - [Required] Decimal amount string (e.g. "10000000000")
     * @param {string} txData.genesisHash - Genesis Hash
     * @param {string} txData.blockHash  - Block Hash
     * @param {number} txData.nonce      - Nonce
     * @param {number} txData.specVersion - Spec Version
     * @param {number} txData.transactionVersion - Transaction Version
     */
    signTransfer(txData, coinType = this.core.CoinType.polkadot) {
        const { AnySigner, HexCoding } = this.core;
        const PolkadotProto = TW.Polkadot.Proto;

        const toUint8 = (hex) => HexCoding.decode(hex.startsWith('0x') ? hex.slice(2) : hex);
        const amountData = this._decimalToData(txData.amount);

        const transferCall = PolkadotProto.Balance.Transfer.create({
            toAddress: txData.toAddress,
            value: amountData
        });

        const input = PolkadotProto.SigningInput.create({
            privateKey: toUint8(txData.privateKey),
            genesisHash: toUint8(txData.genesisHash),
            blockHash: toUint8(txData.blockHash),
            nonce: Long.fromValue(txData.nonce),
            specVersion: txData.specVersion,
            transactionVersion: txData.transactionVersion,
            network: txData.network || 0,
            balanceCall: PolkadotProto.Balance.create({ transfer: transferCall })
        });

        // Verify input
        const inputError = PolkadotProto.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Polkadot Input Verification Failed: ${inputError}`);
        }

        const inputEncoded = PolkadotProto.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(inputEncoded, coinType);
        const output = PolkadotProto.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = PolkadotProto.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Polkadot Output Verification Failed: ${outputError}`);
        }
        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Polkadot Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON(),
            }
        };
    }

    /**
     * @private
     * Only convert decimal to big/little endian byte stream, avoid bitwise tricks
     */
    _decimalToData(decimalStr) {
        let hex = BigInt(decimalStr).toString(16);
        if (hex.length % 2 !== 0) hex = '0' + hex;
        return this.core.HexCoding.decode(hex);
    }
}

module.exports = PolkadotSigner;