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
    <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom" class="z-top">
        <q-card class="q-dialog-plugin full-width safe-pb" style="border-top-left-radius: 16px; border-top-right-radius: 16px;">

            <q-card-section class="row items-center q-pb-none">
                <div class="text-h6 text-weight-bold flex items-center">
                    <q-icon :name="`img:${asset.icon}`" />
                    <span class="q-ml-sm">{{ $t('receiveDialog.title', { asset: asset.name }) }}</span>
                </div>
                <q-space />
                <q-btn icon="close" flat round dense v-close-popup color="grey-7" />
            </q-card-section>

            <q-card-section class="text-center text-caption text-grey-7 q-mt-md q-pb-sm">
                <span v-html="$t('receiveDialog.warning_html', { chain: asset.blockchain })"></span>
            </q-card-section>

            <q-card-section class="flex flex-center q-py-md">
                <div class="bg-white q-pa-md rounded-borders shadow-1">
                    <canvas ref="qrCanvas" style="width: 200px; height: 200px;"></canvas>
                </div>
            </q-card-section>

            <q-card-section class="q-pt-none q-pb-lg">
                <div class="bg-grey-2 q-pa-md rounded-borders text-center cursor-pointer relative-position"
                     v-ripple
                     @click="copyAddress">
                    <div class="text-caption text-grey-7 q-mb-xs">{{ $t('receiveDialog.address_hint') }}</div>
                    <div class="fs-12 text-weight-medium text-break-all text-grey-9" style="line-height: 1.4;">
                        {{ asset.address }}
                    </div>
                </div>
            </q-card-section>

            <q-card-section class="q-px-md q-py-none q-mb-md">
                <q-btn
                        :label="$t('receiveDialog.btn_share')"
                        color="primary"
                        class="q-py-sm full-width"
                        size="md"
                        no-caps
                        @click="shareAddress"
                />
            </q-card-section>

        </q-card>
    </q-dialog>
</template>

<script>
import {defineComponent, ref, watch} from 'vue';
import { useDialogPluginComponent, useQuasar } from 'quasar';
import QRCode from 'qrcode';
import { useI18n } from 'vue-i18n'; // Import i18n

export default defineComponent({
    name: "Receive",
    // Receive external parameters
    props: {
        asset: {type: Object, required: true}
    },
    emits: [
        ...useDialogPluginComponent.emits
    ],
    setup(props) {
        const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
        const $q = useQuasar();
        const { t } = useI18n(); // Use t function
        const qrCanvas = ref(null);
        const asset = props.asset;

        // QR code generation logic
        watch(() => qrCanvas.value, () => {
            QRCode.toCanvas(qrCanvas.value, asset.address, {
                width: 200,
                margin: 0,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            }, (error) => {
                if (error) console.error('QR Generate Error:', error);
            });
        })

        // Copy address
        const copyAddress = () => {
            if (window.cordova && cordova.plugins && cordova.plugins.clipboard) {
                cordova.plugins.clipboard.copy(asset.address, () => {
                    $q.notify({type: 'positive', message: t('receiveDialog.msg.copied'), timeout: 1000})
                }, (error) => {
                    reject(error);
                    $q.notify({ message: t('receiveDialog.msg.copy_failed'), color: 'negative' });
                });
            } else {
                $q.notify({ message: t('receiveDialog.msg.clipboard_not_ready'), color: 'negative' });
            }
        };

        // Share address (Reserved)
        const shareAddress = () => {
            // Check if plugin is installed
            if (window.plugins && window.plugins.socialsharing) {
                const message = t('receiveDialog.msg.share_text', {
                    symbol: asset.symbol,
                    chain: asset.chain || asset.blockchain, // Fallback to blockchain if chain is undefined
                    address: asset.address
                });

                window.plugins.socialsharing.share(
                        message,
                        t('receiveDialog.msg.share_title'),
                        null,
                        null
                );
            } else {
                // Fallback: If no plugin (e.g. browser debug), execute "copy to clipboard"
                copyAddress();
            }
        };

        return {
            dialogRef,
            onDialogHide,
            qrCanvas,
            copyAddress,
            shareAddress,
        };
    }
});
</script>

<style scoped>

</style>