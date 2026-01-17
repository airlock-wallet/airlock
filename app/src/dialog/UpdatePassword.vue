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
              @before-hide="quasarOnDialogHide"
              maximized
              transition-duration="500"
              transition-show="slide-up"
              transition-hide="slide-down">
        <q-card class="q-dialog-plugin column safe-full-height no-scroll safe-pb">
            <q-card-section class="col-auto row items-center q-mb-sm">
                <div class="text-h6 text-weight-bold">
                    {{ $t('updatePassword.title') }}
                </div>
                <q-space/>
                <q-btn icon="close" color="grey-9" flat round dense v-close-popup/>
            </q-card-section>
            <q-card-section class="col column q-py-none q-mb-md">
                <q-form ref="formRef" class="col column" @submit="onSubmit">
                    <q-input
                            ref="oldPinRef"
                            v-model="input.oldPin"
                            filled
                            readonly
                            stack-label
                            type="password"
                            :hint="$t('updatePassword.input.old_pin_hint')"
                            :label="$t('updatePassword.input.old_pin_label')"
                            class="full-width q-mb-lg"
                            :class="{ 'simulated-focus': activeField === 'oldPin' }"
                            :rules="[
                                    val => !!val || $t('updatePassword.input.rule_old_pin_required'),
                                    val => val.length >= 6 || $t('updatePassword.input.rule_pin_length')
                                ]"
                            lazy-rules="ondemand"
                            @click="openKeyboard('oldPin')">
                        <template v-slot:prepend>
                            <q-icon name="lock_open" :color="activeField === 'oldPin' ? 'primary' : 'grey-7'" />
                        </template>
                    </q-input>
                    <q-input
                            ref="newPinRef"
                            v-model="input.newPin"
                            filled
                            readonly
                            stack-label
                            type="password"
                            :hint="$t('updatePassword.input.new_pin_hint')"
                            :label="$t('updatePassword.input.new_pin_label')"
                            class="full-width q-mb-lg"
                            :class="{ 'simulated-focus': activeField === 'newPin' }"
                            :rules="[
                                    val => !!val || $t('updatePassword.input.rule_new_pin_required'),
                                    val => val.length >= 6 || $t('updatePassword.input.rule_pin_length'),
                                    val => val !== input.oldPin || $t('updatePassword.input.rule_pin_diff')
                                ]"
                            lazy-rules="ondemand"
                            @click="openKeyboard('newPin')">
                        <template v-slot:prepend>
                            <q-icon name="lock" :color="activeField === 'newPin' ? 'primary' : 'grey-7'" />
                        </template>
                    </q-input>
                    <q-input
                            ref="confirmPinRef"
                            v-model="input.confirmPin"
                            filled
                            readonly
                            stack-label
                            type="password"
                            :label="$t('updatePassword.input.confirm_pin_label')"
                            :hint="$t('updatePassword.input.confirm_pin_hint')"
                            class="full-width q-mb-lg"
                            :class="{ 'simulated-focus': activeField === 'confirmPin' }"
                            :rules="[
                                    val => !!val || $t('updatePassword.input.rule_confirm_pin_required'),
                                    val => val === input.newPin || $t('updatePassword.input.rule_pin_match')
                                ]"
                            lazy-rules="ondemand"
                            @click="openKeyboard('confirmPin')">
                        <template v-slot:prepend>
                            <q-icon name="lock_outline" :color="activeField === 'confirmPin' ? 'primary' : 'grey-7'" />
                        </template>
                    </q-input>
                    <q-space />
                    <q-btn :label="$t('updatePassword.btn.confirm_update')"
                           color="primary"
                           class="full-width"
                           padding="8px"
                           size="14px"
                           :loading="loading"
                           type="submit" />
                </q-form>

            </q-card-section>

        </q-card>
    </q-dialog>

    <SecureKeyboard
            v-model="keyboardVisible"
            :fixed="false"
            ref="unlockBtnRef"
            @input="onKeyInput"
            @delete="onKeyDelete"
            @confirm="onKeyConfirm"
            @update:model-value="onKeyboardToggle"/>
