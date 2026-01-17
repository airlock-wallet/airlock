<!--
Copyright (C) 2026 Le Wang

This file is part of Airlock.

Airlock is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Airlock is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Airlock.  If not, see <https://www.gnu.org/licenses/>.
-->

<template>
    <router-view />
</template>

<script>
import { defineComponent, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import BleService from 'src/services/BleService';
import BleScanDialog from 'components/BleScanDialog.vue'
import ChainService from "src/services/ChainService.js";
import { initSafeArea, setStatusBar } from "src/utils/SystemUtil.js";
import { useChainStore } from "stores/chainStore.js";
import { bus } from "boot/bus.js";

export default defineComponent({
    name: 'App',
    setup() {
        const $q = useQuasar();
        const router = useRouter();
        const chainStore = useChainStore();
        let activeConnectPromise = null;

        // Define Core Initialization Function (Heart of Hardware Logic)
        const initHardwareConfig = () => {
            console.log('[App] Device ready, starting hardware logic initialization...');

            // --- Ensure Status Bar Color is Correct ---
            if (router.currentRoute.value) {
                setStatusBar(router.currentRoute.value.meta.statusBg);
            }

            // --- UI & System Settings ---
            initSafeArea(); // Adapt for notch screens

            // --- Bluetooth Service Configuration ---
            BleService.setConnectHandler(() => {
                // Bluetooth Connection Mutex Logic (Lock)
                // If a scan dialog is already open, return the existing promise to avoid duplicates
                if (activeConnectPromise) {
                    console.log('[App] Bluetooth window already open, reusing wait...')
                    return activeConnectPromise
                }

                activeConnectPromise = new Promise((resolve, reject) => {
                    $q.dialog({
                        component: BleScanDialog
                    }).onOk((device) => {
                        resolve(device)
                    }).onCancel(() => {
                        const error = new Error('User cancelled operation');
                        error.code = 'USER_CANCELLED';
                        reject(error);
                    }).onDismiss(() => {
                        activeConnectPromise = null
                    })
                })
                return activeConnectPromise
            })

            console.log('[App] Hardware logic initialization complete!');
        }

        // Asynchronous Wallet Balance Query
        const balanceQuery = async (assets) => {
            if (!assets || assets.length === 0) return;

            console.log('[App] Received queryBalance event:', assets.length);

            // Use Promise.allSettled for concurrent queries without blocking UI
            const tasks = assets.map(asset => {
                return ChainService.getBalance(asset).catch(e => {
                    console.warn(`[AutoCheck] Failed for ${asset.symbol}:`, e.message);
                });
            });

            await Promise.allSettled(tasks);
            console.log('[App] Balance update finished.');

            // Emit the assets array (now containing updated balances)
            bus.emit('balance:updated', assets);
        }

        // Cordova specific event: fires when the native container is ready
        document.addEventListener('deviceready', initHardwareConfig, false);

        onMounted(() => {
            // Initialize supported coins
            chainStore.fetchSupported();
            bus.on('balance:query', balanceQuery);
        });

        onUnmounted(() => {
            bus.off('balance:query');
        });

    }
})
</script>