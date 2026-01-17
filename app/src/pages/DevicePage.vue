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
    <div class="bg-grey-1 column no-wrap overflow-hidden q-px-md" :style="pageStyle">
        <div class="col-auto row items-center justify-between q-mb-sm safe-pt">
            <span class="text-h6">{{ $t('devicePage.title') }}</span>
            <q-btn v-if="deviceStore.name" flat round icon="more_vert" color="grey-8">
                <q-menu auto-close class="q-py-xs">
                    <q-list separator>
                        <q-item clickable v-ripple @click="throttleLoadDevice">
                            <q-item-section side>
                                <q-icon name="autorenew" color="grey" size="xs"/>
                            </q-item-section>
                            <q-item-section>
                                <q-item-label lines="1">{{ $t('devicePage.menu.refresh') }}</q-item-label>
                            </q-item-section>
                        </q-item>
                        <q-item clickable v-ripple @click="handleReboot">
                            <q-item-section side>
                                <q-icon name="refresh" color="grey" size="xs"/>
                            </q-item-section>
                            <q-item-section>
                                <q-item-label lines="1">{{ $t('devicePage.menu.reboot') }}</q-item-label>
                            </q-item-section>
                        </q-item>
                        <q-item clickable v-ripple @click="handleShutdown">
                            <q-item-section side>
                                <q-icon name="power_settings_new" color="negative" size="xs"/>
                            </q-item-section>
                            <q-item-section>
                                <q-item-label class="text-negative" lines="1">{{ $t('devicePage.menu.shutdown') }}</q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-menu>
            </q-btn>
        </div>
        <q-list v-if="deviceStore.name" class="col scroll" separator padding>
            <q-item class="q-py-md">
                <q-item-section avatar>
                    <q-icon color="primary" name="memory" size="md"/>
                </q-item-section>
                <q-item-section>
                    <q-item-label caption>{{ $t('devicePage.label.device_name') }}</q-item-label>
                    <q-item-label class="text-body1">
                        <q-icon
                                :color="BleService.isConnected ? 'positive' : 'grey-5'"
                                name="fiber_manual_record"
                                size="xs"
                        />
                        {{ deviceStore.name }}
                    </q-item-label>
                </q-item-section>
            </q-item>
            <q-item class="q-py-md">
                <q-item-section avatar>
                    <q-icon color="teal" name="verified" size="md"/>
                </q-item-section>
                <q-item-section>
                    <q-item-label caption>{{ $t('devicePage.label.firmware_version') }}</q-item-label>
                    <q-item-label class="text-body1">{{ deviceStore.version }}.{{userStore.walletMode==='HIDDEN'?'25':'24'}}</q-item-label>
                </q-item-section>
            </q-item>
            <q-item class="q-py-md">
                <q-item-section avatar>
                    <q-icon color="blue-grey" name="terminal" size="md"/>
                </q-item-section>
                <q-item-section>
                    <q-item-label caption>{{ $t('devicePage.label.platform') }}</q-item-label>
                    <q-item-label class="text-body1">Linux/Debian</q-item-label>
                </q-item-section>
            </q-item>
            <q-item class="q-py-md">
                <q-item-section avatar>
                    <q-icon color="purple" name="hardware" size="md"/>
                </q-item-section>
                <q-item-section>
                    <q-item-label caption>{{ $t('devicePage.label.hardware') }}</q-item-label>
                    <q-item-label class="text-body1">{{ deviceStore.hardware }}</q-item-label>
                </q-item-section>
            </q-item>
            <q-item class="q-py-md">
                <q-item-section avatar>
                    <q-icon color="brown-9" name="screenshot_monitor" size="md"/>
                </q-item-section>
                <q-item-section>
                    <q-item-label caption>{{ $t('devicePage.label.display') }}</q-item-label>
                    <q-item-label class="text-body1">{{ deviceStore.screen }}</q-item-label>
                </q-item-section>
            </q-item>
            <q-item class="q-py-md">
                <q-item-section avatar>
                    <q-icon color="deep-orange" name="thermostat" size="md"/>
                </q-item-section>
                <q-item-section>
                    <q-item-label caption>{{ $t('devicePage.label.cpu_temp') }}</q-item-label>
                    <q-item-label class="text-body1">{{ BleService.isConnected ? deviceStore.CPU : '0C'}}</q-item-label>
                </q-item-section>
            </q-item>
            <q-separator />
        </q-list>
        <div v-else class="text-center q-mt-xl text-grey-8">
            {{ $t('devicePage.no_device_connected') }}
        </div>
    </div>