</template>

<script>
import {useDialogPluginComponent, useQuasar} from 'quasar';
import {reactive, ref} from "vue";
import SecureKeyboard from "components/SecureKeyboard.vue";
import {useUserStore} from "stores/userStore.js";
import { useI18n } from 'vue-i18n'; // Import i18n

export default {
    name: "UpdatePassword",
    components: {
        SecureKeyboard
    },
    emits: [
        ...useDialogPluginComponent.emits
    ],

    setup() {
        const {dialogRef, onDialogOK, onDialogHide, onDialogCancel} = useDialogPluginComponent();
        const $q = useQuasar();
        const userStore = useUserStore();
        const { t } = useI18n(); // Use t function

        // Form & Input Refs (Used for manual validation triggering)
        const formRef = ref(null);
        const oldPinRef = ref(null);
        const newPinRef = ref(null);
        const confirmPinRef = ref(null);
        const loading = ref(false);

        // Data model
        const input = reactive({
            oldPin: '',
            newPin: '',
            confirmPin: ''
        });

        const keyboardVisible = ref(false);
        const unlockBtnRef = ref(null);
        const activeField = ref('');

        // Helper function: Get corresponding Ref by field name
        const getRef = (field) => {
            if (field === 'oldPin') return oldPinRef.value;
            if (field === 'newPin') return newPinRef.value;
            if (field === 'confirmPin') return confirmPinRef.value;
            return null;
        };

        // Open Keyboard
        const openKeyboard = (field) => {
            // 1. If switching fields, validate the previous field first (Simulate Blur effect)
            if (activeField.value && activeField.value !== field) {
                getRef(activeField.value)?.validate();
            }

            // 2. Focus new field
            activeField.value = field;
            keyboardVisible.value = true;

            // 3. Reset validation state of the new field
            getRef(field)?.resetValidation();
        };

        const onKeyInput = (char) => {
            if (!activeField.value) return;
            const currentVal = input[activeField.value];
            input[activeField.value] = currentVal + char;
            getRef(activeField.value)?.resetValidation();
        };

        const onKeyDelete = () => {
            if (!activeField.value) return;
            const currentVal = input[activeField.value];
            if (currentVal.length > 0) {
                input[activeField.value] = currentVal.slice(0, -1);
            }
        };

        // Smart Jump Logic (Including auto-validation)
        const onKeyConfirm = () => {
            const current = activeField.value;

            // 1. Validate current field (Simulate Blur)
            const isValid = getRef(current)?.validate();

            // 2. Jump only if current field has value (Or you can strictly check isValid)
            if (current === 'oldPin') {
                if (isValid) openKeyboard('newPin');
            } else if (current === 'newPin') {
                if (isValid) openKeyboard('confirmPin');
            } else if (current === 'confirmPin') {
                if (isValid) keyboardVisible.value = false;
            }
        };

        const onKeyboardToggle = (isVisible) => {
            if (!isVisible && activeField.value) {
                getRef(activeField.value)?.validate();
                activeField.value = ''; // Cancel highlight
            }
        };

        // Submit form
        const onSubmit = async () => {
            try {
                loading.value = true;
                const res = await userStore.updatePin(input.oldPin, input.newPin);
                if (res) {
                    onDialogOK(true);
                }
            } catch (e) {
                $q.notify({
                    type: 'negative',
                    message: e.message
                });
            } finally {
                loading.value = false;
            }
        };

        const quasarOnDialogHide = () => {
            keyboardVisible.value = false;
            activeField.value = '';
        };

        return {
            dialogRef,
            onDialogHide,
            onCancelClick: onDialogCancel,

            formRef,
            oldPinRef,
            newPinRef,
            confirmPinRef,

            input,
            keyboardVisible,
            unlockBtnRef,
            activeField,
            loading,

            openKeyboard,
            onKeyInput,
            onKeyDelete,
            onKeyConfirm,
            onKeyboardToggle,
            onSubmit,
            quasarOnDialogHide,
        }
    }
}
</script>