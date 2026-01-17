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

// Key is the blockchain identifier (passed from Python), Value is the corresponding JS class file
const signerMap = {
    'acala': require('./signer/AcalaSigner'),
    'aeternity': require('./signer/AeternitySigner'),
    'agoric': require('./signer/AgoricSigner'),
    'aion': require('./signer/AionSigner'),
    'algorand': require('./signer/AlgorandSigner'),
    'aptos': require('./signer/AptosSigner'),
    'band': require('./signer/BandChainSigner'),
    'bitcoincash': require('./signer/BitcoinCashSigner'),
    'bitcoindiamond': require('./signer/BitcoinDiamondSigner'),
    'bitcoin': require('./signer/BitcoinSigner'),
    'bluzelle': require('./signer/BluzelleSigner'),
    'cardano': require('./signer/CardanoSigner'),
    'cosmos': require('./signer/CosmosSigner'),
    'cryptoorg': require('./signer/CryptoOrgSigner'),
    'eos': require('./signer/EosSigner'),
    'ethereum': require('./signer/EthereumSigner'),
    'everscale': require('./signer/EverscaleSigner'),
    'filecoin': require('./signer/FilecoinSigner'),
    'fio': require('./signer/FioSigner'),
    'greenfield': require('./signer/GreenfieldSigner'),
    'groestlcoin': require('./signer/GroestlcoinSigner'),
    'harmony': require('./signer/HarmonySigner'),
    'hedera': require('./signer/HederaSigner'),
    'internet_computer': require('./signer/IcpSigner'),
    'iotex': require('./signer/IoTeXSigner'),
    'kava': require('./signer/KavaSigner'),
    'kusama': require('./signer/KusamaSigner'),
    'elrond': require('./signer/MultiversXSigner'),
    'nano': require('./signer/NanoSigner'),
    'nativeinjective': require('./signer/NativeInjectiveSigner'),
    'zetachain': require('./signer/NativeZetaChainSigner'),
    'near': require('./signer/NearSigner'),
    'nebulas': require('./signer/NebulasSigner'),
    'neo': require('./signer/NeoSigner'),
    'nervos': require('./signer/NervosSigner'),
    'nuls': require('./signer/NULSSigner'),
    'oasis': require('./signer/OasisSigner'),
    'ontology': require('./signer/OntologySigner'),
    'osmosis': require('./signer/OsmosisSigner'),
    'pactus': require('./signer/PactusSigner'),
    'polkadot': require('./signer/PolkadotSigner'),
    'polymesh': require('./signer/PolymeshSigner'),
    'secret': require('./signer/SecretSigner'),
    'solana': require('./signer/SolanaSigner'),
    'stargaze': require('./signer/StargazeSigner'),
    'stellar': require('./signer/StellarSigner'),
    'sui': require('./signer/SuiSigner'),
    'terrav2': require('./signer/TerraSigner'),
    'tezos': require('./signer/TezosSigner'),
    'thorchain': require('./signer/ThorchainSigner'),
    'ton': require('./signer/TonSigner'),
    'tron': require('./signer/TronSigner'),
    'waves': require('./signer/WavesSigner'),
    'ripple': require('./signer/XrpSigner'),
    'zcash': require('./signer/ZcashSigner'),
    'zen': require('./signer/ZenSigner')
};

class SignerManager {
    /**
     * @param {Object} walletCore - Initialized TW Wasm instance
     */
    constructor(walletCore) {
        this.core = walletCore;
        this.instances = new Map();
    }

    /**
     * General signature dispatch center
     * @param {Object} coin         - Coin object from registry.json
     * @param {string} method       - Specific signing method (e.g. signTransfer)
     * @param {Object} txData       - Transaction data
     * @param {Object} coinType     - Coin type
     */
    async sign(coinType, coin, method, txData) {
        const coinId = coin.id;
        const blockchainName = coin.blockchain.toLowerCase();

        // 1. Smart routing: look for specific ID first, then look for the general Blockchain category if not found
        let SignerClass = signerMap[coinId] || signerMap[blockchainName];

        if (!SignerClass) {
            throw new Error(`[SignerManager] No signer found for ID: ${coinId} or Blockchain: ${blockchainName}`);
        }

        // 2. Cache instance, ensuring the same coin is only initialized once
        if (!this.instances.has(coinId)) {
            const instance = new SignerClass();
            instance.core = this.core; // Inject core library
            this.instances.set(coinId, instance);
        }

        const signer = this.instances.get(coinId);

        // 3. Perform method check
        if (typeof signer[method] !== 'function') {
            throw new Error(`[SignerManager] ${coinId}Signer does not support method: ${method}`);
        }

        // 4. Execute signing
        return await signer[method](txData, coinType);
    }
}

module.exports = SignerManager;