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
 * @property {string} encoded   - [Required] Final signed data (Hex/Base64/JSON), used directly for broadcasting
 * @property {Object} [extend]  - [Optional] Extended data (e.g. txid, signature, rawTx etc.), for recording or debugging purposes only
 */
class ZcashSigner {
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

    toHashReversed(hexStr) {
        const { HexCoding } = this.core;
        return HexCoding.decode(hexStr).reverse();
    }

    /**
     * Zcash / Zelcash (Flux) Universal Signing
     *
     * @param {Object} txData - Transaction data
     * @param {string[]} txData.privateKeys - Array of private keys
     * @param {string} txData.fromAddress - Sender address (t1...)
     * @param {string|null} [txData.changeAddress] - Change address
     * @param {string} txData.branchId - Branch ID (ZEC=0xbb09b876, FLUX=0x76b809bb)
     * @param {Object[]} txData.inputs - UTXO Inputs
     * @param {Object[]} txData.outputs - Output List
     * @param coinType - Coin Type (ZEC=133, FLUX=121)
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.zcash) {
        const { AnySigner, HexCoding, BitcoinSigHashType } = this.core;
        const Bitcoin = TW.Bitcoin.Proto;
        // Primarily use BitcoinV2
        const Proto = TW.BitcoinV2.Proto;

        // 1. Build UTXO Inputs (Use V2)
        const inputs = txData.inputs.map(i => {
            return Proto.Input.create({
                outPoint: {
                    hash: this.toHashReversed(i.txHash),
                    vout: i.vout
                },
                value: this.toLong(i.amount),
                sighashType: BitcoinSigHashType.all.value, // Zcash defaults to ALL
                // Zcash verification requires sender address
                receiverAddress: txData.fromAddress
            });
        });

        // 2. Build Outputs (Use V2)
        const outputs = txData.outputs.map(o => Proto.Output.create({
            value: this.toLong(o.amount),
            toAddress: o.toAddress
        }));

        // 3. Build Builder (Including Zcash special parameters)
        const builder = {
            version: Proto.TransactionVersion.UseDefault,
            inputs: inputs,
            outputs: outputs,
            inputSelector: Proto.InputSelector.SelectDescending,
            fixedDustThreshold: this.toLong(546),

            // Zcash specific: BranchID (Sapling/Nu5)
            zcashExtraData: {
                branchId: HexCoding.decode(txData.branchId || "0xbb09b876")
            }
        };

        // 4. Handle change (V2 recommended way: let Selector handle or explicit Output)
        // Here we follow the logic of test cases, usually InputSelector generates automatically if change address exists
        // But for clarity, we can configure changeOutput template
        if (txData.changeAddress) {
            builder.changeOutput = Proto.Output.create({
                toAddress: txData.changeAddress
            });
        }

        // 5. Build SigningInput V2
        const signingInputV2 = Proto.SigningInput.create({
            builder: builder,
            privateKeys: txData.privateKeys.map(k => HexCoding.decode(k.toString())),
            chainInfo: {
                // Zcash Mainnet Prefix: t1 (P2PKH) = 0x1CB8 (Dec 7352, Core 184)
                // P2SH = 0x1CBD (Dec 7357, Core 189)
                p2pkhPrefix: 184,
                p2shPrefix: 189
            }
        });

        // 6. Final Encapsulation (Must wrap V2 Input with Bitcoin.Proto)
        // This step is a requirement of Wallet Core's lower level, even Zcash goes through this Wrapper
        const legacySigningInput = Bitcoin.SigningInput.create({
            signingV2: signingInputV2,
            coinType: coinType.value // Must pass value
        });

        // Verify Input
        const inputError = Bitcoin.SigningInput.verify(legacySigningInput);
        if (inputError) {
            throw new Error(`Bitcoin Input Verification Failed: ${inputError}`);
        }

        const encoded = Bitcoin.SigningInput.encode(legacySigningInput).finish();
        const outputBytes = AnySigner.sign(encoded, coinType);
        const output = Bitcoin.SigningOutput.decode(outputBytes);

        // Verify Output
        const outputError = Bitcoin.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Bitcoin Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Bitcoin Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.signingResultV2.encoded),
            extend: {
                txid: HexCoding.encode(output.signingResultV2.txid),
                json: output.toJSON(),
            }
        };
    }
}

module.exports = ZcashSigner;