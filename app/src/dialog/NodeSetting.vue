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
    <q-dialog ref="dialogRef"
              @hide="onDialogHide"
              maximized
              transition-duration="500"
              transition-show="slide-up"
              transition-hide="slide-down">
        <q-card class="q-dialog-plugin column safe-full-height no-scroll safe-pb">
            <q-card-section class="col-auto row items-center q-mb-sm">
                <div class="text-h6 text-weight-bold">
                    {{ $t('settingsDialog.title') }}
                </div>
                <q-space/>
                <q-btn icon="close" color="grey-9" flat round dense v-close-popup/>
            </q-card-section>
            <q-card-section class="col column q-py-none q-mb-md">
                <q-form ref="formRef" class="col column" @submit="onSubmit">
                    <div class="col">
                        <q-input
                                ref="urlInputRef"
                                v-model="tempUrl"
                                :label="$t('settingsDialog.input.label')"
                                placeholder="https://..."
                                :hint="$t('settingsDialog.input.hint')"
                                outlined
                                :rules="[
                                        val => !!val || $t('settingsDialog.input.rule_required'),
                                        val => val.toLocaleString().startsWith('https://') || $t('settingsDialog.input.rule_https')
                                    ]"
                                clearable
                                @update:model-value="this.$refs.urlInputRef.resetValidation()"
                                lazy-rules="ondemand">
                            <template v-slot:append>
                                <q-btn v-if="!tempUrl" icon="refresh" dense size="sm" rounded color="primary" @click="resetUrl"/>
                            </template>
                        </q-input>
                        <q-banner rounded class="q-mt-lg bg-grey-2 q-py-md text-grey-9">
                            <div class="text-caption" style="line-height: 1.6;">
                                <div class="text-weight-bold q-mb-xs q-gutter-x-sm">
                                    <q-icon name="bi-hdd-network" color="grey-7" size="xs"/>
                                    <span>{{ $t('settingsDialog.banner.title') }}</span>
                                </div>
                                <div>
                                    {{ $t('settingsDialog.banner.desc_1') }}
                                    <br>
                                    {{ $t('settingsDialog.banner.desc_2_prefix') }} <span class="text-deep-orange text-weight-bold">{{ $t('settingsDialog.banner.desc_2_highlight') }}</span>{{ $t('settingsDialog.banner.desc_2_suffix') }}
                                </div>

                                <div class="q-mt-md" v-dompurify-html="$t('settingsDialog.banner.recommend_title')"></div>
                                <div class="row items-center q-gutter-x-sm q-mt-xs">
                                    <q-icon name="verified_user" color="primary" size="xs"/>
                                    <span>
                                        {{ $t('settingsDialog.banner.setup') }}
                                        <a style="text-decoration: underline; color: var(--q-primary); font-weight: bold; cursor: pointer;"
                                           href="https://github.com/airlock-wallet/services"
                                           target="_blank">
                                           {{ $t('settingsDialog.banner.private_node') }}
                                        </a>
                                        {{ $t('settingsDialog.banner.free_opensource') }}
                                    </span>
                                </div>
                            </div>
                        </q-banner>
                    </div>
                    <div class="col-auto">
                        <q-btn :label="$t('settingsDialog.btn.save_test')"
                               color="primary"
                               class="full-width"
                               padding="8px"
                               size="14px"
                               :loading="loading"
                               type="submit" />
                    </div>
                </q-form>
            </q-card-section>
        </q-card>
    </q-dialog>
</template>

<script>
import { useDialogPluginComponent, useQuasar } from 'quasar';
import {ref, onMounted} from 'vue';
import { useNodeStore } from 'stores/nodeStore';
import { api } from 'boot/axios';
import { useI18n } from 'vue-i18n'; // Import i18n

export default {
    name: "SettingsDialog",
    emits: [
        ...useDialogPluginComponent.emits
    ],

    setup() {
        const { dialogRef, onDialogOK, onDialogHide, onDialogCancel } = useDialogPluginComponent();
        const $q = useQuasar();
        const nodeStore = useNodeStore();
        const { t } = useI18n(); // Use t function

        // Refs
        const formRef = ref(null);
        const urlInputRef = ref(null);
        const tempUrl = ref('');
        const loading = ref(false);

        // Init: Read value from Store on open
        onMounted(() => {
            tempUrl.value = nodeStore.apiUrl;
        });

        // Restore default
        const resetDefault = () => {
            nodeStore.resetApiUrl();
            tempUrl.value = nodeStore.apiUrl;
            $q.notify({ message: t('settingsDialog.msg.restored') });
            // Reset validation state to avoid red error on input
            urlInputRef.value?.resetValidation();
        };

        // Submit logic
        const onSubmit = async () => {
            // 1. Basic formatting
            let url = tempUrl.value.trim().toLowerCase();

            // Auto complete https
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
                tempUrl.value = url;
            }

            // 2. Force HTTPS check (Double insurance although input rules exist)
            if (url.startsWith('http://')) {
                $q.notify({
                    type: 'negative',
                    icon: 'security',
                    message: t('settingsDialog.msg.https_only_error')
                });
                return;
            }

            if (!url.startsWith('https://')) {
                $q.notify({ type: 'warning', message: t('settingsDialog.msg.invalid_format') });
                return;
            }

            // 3. Start connection test
            loading.value = true;
            try {
                // Temp connection test: use baseURL option to override default config
                // Ensure backend supports GET request to root path '/' or specific path
                // If backend root path doesn't return 200, this might error, adjust path accordingly
                await api.get('/prices?coins=BTC', { baseURL: url, timeout: 5000 });

                // 4. Test passed, save and close dialog
                nodeStore.setApiUrl(url);
                $q.notify({ type: 'positive', message: t('settingsDialog.msg.success') });

                // Return true indicating success
                onDialogOK(true);

            } catch (e) {
                console.error(e);
                // 5. Failure handling: Ask if force save
                $q.dialog({
                    title: t('settingsDialog.msg.conn_failed_title'),
                    message: t('settingsDialog.msg.conn_failed_confirm'),
                    cancel: true,
                    persistent: true
                }).onOk(() => {
                    nodeStore.setApiUrl(url);
                    $q.notify({ type: 'warning', message: t('settingsDialog.msg.force_saved') });
                    onDialogOK(true);
                });
            } finally {
                loading.value = false;
            }
        };

        return {
            dialogRef,
            onDialogHide,
            onCancelClick: onDialogCancel, // Bind Cancel to close button

            formRef,
            urlInputRef,
            tempUrl,
            loading,

            resetDefault,
            onSubmit,
            resetUrl: () => {
                tempUrl.value = nodeStore.apiUrl;
            }
        };
    }
}
</script>