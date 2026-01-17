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
    <q-dialog ref="dialogRef" @hide="onDialogHide">
        <q-card class="q-dialog-plugin">
            <q-card-section>
                <span class="text-h6">{{title}}</span>
            </q-card-section>
            <q-card-section>
                {{message}}
            </q-card-section>
            <q-card-section>
                <div class="flex">
                    <q-space />
                    <q-btn :label="$t('confirm.cancel')" color="grey" flat v-close-popup/>
                    <q-btn :label="$t('confirm.ok')" color="primary" class="q-ml-sm" @click="onOKClick"/>
                </div>
            </q-card-section>
        </q-card>
    </q-dialog>
</template>
<script>
import {useDialogPluginComponent} from 'quasar';
import { useI18n } from 'vue-i18n'; // Import i18n

export default {
    name: "Confirm",
    props: {
        title: {type: String, required: true},
        message: {type: String, required: true}
    },
    emits: [
        ...useDialogPluginComponent.emits
    ],

    setup() {
        const {dialogRef, onDialogHide, onDialogOK, onDialogCancel} = useDialogPluginComponent();
        const { t } = useI18n(); // Use t function

        return {
            dialogRef,
            onDialogHide,
            onOKClick() {
                onDialogOK()
            },
            onCancelClick: onDialogCancel,
        }
    }
}
</script>
<style scoped>
</style>