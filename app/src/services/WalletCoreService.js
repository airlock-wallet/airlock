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

import {WalletCore} from "boot/wallet.js";

class WalletCoreService {
    constructor() {
        this.coinMap = null;
    }

    _initCoinMap(walletCore) {
        if (this.coinMap && this.coinMap.size > 0) return;
        this.coinMap = new Map();
        Object.values(walletCore.CoinType).forEach(item => {
            if (item && typeof item === 'object' && 'value' in item) {
                this.coinMap.set(item.value, item);
            }
        });
    }

    getCoinTypeById(walletCore, coinId) {
        this._initCoinMap(walletCore);
        const found = this.coinMap.get(coinId);
        if (!found) throw new Error(`CoinType with id ${coinId} not found`);
        return found;
    }

    /**
     * Derive address from Xpub and full path
     * @param {String} xpub - Extended public key (zpub/xpub)
     * @param {int} coinId - Coin numeric ID
     * @param {String} fullPath - Full path (e.g. "m/84'/0'/0'/0/5")
     * @returns {Promise<{address: string, path: string}>}
     */
    async deriveAddressFromXpub(xpub, coinId, fullPath) {
        if (!WalletCore) throw new Error('WalletCore not initialized');

        // WalletCore.CoinType is usually an enum, key names might be lowercase or uppercase, watch out for matching
        // Assuming coinId is 'bitcoin', WalletCore.CoinType.bitcoin exists
        const coinType = this.getCoinTypeById(WalletCore, coinId);

        if (!coinType) throw new Error(`WalletCore CoinType not found for ${blockchain}`);

        let pubKey = null;
        let addressObj = null;

        try {
            console.log(`[WalletCore] Deriving ${coinId} at ${fullPath}, coinType is ${coinType.value}`);

            // 2. Core derivation logic (fully referencing your test code)
            // Key point: getPublicKeyFromExtended accepts full path and will automatically calculate relative path
            pubKey = WalletCore.HDWallet.getPublicKeyFromExtended(
                xpub,
                coinType,
                fullPath
            );

            if (!pubKey) throw new Error('Failed to generate public key');

            // Smart selection of Derivation mode
            let derivation = WalletCore.Derivation.default;

            addressObj = WalletCore.AnyAddress.createWithPublicKeyDerivation(
                pubKey,
                coinType,
                derivation
            );

            const address = addressObj.description();

            console.log(`[WalletCore] Xpub is ${xpub}`);
            console.log(`[WalletCore] Create wallet address is ${address} and derivationPath is ${fullPath}`);

            return {
                address: address,
                path: fullPath
            };

        } catch (e) {
            console.error('[WalletCore] Derivation Error:', e);
            throw e;
        } finally {
            if (pubKey) {
                pubKey.delete();
            }
            if (addressObj) {
                addressObj.delete();
            }
        }
    }
}

export default new WalletCoreService();