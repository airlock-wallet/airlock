<template>
    <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
        <q-card class="q-dialog-plugin safe-pb" style="border-top-left-radius: 16px; border-top-right-radius: 16px;">
            <div class="row items-center q-pa-md border-bottom">
                <div class="text-h6">{{ $t('mePage.list.language') }}</div>
                <q-space />
                <q-btn icon="close" flat round dense v-close-popup color="grey-7" />
            </div>

            <q-separator />

            <q-list class="q-py-sm">
                <q-item
                        v-for="lang in languageList"
                        :key="lang.code"
                        clickable
                        v-ripple
                        @click="selectLanguage(lang.code)"
                        class="q-py-md">
                    <q-item-section>
                        <q-item-label :class="isCurrent(lang.code) ? 'text-primary text-weight-bold' : ''">
                            {{ lang.label }}
                        </q-item-label>
                    </q-item-section>

                    <q-item-section side v-if="isCurrent(lang.code)">
                        <q-icon name="check" color="primary" />
                    </q-item-section>
                </q-item>
            </q-list>

            <div class="q-pb-xl"></div>
        </q-card>
    </q-dialog>
</template>

<script>
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, getCurrentInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { languageList } from 'src/i18n'

export default defineComponent({
    name: 'LanguageSetting',
    emits: [ ...useDialogPluginComponent.emits ],
    setup () {
        const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
        const { locale } = useI18n();
        const { proxy } = getCurrentInstance();

        function isCurrent(code) {
            return locale.value === code;
        }

        function selectLanguage(code) {
            proxy.$switchLanguage(code);
            onDialogOK();
        }

        return {
            dialogRef,
            onDialogHide,
            languageList,
            isCurrent,
            selectLanguage
        }
    }
})
</script>