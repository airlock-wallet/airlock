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

import { openURL } from "quasar";

/**
 * Open history records within the app (InAppBrowser)
 * @param coin Coin ID (e.g., bitcoin, ethereum, tron)
 * @param txId Transaction Hash
 */
export async function openHistory(coin, txId) {
    // 1. Map Blockchair URL naming rules
    const chairMap = {
        'btc': 'bitcoin',
        'eth': 'ethereum',
        'trx': 'tron',
        'smartchain': 'bnb',
        'ltc': 'litecoin',
        'doge': 'dogecoin',
        'bitcoincash': 'bitcoin-cash',
        'classic': 'ethereum-classic',
        'arbitrum': 'arbitrum-one',
    }
    // Convert to lowercase and map, use original name if no mapping exists
    const safeCoin = coin.toLowerCase();
    const chairName = chairMap[safeCoin] || safeCoin;

    // 2. Generate URL
    let targetUrl;
    if (coin === 'sui') {
        targetUrl = `https://suiscan.xyz/mainnet/tx/${txId}`;
    }
    else if (coin === 'avalanchec') {
        targetUrl = `https://avascan.info/blockchain/c/tx/${txId}`;
    }
    else {
        // Changed to /en/ for English context
        targetUrl = `https://blockchair.com/en/${chairName}/transaction/${txId}`;
    }

    if (cordova && cordova.InAppBrowser) {
        const options = [
            'toolbar=yes',
            'hidenavigationbuttons=yes',
            'toolbarcolor=#000000',
            'closebuttoncolor=#ffffff',
            'location=yes',
            'hideurlbar=no',
            'fullscreen=no',
            'zoom=no',
            'closebuttoncaption=✕'
        ].join(',');
        const ref = cordova.InAppBrowser.open(targetUrl, '_blank', options);
    } else {
        openURL(targetUrl)
    }
}