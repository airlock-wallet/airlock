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
        <q-card class="q-dialog-plugin column safe-pt safe-mb no-scroll">
            <q-card-section class="col-auto row items-center">
                <div v-if="title" class="text-h6 text-weight-bold">{{title}}</div>
                <q-space/>
                <q-btn icon="close" color="grey-9" flat round dense v-close-popup/>
            </q-card-section>
            <q-card-section class="col scroll q-pb-md" v-if="content">
                <div v-html="content"></div>
            </q-card-section>
        </q-card>
    </q-dialog>
</template>
<script>
import {useDialogPluginComponent} from 'quasar';
import {onMounted, ref} from "vue";
import {api} from "boot/axios.js";
import { useI18n } from 'vue-i18n'; // Import i18n

export default {
    name: "Docs",
    props: {
        url: {type: String, required: true},
        lang: {type: String, default: 'zh'},
    },
    emits: [
        ...useDialogPluginComponent.emits
    ],

    setup(props) {
        const {dialogRef, onDialogHide, onDialogOK, onDialogCancel} = useDialogPluginComponent();
        const { t } = useI18n(); // Use t function
        const title = ref(null);
        const content = ref(null);
        onMounted(async () => {
            try {
                const response = await api.get(props.url, {
                    params: { lang: props.lang },
                    timeout: 15000,
                });

                if (response.status === 200) {
                    title.value = response.data.title;
                    content.value = response.data.data;
                }
            } catch (err) {
                console.error('Fetch error:', err)
                title.value = t('docs.load_failed');
                content.value = t('docs.network_error');
            }
        })

        return {
            dialogRef,
            onDialogHide,
            onOKClick() {
                onDialogOK()
            },
            onCancelClick: onDialogCancel,
            title,
            content,
        }
    }
}
</script>
<style scoped>
</style>