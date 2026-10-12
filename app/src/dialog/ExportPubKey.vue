<!-- src/dialog/ExportPubKey.vue -->
<template>
    <q-dialog ref="dialogRef"
              @hide="onDialogHide"
              maximized
              transition-duration="500"
              transition-show="slide-up"
              transition-hide="slide-down">
        <q-card class="q-dialog-plugin column safe-pt safe-mb no-scroll bg-grey-1">
            <q-card-section class="col-auto row items-center bg-white shadow-1 z-top">
                <div class="text-h6 text-weight-bold">{{ $t('exportPubKey.title') }}</div>
                <q-space/>
                <q-btn icon="close" color="grey-9" flat round dense v-close-popup/>
            </q-card-section>

            <q-card-section class="col scroll q-pa-md column">
                <div class="text-caption text-grey-8 q-mb-sm">
                    {{ $t('exportPubKey.description') }}
                </div>

                <q-input
                        :model-value="jsonData"
                        type="textarea"
                        outlined
                        readonly
                        class="col bg-white"
                        input-class="text-mono"
                        input-style="height: 100%; min-height: 65vh; resize: none;"
                />
            </q-card-section>

            <q-card-actions class="col-auto bg-white safe-mb shadow-up-1 q-pa-md">
                <q-btn :label="$t('exportPubKey.btn_copy')"
                       color="primary"
                       class="full-width"
                       padding="8px"
                       size="14px"
                       @click="doCopy"/>
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>

<script>
import { defineComponent } from 'vue';
import { useDialogPluginComponent, useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';

export default defineComponent({
    name: "ExportPubKey",
    props: {
        jsonData: { type: String, required: true }
    },
    emits: [
        ...useDialogPluginComponent.emits
    ],

    setup(props) {
        const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();
        const $q = useQuasar();
        const { t } = useI18n();

        async function doCopy() {
            if (window.cordova && cordova.plugins && cordova.plugins.clipboard) {
                // 修复点：将未定义的 asset.address 替换为 props.jsonData
                cordova.plugins.clipboard.copy(props.jsonData, () => {
                    $q.notify({
                        type: 'positive',
                        message: t('exportPubKey.msg.copied'),
                        timeout: 1000
                    });
                }, (error) => {
                    console.error('Clipboard copy error:', error);
                    $q.notify({
                        type: 'negative',
                        message: t('exportPubKey.msg.copy_failed')
                    });
                });
            } else {
                $q.notify({
                    type: 'negative',
                    message: t('exportPubKey.msg.clipboard_not_ready')
                });
            }
        }

        return {
            dialogRef,
            onDialogHide,
            onOKClick() { onDialogOK() },
            onCancelClick: onDialogCancel,
            doCopy
        }
    }
});
</script>

<style scoped>
.text-mono {
    font-family: monospace;
    font-size: 13px;
    line-height: 1.5;
}
</style>