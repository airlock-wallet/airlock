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
import { ref, computed } from "vue";
import { generateSalt, hashPin } from "src/utils/SecurityUtil.js";
import { clearAllData } from "src/services/DbService";
import {NativeStorageService} from "src/services/NativeStorageService.js";

// Define storage key name
const STORAGE_KEY = 'wallet_auth_data';

export const useUserStore = defineStore('userStore', () => {
    // ==========================================
    // 1. State
    // ==========================================
    // --- Core Data Requiring Persistence ---
    const salt = ref('');
    const aPinHash = ref('');
    const bPinHash = ref('');

    // --- Runtime State (Not persisted, lost on refresh/restart) ---
    const isUnlocked = ref(false);
    const walletMode = ref(null); // 'STANDARD' | 'HIDDEN' | null

    // ==========================================
    // 2. Getters
    // ==========================================
    const hasInitialized = computed(() => !!bPinHash.value && !!salt.value);
    const isMain = computed(() => walletMode.value === 'HIDDEN');

    // ==========================================
    // 3. Actions
    // ==========================================

    /**
     * Initialization: Call this method to load data when App starts
     * Please await userStore.loadStoredData() in App.vue or boot file
     */
    async function loadStoredData() {
        try {
            const data = await NativeStorageService.getItem(STORAGE_KEY);
            if (data) {
                // Restore persisted state
                salt.value = data.salt || '';
                aPinHash.value = data.aPinHash || '';
                bPinHash.value = data.bPinHash || '';
            }
        } catch (e) {
            console.error('Load NativeStorage failed', e);
        }
    }

    /** Internal: Ensure salt exists */
    function _ensureSalt() {
        if (!salt.value) {
            salt.value = generateSalt();
        }
    }

    /** Logout (Clear memory state only) */
    function logout() {
        isUnlocked.value = false;
        walletMode.value = null;
    }

    /** Reset Wallet (Clear all data) */
    async function resetWallet() {
        // 1. Clear memory state
        salt.value = '';
        aPinHash.value = '';
        bPinHash.value = '';
        logout();

        // 2. Clear NativeStorage (Android SharedPreferences)
        try {
            await NativeStorageService.remove(STORAGE_KEY);
        } catch (e) {
            console.warn('Remove NativeStorage failed', e);
        }

        // 3. Clear SQLite business data
        if (clearAllData) await clearAllData();
    }

    /** Set Wallet PIN (Write to persistence) */
    async function setupWalletPins(rawPinA, rawPinB) {
        _ensureSalt();

        const [hashA, hashB] = await Promise.all([
            hashPin(rawPinA, salt.value),
            hashPin(rawPinB, salt.value)
        ]);

        // Update memory state
        aPinHash.value = hashA;
        bPinHash.value = hashB;

        // Manually write to NativeStorage
        try {
            await NativeStorageService.setItem(STORAGE_KEY, {
                salt: salt.value,
                aPinHash: aPinHash.value,
                bPinHash: bPinHash.value
            });
        } catch (e) {
            console.error('Save to NativeStorage failed!', e);
            // Can throw error here to notify frontend of save failure
            throw e;
        }

        // Attempt to clear old business data (SQLite)
        try {
            if (clearAllData) await clearAllData();
        } catch (e) {
            console.error('[UserStore] Clear DB failed:', e);
        }

        logout();
    }

    /** Verify Login */
    async function verifyAndUnlock(inputPin) {
        if (!hasInitialized.value) return false;

        const inputHash = await hashPin(inputPin, salt.value);

        if (inputHash === bPinHash.value) {
            isUnlocked.value = true;
            walletMode.value = 'STANDARD';
            return true;
        }

        if (inputHash === aPinHash.value) {
            isUnlocked.value = true;
            walletMode.value = 'HIDDEN';
            return true;
        }

        return false;
    }

    /** Update PIN */
    async function updatePin(oldPin, newPin) {
        // 1. Basic check
        if (!hasInitialized.value || !walletMode.value) return false;

        // 2. Calculate Hash
        const oldHash = await hashPin(oldPin, salt.value);
        const newHash = await hashPin(newPin, salt.value);

        // 3. Logic branching based on current wallet mode
        if (walletMode.value === 'STANDARD') {
            if (oldHash !== bPinHash.value) {
                throw new Error('Old PIN incorrect');
            }
            if (newHash === aPinHash.value) {
                throw new Error('Illegal PIN');
            }
            bPinHash.value = newHash;
        } else if (walletMode.value === 'HIDDEN') {
            if (oldHash !== aPinHash.value) {
                throw new Error('Old PIN incorrect');
            }
            if (newHash === bPinHash.value) {
                throw new Error('Illegal PIN');
            }
            aPinHash.value = newHash;
        } else {
            throw new Error('Illegal Update');
        }

        // 4. Persistence Save (Write updated state to storage)
        try {
            await NativeStorageService.setItem(STORAGE_KEY, {
                salt: salt.value,
                aPinHash: aPinHash.value,
                bPinHash: bPinHash.value
            });

            return true;
        } catch (e) {
            throw e;
        }
    }

    // ==========================================
    // 4. Return
    // ==========================================
    return {
        // State
        salt,
        aPinHash,
        bPinHash,
        isUnlocked,
        walletMode,
        // Getters
        hasInitialized,
        isMain,
        // Actions
        loadStoredData,
        setupWalletPins,
        verifyAndUnlock,
        logout,
        resetWallet,
        updatePin,
    };
});