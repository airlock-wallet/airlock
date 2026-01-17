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

import { isMemoSupported } from "src/utils/ChainUtil.js";
import { WalletCore } from "boot/wallet.js";
import WalletCoreService from "src/services/WalletCoreService.js";
import { reactive } from "vue";

/**
 * Transaction Strategy Base Class
 * Defines the interface that all chains must implement
 */
export default class TxStrategy {
    constructor(asset, chainStore) {
        this.asset = asset;
        this.chainStore = chainStore;
        // Internal storage for network parameters (nonce, gas, utxos, etc.)
        this.networkParams = reactive({});
    }

    /**
     * Fetch on-chain data
     * @param {string} amount User input amount (used for UTXO selection estimation)
     * @param {string} toAddress
     */
    async fetchNetworkData(amount, toAddress = null) {
        throw new Error('Method not implemented');
    }

    /**
     * Validate address format
     * @param {string} address
     * @returns {boolean}
     */
    validateAddress(address) {
        if (!WalletCore || !address) return false;
        try {
            const coinObj = this.chainStore.getCoin(this.asset.coin);
            const coinType = WalletCoreService.getCoinTypeById(WalletCore, coinObj.coinId);
            return WalletCore.AnyAddress.isValid(address, coinType);
        } catch (e) {
            return false;
        }
    }

    /**
     * Get estimated fee for UI display
     * @returns {string} e.g. "0.002 ETH"
     */
    getDisplayFee() {
        return '0';
    }

    /**
     * Construct signing parameters (data sent to hardware/Worker)
     * @param {object} form Form data { to, amount, memo, ... }
     * @param {string} password Wallet password (optional)
     * @param {string} walletMode Wallet mode (WATCH, HOT, COLD_BLE)
     * @returns {Promise<Object>}
     */
    async buildParams(form, password, walletMode) {
        throw new Error('Method not implemented');
    }

    /**
     * Check if Memo is supported
     * @returns {boolean}
     */
    hasMemo() {
        return isMemoSupported(this.asset.blockchain);
    }
}