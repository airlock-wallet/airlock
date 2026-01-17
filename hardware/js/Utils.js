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

/**
 * Asynchronously read all input from stdin.
 * @return {Promise<string>}
 */
async function getStdin() {
    let result = "";
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
        result += chunk;
    }
    return result;
}

/**
 *
 * @param walletCore
 * @param id
 * @return {Promise<CoinType>}
 */
async function getCoinTypeById(walletCore, id) {
    // Iterate through all static properties of WalletCore.CoinType
    const found = Object.values(walletCore.CoinType).find((item) => {
        // Ensure the property is an object, and the value equals the ID we are looking for
        return item && typeof item === 'object' && 'value' in item && item.value === id;
    });

    if (!found) {
        throw new Error(`CoinType with id ${id} not found`);
    }
    return found;
}

async function getSecp256k1(WalletCore, wallet, coin) {
    const coinType = await getCoinTypeById(WalletCore, coin.coinId);
    const derivationPath = coin.derivation[0]['path'];
    const pathObj = WalletCore.DerivationPath.createWithString(derivationPath);
    const version = coin.derivation[0]['xpub'];
    const hDVersion = (version === undefined) ? WalletCore.HDVersion.xpub : WalletCore.HDVersion[version];
    const xpubStr = wallet.getExtendedPublicKeyAccount(pathObj.purpose(), coinType, derivationPath, hDVersion, pathObj.account());
    if (!xpubStr) {
        throw new Error(`Error creating xpub for ${coin.id}!`);
    }

    const pubKey = WalletCore.HDWallet.getPublicKeyFromExtended(xpubStr, coinType, derivationPath);
    // 2. Generate address
    const addressObj = WalletCore.AnyAddress.createWithPublicKeyDerivation(pubKey, coinType, derivationPath);
    const address = addressObj.description();

    pathObj.delete();
    pubKey.delete();
    addressObj.delete();

    return {
        status: "success",
        extendedPublicKey: xpubStr,
        address: address,
        path: derivationPath,
        coin: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        decimals: coin.decimals,
        blockchain: coin.blockchain,
        curve: coin.curve,
    }
}

async function getEd25519(WalletCore, wallet, coin, index) {
    const coinType = await getCoinTypeById(WalletCore, coin.coinId);
    const derivationPath = coin.derivation[0]['path'];
    const parts = derivationPath.split('/');
    if (parts.length > 0) {
        // Force hardening
        parts[parts.length - 1] = index.toString() + "'";
    }
    const newPath = parts.join('/');
    const key = wallet.getKey(coinType, newPath);
    const pub = key.getPublicKey(coinType);
    const addressObj = WalletCore.AnyAddress.createWithPublicKey(pub, coinType);
    const address = addressObj.description();

    key.delete();
    pub.delete();
    addressObj.delete();

    return {
        status: "success",
        extendedPublicKey: '',
        address: address,
        path: newPath,
        coin: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        decimals: coin.decimals,
        blockchain: coin.blockchain,
        curve: coin.curve,
    }
}

/**
 * Determine if it is a UTXO model
 * @param blockchain
 * @return {boolean}
 */
function isUTXO(blockchain) {
    const UTXO_CHAINS = [
        "Bitcoin",
        "BitcoinCash",
        "Zcash",
        "Decred",
        "Groestlcoin",
        "Komodo"
    ];
    return UTXO_CHAINS.includes(blockchain);
}
module.exports = {
    getStdin,
    getCoinTypeById,
    getSecp256k1,
    getEd25519,
    isUTXO,
};