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
    <q-page class="column flex-center bg-grey-1 text-center q-pa-md">

        <q-icon name="img:/images/logo-grey.svg" size="80px" class="q-mb-md" />
        <div class="text-h5 text-grey-8 text-weight-bold">{{ $t('loadWalletPage.title') }}</div>
        <div class="text-caption text-grey-6 q-mb-xl" style="max-width: 300px" v-html="$t('loadWalletPage.description_html')"></div>

        <q-btn
                v-if="!isSyncing"
                rounded
                unelevated
                size="16px"
                color="primary"
                class="q-px-xl shadow-3 btn-icon-14"
                icon="bluetooth_searching"
                :label="$t('loadWalletPage.btn_connect')"
                :loading="isSyncing"
                @click="handleSyncAction"
        />

        <div v-else class="column flex-center">
            <q-spinner color="primary" size="3em" />
            <div class="fs-14 q-mt-md">{{ syncStatus }}</div>
            <div class="fs-12 text-grey-6">{{ syncDetail }}</div>
        </div>
    </q-page>
</template>

<script>
import { defineComponent, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { saveAccounts } from 'src/services/DbService';
import {useDeviceStore} from "stores/deviceStore.js";
import {useUserStore} from "stores/userStore.js";
import BleService from 'src/services/BleService';
import { useI18n } from 'vue-i18n'; // Import i18n

export default defineComponent({
    name: 'LoadWalletPage',
    setup() {
        const $q = useQuasar();
        const { t } = useI18n(); // Use t function
        const router = useRouter();
        const deviceStore = useDeviceStore();
        const userStore = useUserStore();
        const isSyncing = ref(false);
        const syncStatus = ref('');
        const syncDetail = ref('');

        /**
         * [Core] Click Handler - Lazy Load Mode
         * Logic simplified:
         * 1. User clicks button -> call startDataSync
         * 2. startDataSync calls BleService.sendRequest
         * 3. If not connected, BleService automatically invokes global dialog in App.vue
         * 4. After successful connection, Promise continues, data returns
         */
        const handleSyncAction = async () => {
            await startDataSync();
        };

        /**
         * [Business] Start Data Sync
         */
        const startDataSync = async () => {
            if (isSyncing.value) return;

            isSyncing.value = true;
            syncStatus.value = t('loadWalletPage.status.ready');

            try {
                // 1. Request account list
                // This step triggers auto-connection flow (if not connected)
                syncStatus.value = t('loadWalletPage.status.connecting');

                // No need for await BleService.connect(), just send request
                // Service layer handles: Not Connected -> Dialog -> Scan -> Connect -> Handshake -> Send -> Return
                const accounts = await BleService.sendRequest('get_accounts', {coins: ['bitcoin', 'ethereum', 'smartchain', 'tron']}, 5000);

                // Code reaches here means connection + request successful
                syncStatus.value = t('loadWalletPage.status.parsing');
                syncDetail.value = t('loadWalletPage.status.detail_confirm');

                if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
                    throw new Error(t('loadWalletPage.msg.empty_response'));
                }

                // 2. Start saving
                syncStatus.value = t('loadWalletPage.status.saving');
                syncDetail.value = t('loadWalletPage.status.saving_detail');

                // Save wallet
                await saveAccounts(accounts);

                // Get device type
                const device = await BleService.sendRequest('get_device_info', {mode: userStore.walletMode});
                if (device) {
                    deviceStore.setDevice(device).catch(e => console.error(e));
                    console.log(`Device Info: ${JSON.stringify(device)}`)
                }

                // Simple delay to let user see status change (optional)
                await new Promise(r => setTimeout(r, 500));

                // 3. Success redirect
                router.replace('/');

            } catch (e) {
                console.error('Sync Error:', e);

                // Friendly message
                let msg = e.message || t('loadWalletPage.msg.unknown_error');
                if (e.code === 'USER_CANCELLED') {
                    return; // Don't error on user cancel
                }

                $q.notify({
                    type: 'negative',
                    message: t('loadWalletPage.msg.sync_failed'),
                    caption: msg,
                    timeout: 3000
                });

                // If sync failed (not user cancel), disconnect to reset state, preventing "zombie state"
                // So next click will trigger full scan & connect flow
                await BleService.disconnect();
            } finally {
                isSyncing.value = false;
            }
        };

        return {
            isSyncing,
            syncStatus,
            syncDetail,
            BleService,
            handleSyncAction
        };
    }
});
</script>