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
import { ref } from "vue";
import { api } from "boot/axios";

export const usePriceStore = defineStore('priceStore', () => {

    // --- State ---
    const priceMap = ref({});
    const lastUpdated = ref(0);

    // --- Actions ---
    const fetchPrices = async (symbols) => {
        if (!symbols || symbols.length === 0) return;

        // If too close to last update, skip to prevent frequent requests
        if (Date.now() - lastUpdated.value < 3000) return;

        try {
            const response = await api.get('/prices', {
                params: { coins: symbols.join(',') }
            });

            if (response.data.code === 200) {
                // Update data: merge new data while keeping old data
                priceMap.value = { ...priceMap.value, ...response.data.data };
                lastUpdated.value = Date.now();
            }
        } catch (e) {
            console.error("Store failed to update prices:", e);
        }
    };

    // --- Getters (Exposed as normal functions) ---
    // Get price of a single coin, return 0 if not found
    const getPrice = (symbol) => {
        return priceMap.value[symbol] || 0;
    };

    // Must return to be used by components
    return {
        priceMap,
        lastUpdated,
        fetchPrices,
        getPrice
    };

}, {
    // --- Persistence Options ---
    persist: {
        key: 'priceStore', // Key name for local storage
        storage: localStorage, // Specify storage location
        // pick: ['priceMap'], // Optional: Only persist priceMap, not lastUpdated
    }
});