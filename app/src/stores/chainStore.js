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

import { defineStore } from "pinia";
import {computed, ref} from "vue";
import {api} from "boot/axios.js";
import registryData from 'src/assets/registry.json'

export const useChainStore = defineStore('chainStore', () => {
    const registry = Object.fromEntries(
        registryData.map(item => [item.id, item])
    );
    const allowCoins = ref(['bitcoin', 'ethereum', 'bsc', 'tron']);
    const allowTokens = ref([
        {'coin': 'tron', 'symbol': 'USDT', 'name': 'USDT-TRC20', 'contract': 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 'decimals': 6, 'icon': 'usdttrc20.svg'}
    ])

    // Wallet filter state
    // Structure example: { 'bitcoin': { name: 'all', minBalance: 0, keyword: '' }, 'tron': { ... } }
    const walletFilters = ref({});

    // Get filters for a specific coin (return default values if not found)
    const getFiltersForCoin = (coinId) => {
        return walletFilters.value[coinId] || { name: 'all', minBalance: '', keyword: '' };
    }

    // Save filters for a specific coin
    const saveFiltersForCoin = (coinId, filters) => {
        // Use destructuring assignment to prevent reference pollution
        walletFilters.value[coinId] = { ...filters };
    }

    async function fetchSupported() {
        try {
            const response = await api.get('/config/tokens', {
                timeout: 5000,
            });

            if (response.status === 200) {
                // --- 1. allowCoins Deduplication (String Array) ---
                // Use Set to automatically filter duplicate values, then convert back to array
                const rawCoins = response.data.coins || [];
                allowCoins.value = [...new Set(rawCoins)];

                // --- 2. allowTokens Deduplication (Object Array, based on contract) ---
                const rawTokens = response.data.tokens || [];
                const tokenMap = new Map();

                rawTokens.forEach(token => {
                    // Only process when contract exists
                    if (token.contract) {
                        // Convert address to lowercase as Key, preventing '0xABC' and '0xabc' from being treated as two coins
                        tokenMap.set(token.contract.toLowerCase(), token);
                    }
                });

                // Convert Map values back to array
                allowTokens.value = Array.from(tokenMap.values());
            }
        } catch (e) {
            console.warn(`Request error:${e.message}`)
        }
    }

    // Get supported main coins (Computed)
    const validCoins = computed(() => {
        return allowCoins.value
            .map(id => registry[id])  // 1. Map id (e.g. "bitcoin") to object in registry
            .filter(coin => coin);    // 2. Filter out undefined not found in registry (Safety check)
    });

    // Get registry.json item object
    const getCoin = (coin) => {
        return validCoins.value.find(c => c.id === coin);
    }

    // Get supported tokens
    const getValidTokens = (coin) => {
        return allowTokens.value.filter(c => c.coin === coin);
    }

    return {
        registry,
        allowCoins,
        allowTokens,
        validCoins,
        fetchSupported,
        getValidTokens,
        getCoin,
        walletFilters,
        getFiltersForCoin,
        saveFiltersForCoin,
    }
}, {
    persist: {
        key: 'chainStore',
        storage: localStorage,
        pick: ['allowCoins', 'allowTokens', 'walletFilters']
    }
});