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
    <q-page padding class="flex flex-center">
        <div class="scroll hide-scrollbar full-width">
            <div class="q-mb-lg text-center">
                <div class="text-h5 text-weight-bolder text-primary row justify-center items-center">
                    <q-icon name="security" size="sm" class="q-mr-sm" />
                    {{ $t('setupPage.title_wizard') }}
                </div>
                <div class="q-mt-xs fs-12" :class="isDark ? 'text-grey-5' : 'text-grey-7'">
                    {{ $t('setupPage.subtitle_wizard') }}
                </div>
            </div>
            <q-stepper
                    ref="stepper"
                    v-model="step"
                    :dark="isDark"
                    animated
                    flat
                    alternative-labels
                    class="bg-transparent setup-stepper"
                    active-color="primary"
                    done-color="positive"
                    :inactive-color="isDark ? 'grey-8' : 'grey-5'">
                <q-step :name="1" :title="$t('setupPage.step1.title')" icon="lock_open" :done="step > 1">
                    <div class="column items-center q-pt-md">
                        <div class="text-subtitle1 q-mb-sm">{{ $t('setupPage.step1.subtitle') }}</div>
                        <div class="text-caption text-center q-py-sm q-px-lg rounded-borders q-mb-lg"
                             :class="isDark ? 'bg-grey-9 text-grey-5' : 'bg-blue-grey-1 text-grey-8'"
                             v-html="$t('setupPage.step1.desc_html')">
                        </div>
                        <q-input
                                v-model="form.bPin"
                                filled
                                :dark="isDark"
                                readonly
                                type="password"
                                :label="$t('setupPage.step1.label_pin')"
                                @click="openKeyboard('bPin')"
                                :error="!!errors.bPin" :error-message="errors.bPin"
                                :class="{ 'simulated-focus': keyboardVisible && currentField === 'bPin', 'full-width': true }">
                            <template v-slot:prepend><q-icon name="pin" :color="keyboardVisible && currentField === 'bPin' ? 'primary' : (isDark ? 'grey-5' : 'grey-7')"/></template>
                        </q-input>
                    </div>
                    <q-stepper-navigation class="row justify-center q-mt-lg">
                        <q-btn @click="validateStep1" color="primary" :label="$t('setupPage.step1.btn_next')" class="full-width q-py-sm" size="16px" unelevated />
                    </q-stepper-navigation>
                </q-step>

                <q-step :name="2" :title="$t('setupPage.step2.title')" icon="done" :done="step > 2">
                    <div class="column items-center q-pt-md">
                        <div class="text-subtitle1 q-mb-lg">{{ $t('setupPage.step2.subtitle') }}</div>
                        <q-input
                                v-model="form.bPinConfirm"
                                filled :dark="isDark" readonly type="password"
                                :label="$t('setupPage.step2.label_confirm')"
                                @click="openKeyboard('bPinConfirm')"
                                :error="!!errors.bPinConfirm" :error-message="errors.bPinConfirm"
                                :class="{ 'simulated-focus': keyboardVisible && currentField === 'bPinConfirm', 'full-width': true }">
                            <template v-slot:prepend>
                                <q-icon name="lock_outline" :color="keyboardVisible && currentField === 'bPinConfirm' ? 'primary' : (isDark ? 'grey-5' : 'grey-7')"/>
                            </template>
                        </q-input>
                    </div>
                    <q-stepper-navigation class="column q-gutter-y-md">
                        <q-btn @click="validateStep2" color="primary" :label="$t('setupPage.step2.btn_confirm')" class="full-width q-py-sm" size="16px" unelevated />
                        <q-btn outline @click="step = 1; currentField = 'bPin';" :color="isDark ? 'grey' : 'grey-7'" :label="$t('setupPage.step2.btn_back')" class="full-width q-py-sm" size="13px" />
                    </q-stepper-navigation>
                </q-step>

                <q-step :name="3" :title="$t('setupPage.step3.title')" icon="visibility_off" :done="step > 3">
                    <div class="column items-center q-pt-md">
                        <div class="text-subtitle1 q-mb-sm text-deep-orange">{{ $t('setupPage.step3.subtitle') }}</div>
                        <div class="text-caption text-center q-pa-sm rounded-borders q-mb-lg"
                             :class="isDark ? 'bg-grey-9 text-grey-5' : 'bg-deep-orange-1 text-grey-9'"
                             v-html="$t('setupPage.step3.desc_html')">
                        </div>
                        <q-input
                                v-model="form.aPin"
                                filled :dark="isDark" readonly
                                type="password"
                                :label="$t('setupPage.step3.label_hidden_pin')"
                                @click="openKeyboard('aPin')"
                                :error="!!errors.aPin" :error-message="errors.aPin"
                                :class="{ 'simulated-focus': keyboardVisible && currentField === 'aPin', 'full-width': true }">
                            <template v-slot:prepend>
                                <q-icon name="vpn_key" :color="keyboardVisible && currentField === 'aPin' ? 'primary' : (isDark ? 'grey-5' : 'grey-7')"/>
                            </template>
                        </q-input>
                    </div>
                    <q-stepper-navigation class="row justify-center q-mt-lg">
                        <q-btn @click="validateStep3" color="primary" :label="$t('setupPage.step1.btn_next')" class="full-width q-py-sm" size="16px" unelevated />
                    </q-stepper-navigation>
                </q-step>

                <q-step :name="4" :title="$t('setupPage.step4.title')" icon="verified_user">
                    <div class="column items-center q-pt-md">
                        <div class="text-subtitle1 q-mb-lg">{{ $t('setupPage.step4.subtitle') }}</div>
                        <q-input
                                v-model="form.aPinConfirm"
                                filled :dark="isDark" readonly type="password"
                                :label="$t('setupPage.step4.label_confirm_hidden')"
                                @click="openKeyboard('aPinConfirm')"
                                :error="!!errors.aPinConfirm" :error-message="errors.aPinConfirm"
                                :class="{ 'simulated-focus': keyboardVisible && currentField === 'aPinConfirm', 'full-width': true }">
                            <template v-slot:prepend>
                                <q-icon name="lock" :color="keyboardVisible && currentField === 'aPinConfirm' ? 'primary' : (isDark ? 'grey-5' : 'grey-7')" />
                            </template>
                        </q-input>
                    </div>
                    <q-stepper-navigation class="column q-gutter-y-md">
                        <q-btn @click="finishSetup" color="secondary" :label="$t('setupPage.step4.btn_finish')" :loading="isSubmitting" class="full-width q-py-sm" size="16px" unelevated/>
                        <q-btn outline @click="step = 3; currentField = 'aPin';" :color="isDark ? 'grey' : 'grey-8'" :label="$t('setupPage.step2.btn_back')" class="full-width q-py-sm" size="13px"/>
                    </q-stepper-navigation>
                </q-step>
            </q-stepper>
        </div>
        <SecureKeyboard
                v-model="keyboardVisible"
                :fixed="false"
                :target="stepper"
                @input="onKeyInput"
                @delete="onKeyDelete"
                @confirm="onKeyConfirm"/>
    </q-page>