</template>

<script>
import {useDeviceStore} from "stores/deviceStore.js";
import BleService from 'src/services/BleService';
import {computed, defineAsyncComponent, inject, onMounted, ref} from "vue";
import {useQuasar, throttle} from "quasar";
import {useUserStore} from "stores/userStore.js";
import { useI18n } from 'vue-i18n'; // Import i18n

export default {
    name: "DevicePage",
    setup() {
        const $q = useQuasar();
        const { t } = useI18n(); // Use t function
        const deviceStore = useDeviceStore();
        const userStore = useUserStore();
        const footerHeight = inject('layoutFooterHeight', ref(70));
        const pageStyle = computed(() => {
            return {
                height: `calc(100vh - ${footerHeight.value}px)`,
            }
        });
        async function loadDevice() {
            try {
                $q.loading.show();
                const device = await BleService.sendRequest('get_device_info', {mode: userStore.walletMode});
                if (device) {
                    await deviceStore.setDevice(device);
                    console.log(`Get setting info success:${JSON.stringify(device)}`)
                    $q.notify({
                        type: 'positive',
                        message: t('devicePage.msg.refresh_success')
                    })
                }
            } catch (e) {
                console.error("Failed to get device info:", e);
                $q.notify({
                    type: 'negative',
                    message: t('devicePage.msg.get_info_failed'),
                    caption: e.message || t('devicePage.msg.unknown_error')
                });
            } finally {
                if ($q.loading.isActive) {
                    $q.loading.hide();
                }
            }
        }

        function handleReboot() {
            $q.dialog({
                component: defineAsyncComponent(() => import('src/dialog/Confirm.vue')),
                componentProps: {
                    title: t('devicePage.dialog.reboot_title'),
                    message: t('devicePage.dialog.reboot_msg')
                }
            }).onOk(async () => {
                try {
                    $q.loading.show();
                    const device = await BleService.sendRequest('reboot', {});
                    if (device) {
                        $q.notify({
                            type: 'positive',
                            message: t('devicePage.msg.reboot_sent')
                        })
                    }
                } catch (e) {
                    console.error("Failed to get device info:", e);
                    $q.notify({
                        type: 'negative',
                        message: t('devicePage.msg.reboot_failed'),
                        caption: e.message || t('devicePage.msg.unknown_error')
                    });
                } finally {
                    if ($q.loading.isActive) {
                        $q.loading.hide();
                    }
                }
            })
        }
        function handleShutdown() {
            $q.dialog({
                component: defineAsyncComponent(() => import('src/dialog/Confirm.vue')),
                componentProps: {
                    title: t('devicePage.dialog.shutdown_title'),
                    message: t('devicePage.dialog.shutdown_msg')
                }
            }).onOk(async () => {
                try {
                    $q.loading.show();
                    const device = await BleService.sendRequest('shutdown', {});
                    if (device) {
                        $q.notify({
                            type: 'positive',
                            message: t('devicePage.msg.shutdown_sent')
                        })
                    }
                } catch (e) {
                    console.error("Failed to get device info:", e);
                    $q.notify({
                        type: 'negative',
                        message: t('devicePage.msg.shutdown_failed'),
                        caption: e.message || t('devicePage.msg.unknown_error')
                    });
                } finally {
                    if ($q.loading.isActive) {
                        $q.loading.hide();
                    }
                }
            })
        }

        const throttleLoadDevice = throttle(loadDevice, 3000);

        onMounted(async () => {
            if (!deviceStore.name) {
                await loadDevice();
            }
        });

        return {
            deviceStore,
            throttleLoadDevice,
            pageStyle,
            handleReboot,
            handleShutdown,
            BleService,
            userStore,
        }
    }
}
</script>

<style scoped>

</style>