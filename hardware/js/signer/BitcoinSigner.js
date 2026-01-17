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
class BitcoinSigner {
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
     * Test script needs this to simulate Script returned by Tatum
     * @param privateKeyHex
     * @param type
     * @returns {string}
     */
    getScript(privateKeyHex, type) {
        if (!this.core) throw new Error("Core not initialized");
        const { HexCoding, PrivateKey, BitcoinScript, Hash } = this.core;

        const pk = PrivateKey.createWithData(HexCoding.decode(privateKeyHex));
        const pubKey = pk.getPublicKeySecp256k1(true);

        let scriptObj;

        if (type === 'legacy') {
            // P2PKH
            const keyHash = Hash.sha256RIPEMD(pubKey.data());
            scriptObj = BitcoinScript.buildPayToPublicKeyHash(keyHash);
        } else if (type === 'segwit') {
            // P2WPKH
            const keyHash = Hash.sha256RIPEMD(pubKey.data());
            scriptObj = BitcoinScript.buildPayToWitnessPubkeyHash(keyHash);
        } else if (type === 'taproot') {
            // P2TR
            scriptObj = BitcoinScript.buildPayToTaproot(pubKey.data());
        } else {
            throw new Error(`Unknown script type: ${type}`);
        }

        return HexCoding.encode(scriptObj.data());
    }

    /**
     * Legacy / Segwit signing
     * Purpose: Most common standard transfer.
     * Applicable scenarios: If your wallet is used to store ordinary BTC, and your address is not the newest Taproot address.
     * Supported coins: BTC, LTC (Litecoin), DOGE (Dogecoin), BCH etc.
     * Check your address (Sender):
     * Starts with 1 (Legacy, P2PKH) -> Use this!
     * Starts with 3 (Segwit P2SH) -> Use this!
     * Starts with bc1q (or ltc1q) (Native Segwit) -> Use this!
     * (This is currently the most mainstream) Summary: As long as it is not BRC20 token, nor Taproot address, 99% of cases use signLegacy.
     * @param {Object} txData - Transaction data object
     * @param {number} txData.amount  Transfer amount (Sats)
     * @param {string} txData.toAddress  Recipient address
     * @param {string} txData.changeAddress  Change address (usually sender themselves)
     * @param {number} txData.byteFee  Fee rate (sats/byte), default 1
     * @param {boolean} txData.useMax  Whether to transfer all
     * @param {string[]} txData.privateKeys  Private key array (Hex strings)
     * @param {Object[]} txData.utxos - UTXO list
     * @param coinType - Coin type
     * @returns {SignerResult}
     */
    signTransfer(txData, coinType = this.core.CoinType.bitcoin) {
        const { AnySigner, HexCoding } = this.core;
        const Bitcoin = TW.Bitcoin.Proto;

        // Auto calculation of Script is not needed anymore, WalletCore will automatically match based on address during Legacy signing
        // But for strictness, we still process inputs
        const utxos = txData.utxos.map(u => {
            // If script is not passed externally, try to auto-generate (simplified handling here, usually Legacy requires querying script externally)
            // But since you are using Tatum, Tatum will return script, so use it directly
            return Bitcoin.UnspentTransaction.create({
                amount: this.toLong(u.amount),
                outPoint: {
                    hash: this.toHashReversed(u.txHash),
                    index: u.index,
                    sequence: u.sequence ? u.sequence : 4294967295,
                },
                script: HexCoding.decode(u.script)
            });
        });

        // 2. Core modification: Detect if it is full amount transfer
        const isMaxAmount = txData.useMax === true;

        const input = Bitcoin.SigningInput.create({
            amount: isMaxAmount ? 0 : this.toLong(txData.amount),
            hashType: 1,
            toAddress: txData.toAddress,
            changeAddress: txData.changeAddress,
            byteFee: this.toLong(txData.byteFee || 1),
            useMaxAmount: isMaxAmount,
            privateKey: txData.privateKeys.map(k => HexCoding.decode(k)),
            utxo: utxos,
            coinType: coinType.value
        });

        // Verify input
        const inputError = Bitcoin.SigningInput.verify(input);
        if (inputError) {
            throw new Error(`Bitcoin Input Verification Failed: ${inputError}`);
        }

        const encoded = Bitcoin.SigningInput.encode(input).finish();
        const outputBytes = AnySigner.sign(encoded, coinType);
        const output = Bitcoin.SigningOutput.decode(outputBytes);

        // Verify output
        const outputError = Bitcoin.SigningOutput.verify(output);
        if (outputError) {
            throw new Error(`Bitcoin Output Verification Failed: ${outputError}`);
        }

        if (output.errorMessage || output.error) {
            const msg = output.errorMessage || `Error Code ${output.error}`;
            throw new Error(`Bitcoin Signing Logic Error: ${msg}`);
        }

        return {
            encoded: HexCoding.encode(output.encoded),
            extend: {
                json: output.toJSON()
            }
        };
    }

