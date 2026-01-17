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

import { defineStore } from 'pinia';
import { ref } from 'vue';

const DEFAULT_API_URL = 'https://api.airlock.pub';
const API_KEY = 'airlock_api_url';

export const useNodeStore = defineStore('nodeStore', () => {

    // --- State ---
    // Prioritize reading localStorage on initialization, otherwise use default value
    const apiUrl = ref(localStorage.getItem(API_KEY) || DEFAULT_API_URL);

    // --- Actions ---
    const setApiUrl = (url) => {
        if (!url) return;

        const cleanUrl = url.replace(/\/$/, ''); // Remove trailing slash

        // 1. Update memory state (Pinia)
        apiUrl.value = cleanUrl;

        // 2. Sync write to disk (LocalStorage)
        // Note: Although Pinia has a persist plugin, manual setItem is often more controllable for simple configs,
        // Since your previous logic was manual, keep it manual here, or you can choose to use a plugin like priceStore.
        // To remain consistent with your logic and lightweight, save manually here:
        localStorage.setItem(API_KEY, cleanUrl);
    };

    const resetApiUrl = () => {
        apiUrl.value = DEFAULT_API_URL;
        localStorage.removeItem(API_KEY);
    };

    return {
        apiUrl,
        setApiUrl,
        resetApiUrl
    };
});