</template>

<script>
import {defineComponent, ref, reactive, nextTick, computed, watch} from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useUserStore } from 'src/stores/userStore';
import SecureKeyboard from 'components/SecureKeyboard.vue';
import { useI18n } from 'vue-i18n'; // Import i18n

export default defineComponent({
    name: 'SetupPage',
    components: { SecureKeyboard },
    setup() {
        const userStore = useUserStore();
        const router = useRouter();
        const $q = useQuasar();
        const { t } = useI18n(); // Use t function
        const isDark = computed(() => $q.dark.isActive);

        const step = ref(1);
        const stepper = ref(null);
        const isSubmitting = ref(false);
        const keyboardVisible = ref(false);
        const currentField = ref('');

        const form = reactive({ bPin: '', bPinConfirm: '', aPin: '', aPinConfirm: '' });
        const errors = reactive({ bPin: '', bPinConfirm: '', aPin: '', aPinConfirm: '' });

        const openKeyboard = (fieldName) => {
            currentField.value = fieldName;
            errors[fieldName] = '';
            keyboardVisible.value = true;
        };

        const onKeyInput = (char) => {
            if (!currentField.value) return;
            const field = currentField.value;
            if (form[field].length < 32) form[field] += char;
        };

        const onKeyDelete = () => {
            if (!currentField.value) return;
            const field = currentField.value;
            if (form[field].length > 0) form[field] = form[field].slice(0, -1);
        };

        // Keyboard confirm logic
        const onKeyConfirm = () => {
            if (step.value === 1 && form.bPin.length >= 6) validateStep1();
            else if (step.value === 2 && form.bPinConfirm.length >= 6) validateStep2();
            else if (step.value === 3 && form.aPin.length >= 6) validateStep3();
            else if (step.value === 4 && form.aPinConfirm.length >= 6) finishSetup();
        };

        // Validation logic
        const validateStep1 = () => {
            if (form.bPin.length < 6) { errors.bPin = t('setupPage.error.pin_min_length'); return; }
            step.value = 2;
            openKeyboard('bPinConfirm');
        };

        const validateStep2 = () => {
            if (form.bPin !== form.bPinConfirm) { errors.bPinConfirm = t('setupPage.error.pin_mismatch'); form.bPinConfirm = ''; return; }
            step.value = 3;
            openKeyboard('aPin');
        };

        const validateStep3 = () => {
            if (form.aPin.length < 6) { errors.aPin = t('setupPage.error.pin_min_length'); return; }
            if (form.aPin === form.bPin) { errors.aPin = t('setupPage.error.pin_same'); return; }
            step.value = 4;
            openKeyboard('aPinConfirm');
        };

        const finishSetup = async () => {
            if (form.aPin !== form.aPinConfirm) { errors.aPinConfirm = t('setupPage.error.pin_mismatch'); form.aPinConfirm = ''; return; }

            // Close keyboard only on final completion
            keyboardVisible.value = false;
            isSubmitting.value = true;

            try {
                await userStore.setupWalletPins(form.aPin, form.bPin);
                $q.notify({ type: 'positive', message: t('setupPage.msg.setup_success')});
                router.replace('/login');
            } catch (e) {
                console.error('Setup Error:', e);
                $q.notify({ type: 'negative', message: t('setupPage.msg.setup_failed') });
            } finally {
                isSubmitting.value = false;
            }
        };

        watch(() => form.bPin, ()=>{
            errors.bPin = '';
        });
        watch(() => form.bPinConfirm, (n, o)=>{
            if (n && n.length > 0) errors.bPinConfirm = '';
        });
        watch(()=> form.aPin, () => {
            errors.aPin = '';
        });
        watch(()=> form.aPinConfirm, (n, o) => {
            if (n && n.length > 0) errors.aPinConfirm = '';
        });

        return {
            step, form, errors, isSubmitting, keyboardVisible, isDark, currentField, stepper,
            openKeyboard, onKeyInput, onKeyDelete, onKeyConfirm,
            validateStep1, validateStep2, validateStep3, finishSetup
        };
    }
});
</script>