    /**
     * P2TR (Taproot) signing
     * Purpose: Taproot dedicated transfer. Applicable scenarios: This is a newer Bitcoin upgrade (2021), lower fees, better privacy.
     * Supported coins: Mainly BTC. Check your address (Sender): Starts with bc1p -> Must use this!
     * Summary: Only use this when you explicitly know you are using a Taproot wallet (address is bc1p...).
     * @param {Object} txData - Transaction data object
     * @param {string[]} txData.privateKeys - Private key array
     * @param {number} [txData.feePerVb=1] - Fee rate (sats/vbyte)
     * @param {string} [txData.changeAddress] - Change address
     * @param {Object[]} txData.utxos - UTXO input list
     * @param {Object[]} txData.outputs - Output list
     * @param coinType - Coin type
     * @param options
     * @returns {SignerResult}
     */
    _signBitcoinV2(txData, coinType, options = {}) {
        const { AnySigner, HexCoding, PrivateKey } = this.core;
        const Bitcoin = TW.Bitcoin.Proto;
        const BitcoinV2 = TW.BitcoinV2.Proto;

        // 1. Basic validation
        if (!txData.changeAddress) {
            throw new Error("SignV2 Error: changeAddress is required!");
        }

        // 2. Prepare public key (Default use first private key)
        const pk = PrivateKey.createWithData(HexCoding.decode(txData.privateKeys[0]));
        const pubKeyData = pk.getPublicKeySecp256k1(true).data();

        // 3. Build Inputs
        const inputs = txData.utxos.map(i => {
            // If scriptBuilder is not passed externally, decide default based on options.defaultScriptType
            let defaultScript = {};
            if (options.defaultScriptType === 'p2tr') {
                defaultScript = { p2trKeyPath: pubKeyData };
            } else if (options.defaultScriptType === 'p2wpkh') {
                defaultScript = { p2wpkh: { pubkey: pubKeyData } };
            }

            // Prefer utxo's own scriptBuilder, use default if not present
            const scriptBuilder = i.scriptBuilder || defaultScript;

            return BitcoinV2.Input.create({
                outPoint: { hash: this.toHashReversed(i.txHash), vout: i.vout },
                value: this.toLong(i.amount),
                sighashType: 1, // SIGHASH_ALL
                scriptBuilder: scriptBuilder
            });
        });

        // 4. Build Outputs
        const outputs = txData.outputs.map(o => BitcoinV2.Output.create({
            value: this.toLong(o.amount),
            toAddress: o.toAddress,
            builder: o.builder // Used by BRC20 Inscribe or special construction
        }));

        // 5. Build Builder
        const builder = {
            version: BitcoinV2.TransactionVersion.V2,
            inputs: inputs,
            outputs: outputs,
            // Cold wallet recommends using UseAll: Sign whatever App sends, don't pick and choose
            inputSelector: BitcoinV2.InputSelector.UseAll,
            fixedDustThreshold: this.toLong(txData.fixedDustThreshold || 546),
            feePerVb: this.toLong(txData.feePerVb || 1),
            // Unified change logic
            changeOutput: BitcoinV2.Output.create({
                toAddress: txData.changeAddress
            })
        };

        // 6. Wrap SigningInput
        const v2Input = BitcoinV2.SigningInput.create({
            builder: builder,
            privateKeys: txData.privateKeys.map(k => HexCoding.decode(k.toString())),
            chainInfo: { p2pkhPrefix: 0, p2shPrefix: 5 },
            dangerousUseFixedSchnorrRng: true, // Only effective for Taproot, ignored by other modes
        });

        // 7. Sign
        const legacyInput = Bitcoin.SigningInput.create({ signingV2: v2Input });

        // Verify input
        const inputError = Bitcoin.SigningInput.verify(legacyInput);
        if (inputError) throw new Error(`Input Verify Failed: ${inputError}`);

        const encoded = Bitcoin.SigningInput.encode(legacyInput).finish();
        const outputBytes = AnySigner.sign(encoded, coinType);
        const output = Bitcoin.SigningOutput.decode(outputBytes);

        // Verify output
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
                json: output.toJSON()
            }
        };
    }

    /**
     * P2TR (Taproot) transfer entry
     * @param txData
     * @param coinType
     * @return {SignerResult}
     */
    signP2TR(txData, coinType = this.core.CoinType.bitcoin) {
        return this._signBitcoinV2(txData, coinType, { defaultScriptType: 'p2tr' });
    }

    /**
     * BRC20 transfer entry
     * (BRC20 wallet address is usually Taproot or Native Segwit, default set to Segwit/p2wpkh here,
     * but if scriptBuilder comes with utxos, this default value will be overridden, so strong universality)
     * @param txData
     * @param coinType
     * @return {SignerResult}
     */
    signBrc20Transfer(txData, coinType = this.core.CoinType.bitcoin) {
        // Most BRC20 interactions use Segwit (Unisat early default) or Taproot
        // Set to p2wpkh as fallback here, if your BRC20 is on Taproot address,
        // your App should pass scriptBuilder: { p2trKeyPath: ... } when constructing UTXO
        return this._signBitcoinV2(txData, coinType, { defaultScriptType: 'p2wpkh' });
    }

    signBrc20Commit(txData, coinType) { return this.signBrc20Transfer(txData, coinType); }
    signBrc20Reveal(txData, coinType) { return this.signBrc20Transfer(txData, coinType); }
}

module.exports = BitcoinSigner;