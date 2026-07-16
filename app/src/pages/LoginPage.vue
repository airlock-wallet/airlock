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
            <div class="column items-center q-mb-xl">
                <q-avatar size="80px" color="primary" class="shadow-4">
                    <q-icon name="img:/images/logo-white.svg" size="48px"/>
                </q-avatar>
                <div class="text-h4 text-weight-bolder q-mt-md relative-position" :class="isDark ? 'text-white' : 'text-grey-9'">
                    <span>{{ $t('loginPage.title_app') }}</span>
                </div>
                <div class="text-caption q-mt-xs" :class="isDark ? 'text-grey-5' : 'text-grey-6'">
                    {{ $t('loginPage.welcome') }}
                </div>
            </div>
            <div class="q-px-lg">
                <q-input
                        ref="pinInputRef"
                        v-model="pin"
                        filled
                        :dark="isDark"
                        readonly
                        type="password"
                        :label="$t('loginPage.input_label')"
                        class="full-width q-mb-lg"
                        :class="{ 'simulated-focus': isFocused }"
                        :error="isError"
                        :error-message="errorMessage"
                        @click="openKeyboard">
                    <template v-slot:prepend>
                        <q-icon name="lock" :color="isFocused ? 'primary' : (isDark ? 'grey-5' : 'grey-7')" />
                    </template>
                </q-input>
                <q-btn
                        ref="unlockBtnRef"
                        unelevated
                        rounded
                        color="primary"
                        class="full-width q-py-sm"
                        size="16px"
                        :label="$t('loginPage.btn_unlock')"
                        :loading="isSubmitting"
                        @click="handleUnlock"/>
            </div>
        </div>
        <SecureKeyboard
                v-model="keyboardVisible"
                :fixed="false"
                :target="unlockBtnRef"
                @input="onKeyInput"
                @delete="onKeyDelete"
                @confirm="onKeyConfirm"
                @update:model-value="onKeyboardToggle"/>
    </q-page>
</template>

<script>
import { defineComponent, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useUserStore } from 'src/stores/userStore';
import { hasAccounts } from 'src/services/DbService.js';
import SecureKeyboard from 'components/SecureKeyboard.vue';
import { useI18n } from 'vue-i18n'; // Import i18n

export default defineComponent({
    name: 'LoginPage',
    components: { SecureKeyboard },
    setup() {
        const userStore = useUserStore();
        const router = useRouter();
        const $q = useQuasar();
        const { t } = useI18n(); // Use t function
        const isDark = computed(() => $q.dark.isActive);
        const unlockBtnRef = ref(null);

        // State
        const pin = ref('');
        const isSubmitting = ref(false);
        const keyboardVisible = ref(false);
        const isError = ref(false);
        const errorMessage = ref('');
        const isFocused = ref(false);

        const pinInputRef = ref(null);

        // Monitor keyboard toggle, sync focus state
        const onKeyboardToggle = (val) => {
            isFocused.value = val;
        };

        const openKeyboard = () => {
            keyboardVisible.value = true;
            isFocused.value = true;
            isError.value = false;
            errorMessage.value = '';
        };

        const onKeyInput = (char) => {
            if (pin.value.length < 32) {
                pin.value += char;
                isError.value = false;
            }
        };

        const onKeyDelete = () => {
            if (pin.value.length > 0) pin.value = pin.value.slice(0, -1);
        };

        const onKeyConfirm = () => {
            if (pin.value.length >= 6) {
                handleUnlock();
            }
        };

        // --- Core Business Logic ---
        const handleUnlock = async () => {
            if (pin.value.length < 6) {
                isError.value = true;
                errorMessage.value = t('loginPage.error.pin_too_short');
                return;
            }

            keyboardVisible.value = false;
            isSubmitting.value = true;

            try {
                // Call userStore to verify
                const success = await userStore.verifyAndUnlock(pin.value);

                if (success) {
                    // Logic after login
                    try {
                        // Check if accounts exist in DB
                        const exists = await hasAccounts();
                        // Go to home if exists, else go to sync page
                        const nextPath = exists ? '/' : '/loadWallet';
                        router.replace(nextPath);
                    } catch (dbError) {
                        console.error('DB Check failed', dbError);

                        // 1. Show fatal error notification
                        $q.notify({
                            type: 'negative',
                            message: t('loginPage.error.db_critical'),
                            position: 'center', // Center is more visible
                            timeout: 3000
                        });

                        // 2. Force exit after 2 seconds delay
                        setTimeout(() => {
                            if (navigator.app && navigator.app.exitApp) {
                                navigator.app.exitApp(); // Android standard exit
                            } else if (navigator.device && navigator.device.exitApp) {
                                navigator.device.exitApp(); // Legacy compatibility
                            } else {
                                // Fallback for browser debug
                                console.warn('Fatal Error: Would exit app on device.');
                            }
                        }, 2000);
                    }

                } else {
                    // Failure handling
                    isError.value = true;
                    errorMessage.value = t('loginPage.error.pin_incorrect');
                    // Vibration feedback
                    if (navigator.vibrate) navigator.vibrate(200);
                    pin.value = ''; // Clear input
                }
            } catch (e) {
                console.error('Login Error:', e);
                $q.notify({ type: 'negative', message: t('loginPage.error.verify_error', { error: e.message }) });
            } finally {
                isSubmitting.value = false;
            }
        };

        return {
            pin, isSubmitting, keyboardVisible, isError, errorMessage,
            isDark, pinInputRef, isFocused,
            // Actions
            openKeyboard, onKeyInput, onKeyDelete, onKeyConfirm, onKeyboardToggle,
            handleUnlock, unlockBtnRef
        };
    }
});
</script>