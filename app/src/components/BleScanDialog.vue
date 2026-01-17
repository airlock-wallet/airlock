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
    <q-dialog ref="dialogRef" @hide="onDialogHide" maximized
              transition-duration="500"
              transition-show="slide-up"
              transition-hide="slide-down"
              class="z-max"
              persistent>
        <q-card class="q-dialog-plugin safe-full-height column no-wrap safe-pb">
            <q-card-section class="row items-center col-auto">
                <div class="text-h6 q-mt-sm">{{ dialogTitle }}<span class="text-grey-8 fs-14 q-ml-xs">({{deviceList.length}})</span></div>
                <q-space/>
                <q-btn icon="close" color="grey-9" flat round dense @click="handleCancel"/>
            </q-card-section>
            <q-card-section class="col scroll q-pa-none">
                <div class="column flex-center" style="min-height: 100%">
                    <div v-if="state === 'scanning'" class="column flex-center q-pa-md">
                        <q-spinner color="primary" size="3em"/>
                        <div class="q-mt-md text-grey-7">{{ $t('bleScanDialog.status.scanning') }}</div>
                    </div>
                    <div v-else-if="state === 'connecting'" class="column flex-center q-pa-md">
                        <q-spinner color="primary" size="3em"/>
                        <div class="q-mt-md text-weight-bold ellipsis">{{ $t('bleScanDialog.status.connecting', { device: selectedDevice?.name }) }}</div>
                        <div class="text-caption text-grey q-pb-lg">{{ $t('bleScanDialog.status.keep_near') }}</div>
                    </div>
                    <div v-else-if="state === 'idle' || state === 'found'"
                         class="full-width q-pa-md"
                         :class="deviceList.length === 0?'':'col'">
                        <div v-if="deviceList.length === 0" class="text-grey text-center">
                            <div class="q-py-xl">{{ $t('bleScanDialog.status.no_device_found') }}</div>
                        </div>
                        <q-list v-else padding>
                            <q-item
                                    v-for="dev in deviceList"
                                    :key="dev.id"
                                    clickable
                                    v-ripple
                                    class="q-py-md bg-grey-2 q-mb-sm rounded-borders"
                                    @click="doConnect(dev)">
                                <q-item-section avatar>
                                    <q-icon name="bluetooth" color="primary"/>
                                </q-item-section>
                                <q-item-section>
                                    <q-item-label class="text-subtitle2 ellipsis">{{ dev.name || $t('bleScanDialog.status.unknown_device') }}</q-item-label>
                                    <q-item-label caption class="ellipsis">{{ dev.id }}</q-item-label>
                                </q-item-section>
                                <q-item-section side>
                                    <q-icon name="chevron_right"/>
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </div>
                </div>
            </q-card-section>
            <q-card-section class="col-auto flex justify-end q-pb-lg" v-if="state !== 'connecting'">
                <q-btn :label="$t('bleScanDialog.action.rescan')"
                       color="primary"
                       @click="startScan"
                       class="full-width"
                       size="md"
                       padding="8px 0"
                       :disable="state === 'scanning'"/>
            </q-card-section>
        </q-card>
    </q-dialog>
</template>
<script>
import {useDialogPluginComponent, useQuasar} from 'quasar'
import {ref, computed, onMounted} from 'vue'
import BleService from 'src/services/BleService';
import { useI18n } from 'vue-i18n'; // Import i18n

export default {
    name: 'BleScanDialog',
    emits: [...useDialogPluginComponent.emits],

    setup() {
        const {dialogRef, onDialogHide, onDialogOK, onDialogCancel} = useDialogPluginComponent()
        const $q = useQuasar()
        const { t } = useI18n() // Use t function

        if ($q.loading.isActive) {
            $q.loading.hide();
        }

        // State machine: 'idle' | 'scanning' | 'found' | 'connecting'
        const state = ref('idle')
        const deviceList = ref([])
        const selectedDevice = ref(null)
        const isComponentAlive = ref(true)

        const dialogTitle = computed(() => {
            if (state.value === 'connecting') return t('bleScanDialog.title.connecting')
            if (state.value === 'scanning') return t('bleScanDialog.title.scanning')
            return t('bleScanDialog.title.select_device')
        })

        // --- Scan Logic ---
        const startScan = async () => {
            state.value = 'scanning'
            deviceList.value = []

            try {
                // Check if Bluetooth is enabled
                const enabled = await BleService.checkEnabled()
                if (!enabled) {
                    $q.notify({type: 'warning', message: t('bleScanDialog.error.enable_bluetooth')})
                    state.value = 'idle'
                    return
                }

                // Call Service to scan
                const results = await BleService.scan(5)

                if (!isComponentAlive.value) return

                deviceList.value = Array.from(results)
                state.value = results.length > 0 ? 'found' : 'idle'

            } catch (e) {
                console.error(e)
                if (isComponentAlive.value) {
                    $q.notify({type: 'negative', message: t('bleScanDialog.error.scan_error', { error: e.message })})
                    state.value = 'idle'
                }
            }
        }

        // --- Connect Logic ---
        const doConnect = async (device) => {
            selectedDevice.value = device
            state.value = 'connecting'

            try {
                // Call Service to connect (all retry, timeout, notify logic are in Service layer)
                await BleService.connect(device.id)

                if (!isComponentAlive.value) {
                    // If connected but window closed, disconnect just in case
                    await BleService.disconnect()
                    return
                }

                $q.notify({type: 'positive', message: t('bleScanDialog.action.connect_success')})

                // Core: Return success, let sendRequest continue
                onDialogOK(device)

            } catch (e) {
                if (!isComponentAlive.value) return

                $q.notify({
                    type: 'negative',
                    message: t('bleScanDialog.action.connect_failed'),
                    caption: e.message,
                    timeout: 2000
                })

                state.value = 'found' // Back to list
            }
        }
        onMounted(() => {
            startScan()
        })

        // --- Close Window ---
        const handleCancel = async () => {
            console.log('[BleScanDialog] User cancelled.')
            isComponentAlive.value = false

            // 2. Stop scanning immediately
            await BleService.stopScan();

            // 3. If connecting, force disconnect
            if (['connecting', 'handshaking', 'retrying'].includes(state.value)) {
                await BleService.disconnect()
            }

            // 4. Close dialog
            onDialogCancel()
        }

        return {
            dialogRef, onDialogHide,
            state,
            deviceList,
            selectedDevice,
            dialogTitle,
            startScan,
            doConnect,
            handleCancel,
        }
    }
}
</script>