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
import { NativeStorageService } from "src/services/NativeStorageService.js";

// Define storage key name
const STORAGE_KEY = 'bluetooth_device_info';

export const useDeviceStore = defineStore('deviceStore', () => {

    const deviceId = ref(null);
    const name = ref(null);
    const version = ref(null);
    const hardware = ref(null);
    const screen = ref(null);
    const CPU = ref(null);
    const isInitialized = ref(false);
    const lastTime = ref(null);

    /**
     * Initialization: Call this method to load data when App starts
     */
    async function loadStoredData() {
        try {
            const data = await NativeStorageService.getItem(STORAGE_KEY);
            if (data) {
                deviceId.value = data.deviceId || null;
                name.value = data.name || null;
                version.value = data.version || null;
                hardware.value = data.hardware || null;
                screen.value = data.screen || null;
                CPU.value = data.CPU || null;
                // Note boolean value restoration
                if (data.isInitialized !== undefined) isInitialized.value = data.isInitialized;
                if (data.lastTime) lastTime.value = data.lastTime;
            }
        } catch (e) {
            console.error('[DeviceStore] Load NativeStorage failed', e);
        }
    }

    /**
     * Set/Update device info (Merge Mode)
     * @param {Object} payload Partial or complete device info
     */
    async function setDevice(payload) {
        if (!payload) return;

        // 1. Merge state: Only update fields present in payload
        if (payload.deviceId !== undefined) deviceId.value = payload.deviceId;
        if (payload.name !== undefined) name.value = payload.name;
        if (payload.version !== undefined) version.value = payload.version;
        if (payload.hardware !== undefined) hardware.value = payload.hardware;
        if (payload.screen !== undefined) screen.value = payload.screen;
        if (payload.CPU !== undefined) CPU.value = payload.CPU;
        if (payload.is_initialized !== undefined) isInitialized.value = payload.is_initialized;

        lastTime.value = new Date();

        // 2. Construct complete object to write to NativeStorage
        const storageObj = {
            deviceId: deviceId.value,
            name: name.value,
            version: version.value,
            hardware: hardware.value,
            screen: screen.value,
            CPU: CPU.value,
            isInitialized: isInitialized.value,
            lastTime: lastTime.value,
        };

        try {
            await NativeStorageService.setItem(STORAGE_KEY, storageObj);
        } catch (e) {
            console.error('[DeviceStore] Save to NativeStorage failed!', e);
            throw e;
        }
    }

    /**
     * Reset device info (Clear connection record)
     */
    async function resetDevice() {
        // 1. Clear memory state
        deviceId.value = null;
        name.value = null;
        version.value = null;
        hardware.value = null;
        screen.value = null;
        CPU.value = null;
        isInitialized.value = false;
        lastTime.value = null;

        // 2. Clear NativeStorage
        try {
            await NativeStorageService.remove(STORAGE_KEY);
        } catch (e) {
            console.warn('[DeviceStore] Remove NativeStorage failed', e);
        }
    }

    return {
        // State
        deviceId,
        name,
        version,
        hardware,
        screen,
        CPU,
        isInitialized,
        lastTime,
        // Actions
        loadStoredData,
        setDevice,
        resetDevice
    }
});