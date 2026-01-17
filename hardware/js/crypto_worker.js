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

'use strict';
const fs = require('fs').promises;
const path = require('path');

// --- Core Libraries ---
const TrustWalletCoreModule = require('@trustwallet/wallet-core');
const SignerManager = require('./SignerManager');
const { getStdin, getCoinTypeById, getSecp256k1, getEd25519, isUTXO } = require('./Utils');
class JsonReader {
    static async read(path) {
        try {
            const content = await fs.readFile(path, 'utf8');
            return JSON.parse(content);
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.error(`File does not exist: ${path}`);
            } else if (err instanceof SyntaxError) {
                console.error(`JSON format error: ${path}`);
                console.error(err.message);
            } else {
                console.error(`Failed to read file: ${path}`, err);
            }
            throw err;
        }
    }
}


/**
 * Main Function - Entry point for the secure black box
 */
async function main() {
    // Excluded Coin IDs
    const excludeCoins = ['nimiq'];
    // Allowed Coin IDs
    const allowCoins = [];

    let WalletCore; // Wasm Instance
    let response = {};
    let request = {command: "unknown", entropy: null};

    try {
        // 1. Initialize WASM module
        WalletCore = await TrustWalletCoreModule.initWasm();

        // 2. Read JSON request from Python (stdin)
        const inputJson = await getStdin();
        if (!inputJson) {
            throw new Error("Empty input received from stdin.");
        }
        request = JSON.parse(inputJson);

        // 3. Read configuration file
        const jsonPath = path.join(__dirname, '..', 'registry.json');
        const coins = await JsonReader.read(jsonPath);

        // 4. Create Signer Manager
        const signerManager = new SignerManager(WalletCore);

        // 5. Execute operation based on command
        switch (request.command) {

            /**
             * Command: generate_mnemonic
             */
            case "generate_mnemonic": {
                // 1. Receive Hex string from Python (64 chars = 32 bytes = 256 bits)
                let hexEntropy = request.entropy;
                if (!hexEntropy) throw new Error("Missing entropy");
                let passphrase = request.passphrase || "";
                let entropyBytes = null;
                let wallet = null;

                try {
                    // 1. Decode Hex to byte array
                    entropyBytes = WalletCore.HexCoding.decode(hexEntropy);

                    // 2. [Core Fix] Create directly using HDWallet class
                    // Pass in entropyBytes and passphrase
                    wallet = WalletCore.HDWallet.createWithEntropy(entropyBytes, passphrase);

                    response = {
                        status: "success",
                        mnemonic: wallet.mnemonic()
                    };
                } catch (err) {
                    throw new Error(`Generate mnemonic failed: ${err.message}`);
                } finally {
                    hexEntropy = null;
                    passphrase = null;
                    entropyBytes = null;
                    if (wallet) wallet.delete();
                }
                break;
            }

            /**
             * Command: get_keys_batch
             * Batch get extended public keys
             */
            case "get_keys_batch": {
                let {mnemonic, num} = request;
                let passphrase = request.passphrase || "";
                let total = num || 50;

                let wallet = null;
                if (!mnemonic) throw new Error("Missing mnemonic or coins array");

                const results = [];
                try {
                    // Initialize Wallet object
                    wallet = WalletCore.HDWallet.createWithMnemonic(mnemonic, passphrase);
                    for (const coin of coins) {
                        // Exclude coins
                        if (excludeCoins.includes(coin.id)) continue;
                        // Allow list
                        if (allowCoins.length > 0 && !allowCoins.includes(coin.id)) continue;
                        try {
                            if (coin.curve === 'secp256k1') {
                                const res = await getSecp256k1(WalletCore, wallet, coin);
                                results.push(res);
                            } else if (coin.curve === 'ed25519') {
                                for (let i = 0; i < total; i++) {
                                    const res = await getEd25519(WalletCore, wallet, coin, i);
                                    results.push(res);
                                }
                            }
                        } catch (e) {
                            results.push({error: e.message})
                        }
                    }

                    response = {status: "success", results: results};
                } finally {
                    mnemonic = null;
                    passphrase = null;
                    if (wallet) wallet.delete();
                }
                break;
            }

            /**
             * Command: validate_mnemonic  Validate if mnemonic is valid
             */
            case "validate_mnemonic": {
                let mnemonicStr = request.mnemonic;
                if (!mnemonicStr) throw new Error("Missing mnemonic");

                try {
                    // Use Mnemonic.isValid to check words and checksum
                    const isValid = WalletCore.Mnemonic.isValid(mnemonicStr);

                    response = {
                        status: "success",
                        isValid: isValid
                    };
                } catch (err) {
                    throw new Error(`Validate failed: ${err.message}`);
                } finally {
                    mnemonicStr = null;
                }
                break;
            }

            /**
             * Command: sign_transaction (JSON mode)
             */
            case "sign_transaction": {
                let {method, mnemonic, passphrase, asset, txData} = request;
                if (!method || !mnemonic || !asset || !txData) {
                    throw new Error("sign_transaction requires method, mnemonic, derivationPath and txData");
                }
                const coin = coins.find(c => c.id === asset.coin);
                if (!coin) {
                    throw new Error("sign_transaction requires coin");
                }

                let wallet;
                let privateKey;
                try {
                    wallet = WalletCore.HDWallet.createWithMnemonic(mnemonic, passphrase);
                    const coinType = await getCoinTypeById(WalletCore, coin.coinId);
                    privateKey = wallet.getKey(coinType, asset.derivation_path);

                    // Security check! Address validation for secp256k1 is done at Javascript layer, ed25519 at Python layer
                    if (coin.curve === 'secp256k1') {
                        const publicKey = privateKey.getPublicKey(coinType);
                        const addressObj = WalletCore.AnyAddress.createWithPublicKeyDerivation(publicKey, coinType, asset.derivation_path);
                        const realAddress = addressObj.description();

                        // Cleanup
                        addressObj.delete();
                        publicKey.delete();

                        // Strict comparison
                        if (realAddress.toLowerCase() !== asset.address.toLowerCase()) {
                            throw new Error("Address in signing request does not match private key, potential tampering attack intercepted");
                        }
                    }

                    // UTXO models need privateKeys passed in
                    if (isUTXO(coin.blockchain)) {
                        txData.privateKeys = [WalletCore.HexCoding.encode(privateKey.data())];
                    } else {
                        txData.privateKey = WalletCore.HexCoding.encode(privateKey.data());
                    }

                    // XRP needs fromAddress
                    txData.fromAddress = asset.address;

                    const result = await signerManager.sign(coinType, coin, method, txData);

                    response = {
                        status: "success",
                        encoded: result.encoded,
                        extend: result.extend,
                    };
                } catch (e) {
                    throw new Error(`Signing error: ${e.message}`)
                } finally {
                    mnemonic = null;
                    passphrase = null;
                    wallet.delete();
                    privateKey.delete();
                }

                break;
            }

            default:
                throw new Error(`Unknown command: ${request.command}`);
        }

        // 4. Send successful JSON result back to Python (stdout)
        console.log(JSON.stringify(response, null, 2));

    } catch (error) {
        // 5. If any error occurs, send error JSON to stderr
        response = {
            status: "error",
            command: request.command || "unknown",
            message: error.message,
            stack: error.stack
        };
        console.error(JSON.stringify(response, null, 2));
        process.exit(1); // Exit and return error code
    }
}

// Start Worker
main();