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
              class="z-top"
              transition-duration="500"
              transition-show="slide-up"
              transition-hide="slide-down">
        <q-card class="q-dialog-plugin safe-full-height safe-pb column no-wrap">
            <q-card-section class="row items-center q-pb-none q-mb-md">
                <div v-if="step === 1" class="text-h6 text-weight-bold flex items-center">
                    <q-icon :name="`img:${asset.icon}`"/>
                    <span class="q-ml-sm">{{ $t('transaction.title.send', { symbol: asset.symbol }) }}</span>
                </div>
                <div v-if="step === 2" class="flex items-center">
                    <q-btn icon="arrow_back" flat round dense color="primary" @click="step = 1"/>
                    <div class="text-h6 text-weight-bold q-ml-sm">
                        {{ $t('transaction.title.confirm') }}
                    </div>
                </div>
                <q-space/>
                <q-btn icon="close" flat round dense v-close-popup color="grey-7"/>
            </q-card-section>
            <q-form v-if="step === 1" @submit="toStep2" class="column col">
                <q-card-section class="q-gutter-y-md col-grow">
                    <q-banner rounded class="bg-grey-2 q-mb-lg">
                        <div class="fs-12 text-teal">
                            <span v-html="$t('transaction.banner.only_support', { chain: asset.blockchain })"></span>
                        </div>
                    </q-banner>
                    <q-input
                            v-model="form.to"
                            :label="$t('transaction.input.to_label')"
                            outlined
                            :rules="[validateAddressRule]"
                            clearable
                            autogrow
                            stack-label
                            :error="!!addressError"
                            :error-message="addressError">
                        <template v-slot:append>
                            <div class="row items-center q-gutter-x-xs">
                                <q-btn flat dense round icon="image" color="primary" @click="pickQrImage"/>
                                <q-separator vertical/>
                                <q-btn flat dense round icon="qr_code_scanner" color="primary" @click="scanQr"/>
                            </div>
                        </template>
                    </q-input>
                    <q-input
                            v-model="form.amount"
                            :label="$t('transaction.input.amount_label')"
                            outlined
                            :rules="[val => val!==null && val>=0 && parseFloat(val)<=parseFloat(asset.balance)||$t('transaction.input.rule_amount_invalid')]"
                            stack-label
                            clearable
                            type="number"
                            bottom-slots>
                        <template v-slot:append>
                            <div class="fs-11 text-grey-7">≈ ${{(parseFloat(singlePrice(asset.symbol)) * parseFloat(form.amount || 0)).toFixed(2)}}</div>
                            <q-btn flat dense :label="$t('transaction.label.max')" color="primary" @click="setMaxAmount"/>
                        </template>
                    </q-input>
                    <q-input v-if="isMemoSupported(asset.blockchain)" v-model="form.memo"
                             :label="$t('transaction.input.memo_optional', { name: memoName })"
                             stack-label
                             outlined
                             bottom-slots/>
                    <div class="row justify-between text-caption text-grey-7 q-px-xs">
                        <span>{{ $t('transaction.label.available_balance') }}</span>
                        <span class="text-weight-bold text-grey-9">{{ formatBalance(currentBalance) }} {{ asset.symbol }}</span>
                    </div>
                </q-card-section>
                <q-card-section class="q-px-md q-py-none q-my-md">
                    <q-btn
                            :label="$t('transaction.btn.next')"
                            color="primary"
                            class="full-width q-py-sm"
                            size="md"
                            type="submit"/>
                </q-card-section>
            </q-form>
            <q-form v-if="step === 2" @submit="onConfirm" class="column col">
                <q-card-section class="col-grow">
                    <q-list separator>
                        <q-item class="q-py-md">
                            <q-item-section>
                                <q-item-label caption>{{ $t('transaction.label.amount') }}</q-item-label>
                                <q-item-label>
                                    <div class="flex justify-between">
                                        <div class="fs-14 text-weight-medium">
                                            {{ form.amount }} {{asset.symbol}}
                                        </div>
                                        <div class="fs-12 text-grey">
                                            ≈ ${{(parseFloat(singlePrice(asset.symbol)) * parseFloat(form.amount || 0)).toFixed(6)}}
                                        </div>
                                    </div>
                                </q-item-label>
                            </q-item-section>
                        </q-item>
                        <q-item class="q-py-md">
                            <q-item-section>
                                <q-item-label caption>{{ $t('transaction.label.receiver') }}</q-item-label>
                                <q-item-label class="fs-14 text-weight-medium" style="word-break: break-all">{{ form.to }}
                                </q-item-label>
                            </q-item-section>
                        </q-item>
                        <q-item v-if="form.memo" class="q-py-md">
                            <q-item-section>
                                <q-item-label caption>{{ memoName }}</q-item-label>
                                <q-item-label class="fs-14 text-weight-medium" style="word-break: break-all">
                                    {{ form.memo }}
                                </q-item-label>
                            </q-item-section>
                        </q-item>
                        <q-item class="q-py-md">
                            <q-item-section>
                                <q-item-label caption>{{ $t('transaction.label.gas_fee') }}</q-item-label>
                                <q-item-label v-if="loadingNetwork" class="row items-center text-primary">
                                    <q-spinner size="12px" class="q-mr-xs"/>
                                    <span class="fs-12 q-ml-sm">{{ $t('transaction.label.calculating') }}</span>
                                </q-item-label>
                                <q-item-label v-else-if="chainError" class="text-negative fs-12">
                                    <q-icon name="error"/>
                                    {{ chainError }}
                                </q-item-label>
                                <q-item-label v-else class="text-weight-medium">
                                    <div class="flex justify-between">
                                        <div class="fs-14 text-weight-medium">
                                            {{ displayFee }} {{ unitName }}
                                        </div>
                                        <div class="fs-11 text-grey-7">≈ ${{(parseFloat(singlePrice(asset.symbol)) * parseFloat(displayFee || 0)).toFixed(6)}}</div>
                                    </div>
                                </q-item-label>
                            </q-item-section>
                        </q-item>
                        <q-item v-if="asset.coin === 'tron'" class="q-py-md" v-ripple clickable @click="onRefreshResource">
                            <q-item-section v-if="!!asset.contract">
                                <q-item-label caption>{{ $t('transaction.label.energy') }}</q-item-label>
                                <q-item-label v-if="loadTronResource || !tronResource" class="row items-center text-primary q-mt-xs">
                                    <q-spinner size="12px" class="q-mr-xs"/>
                                    <span class="fs-12 q-ml-sm">{{ $t('transaction.label.fetching') }}</span>
                                </q-item-label>
                                <q-item-label v-else class="fs-14 text-weight-medium">
                                    {{ tronResource.energy || 0 }}
                                </q-item-label>
                            </q-item-section>
                            <q-item-section v-else>
                                <q-item-label caption>{{ $t('transaction.label.bandwidth') }}</q-item-label>
                                <q-item-label v-if="loadTronResource || !tronResource" class="row items-center text-primary q-mt-xs">
                                    <q-spinner size="12px" class="q-mr-xs"/>
                                    <span class="fs-12 q-ml-sm">{{ $t('transaction.label.fetching') }}</span>
                                </q-item-label>
                                <q-item-label v-else class="fs-14 text-weight-medium">
                                    {{ tronResource.bandwidth || 0 }}
                                </q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                    <q-separator/>
                    <q-input
                            v-model="password"
                            filled
                            readonly
                            :type="showPassword ? 'text': 'password'"
                            :label="$t('transaction.input.password_label')"
                            stack-label
                            class="full-width q-mt-md"
                            :class="{ 'simulated-focus': isFocused }"
                            :rules="[val => val !== null && val.length || $t('transaction.input.rule_password_required')]"
                            @click="openKeyboard">
                        <template v-slot:prepend>
                            <q-icon name="lock" color="grey-5"/>
                        </template>
                        <template v-slot:append>
                            <q-btn
                                    round
                                    dense
                                    flat
                                    :icon="showPassword ? 'bi-eye-fill' : 'bi-eye-slash-fill'"
                                    color="grey-5"
                                    @click.stop="showPassword = !showPassword"
                                    tabindex="-1"
                            />
                        </template>
                    </q-input>
                    <q-banner v-if="warningMsg" rounded class="bg-teal-1">
                        <div class="fs-12 text-teal">
                            {{ warningMsg }}
                        </div>
                    </q-banner>
                    <q-banner v-if="signStatus" rounded class="bg-deep-orange-1 q-mt-md">
                        <div class="fs-12 text-deep-orange flex items-center justify-center">
                            <q-icon name="bi-exclamation-triangle"/>
                            <span class="q-ml-xs" v-html="$t('transaction.banner.sign_warning')"></span>
                        </div>
                    </q-banner>
                </q-card-section>
                <q-card-section class="q-py-none q-mb-md">
                    <q-btn
                            ref="unlockBtnRef"
                            :label="$t('transaction.btn.confirm_send')"
                            color="primary"
                            class="full-width"
                            size="md"
                            padding="8px 0"
                            type="submit"
                            :loading="submitting"/>
                </q-card-section>
            </q-form>
        </q-card>
    </q-dialog>
    <SecureKeyboard
            v-model="keyboardVisible"
            :fixed="false"
            :target="unlockBtnRef"
            @input="onKeyInput"
            @delete="onKeyDelete"
            @confirm="onKeyConfirm"
            @update:model-value="onKeyboardToggle"/>
</template>
<script>
import {defineComponent, ref, reactive, computed, watchEffect} from 'vue';
import {useDialogPluginComponent, useQuasar, throttle} from 'quasar';
import BleService from 'src/services/BleService';
import {useChainStore} from "stores/chainStore.js";
import {useUserStore} from "stores/userStore.js";
import {usePriceStore} from "stores/PriceStore.js";
import SecureKeyboard from 'components/SecureKeyboard.vue';
import jsQR from "jsqr";
import TxStrategyFactory from 'src/services/tx/TxStrategyFactory';
import {isMemoSupported} from "src/utils/ChainUtil.js";
import {toAtomicAmount, toNormalString} from "src/utils/NumberUtil.js";
import ChainService from "src/services/ChainService.js";
import { useI18n } from 'vue-i18n'; // Import i18n

export default defineComponent({
    name: "Transaction",
    props: {
        asset: {type: Object, required: true}
    },
    components: {SecureKeyboard},
    emits: [...useDialogPluginComponent.emits],
    setup(props) {
        const {dialogRef, onDialogHide, onDialogOK} = useDialogPluginComponent();
        const $q = useQuasar();
        const { t } = useI18n(); // Use t function
        const chainStore = useChainStore();
        const userStore = useUserStore();
        const priceStore = usePriceStore();

        const currentBalance = ref(props.asset.balance || '0');
        const form = reactive({
            to: '',
            amount: '',
            memo: ''
        });

        // --- Init Strategy (Strategy Pattern) ---
        let txStrategy = null;
        try {
            txStrategy = TxStrategyFactory.getStrategy(props.asset, chainStore);
        } catch (e) {
            console.error("Strategy Init Error:", e);
            $q.notify({
                type: 'negative',
                message: t('transaction.msg.strategy_init_failed', { error: e.message }),
                onDismiss: () => {
                    onDialogHide();
                }
            });
        }

        // --- State Variables ---
        const step = ref(1); // 1: Input, 2: Confirm
        const loadingNetwork = ref(false);
        const submitting = ref(false);
        const signStatus = ref(false);
        const chainError = ref(null);
        const addressError = ref('');
        const password = ref('');
        const showPassword = ref(false);
        const loadTronResource = ref(false);

        // Reactive variables
        const displayFee = ref('0');     // Fee for UI
        const warningMsg = ref('');      // Warning msg for UI

        // Secure Keyboard State
        const keyboardVisible = ref(false);
        const isFocused = ref(false);
        const unlockBtnRef = ref(null);

        // --- Computed (Delegate to Strategy) ---

        // Memo Support
        const hasMemo = computed(() => txStrategy ? txStrategy.hasMemo() : false);

        // Format Balance
        const formatBalance = (val) => parseFloat(val).toLocaleString('en-US', {maximumFractionDigits: 8});

        // Auto Watch: Fee + Warning
        watchEffect(() => {
            // 1. Basic Check
            if (!txStrategy) {
                displayFee.value = '0';
                warningMsg.value = '';
                return;
            }

            // 2. Get UI Fee
            const feeStr = txStrategy.getDisplayFee();
            displayFee.value = feeStr;

            // ============================================
            // 3. Calculate Balance Warning (Smart Clamping Check)
            // ============================================

            // [Pre-check]
            if (!form.amount || !props.asset.balance || props.asset.contract) {
                warningMsg.value = '';
                return;
            }

            try {
                const decimals = props.asset.decimals;

                // A. Prepare BigInt
                const cleanFeeStr = feeStr.replace(/,/g, '');
                const feeValValid = !isNaN(parseFloat(cleanFeeStr));
                const feeBig = feeValValid ? BigInt(toAtomicAmount(cleanFeeStr, decimals)) : 0n;

                // If fee is 0, don't warn
                if (feeBig === 0n) {
                    warningMsg.value = '';
                    return;
                }

                const balanceBig = BigInt(toAtomicAmount(props.asset.balance, decimals));
                const amountBig = BigInt(toAtomicAmount(form.amount, decimals));

                // B. Buffer Fee (1.2x)
                const bufferFee = (feeBig * 120n) / 100n;

                // C. Core Logic
                if ((amountBig + bufferFee) > balanceBig) {
                    // Set Warning
                    warningMsg.value = t('transaction.banner.balance_warning', { amount: form.amount });
                } else {
                    // Clear Warning
                    warningMsg.value = '';
                }

            } catch (e) {
                // Ignore calculation errors
                warningMsg.value = '';
            }
        });

        // Tron Resource (Special Case)
        const tronResource = computed(() => {
            if (txStrategy && typeof txStrategy.getAccountResource === 'function') {
                return txStrategy.getAccountResource();
            }
            return null;
        });

        // --- Core Logic ---

        // Fetch Chain Data
        const fetchChainData = async () => {
            if (!txStrategy) return;
            loadingNetwork.value = true;
            chainError.value = null;
            try {
                await txStrategy.fetchNetworkData(form.amount, form.to);
            } catch (e) {
                console.error(e);
                chainError.value = t('transaction.msg.network_data_failed');
            } finally {
                loadingNetwork.value = false;
            }
        };

        // Validate Address
        const validateAddressRule = () => {
            if (!txStrategy) return false;
            const valid = txStrategy.validateAddress(form.to);
            addressError.value = valid ? '' : t('transaction.input.rule_address_invalid');
            return valid;
        };

        // To Step 2
        const toStep2 = async () => {
            // Validate Address First
            if (!validateAddressRule()) return;

            step.value = 2;
            // Fetch Network Data on entering Step 2
            await fetchChainData();
        };

        // Set Max Amount
        const setMaxAmount = () => {
            form.amount = toNormalString(currentBalance.value);
            validateAddressRule();
        };

        // --- Confirm & Send ---
        const onConfirm = async () => {
            // Hide Keyboard
            keyboardVisible.value = false;

            submitting.value = true;
            try {
                if (!txStrategy) throw new Error(t('transaction.msg.strategy_not_init'));
                if (chainError.value) throw new Error(t('transaction.msg.network_not_synced'));

                // Build Params
                const params = await txStrategy.buildParams(form, password.value, userStore.walletMode);

                // Prompt Confirmation
                signStatus.value = true;

                // Send to BLE or Service
                const encoded = await BleService.sendRequest('sign_tx', params, 60000);

                // Sign Complete
                signStatus.value = false;

                if (!encoded || encoded?.error) {
                    throw new Error(encoded?.error || t('transaction.msg.sign_failed'));
                }

                console.log(`Sign Result: ${encoded}`);

                // Broadcast
                const txId = await ChainService.broadcast(props.asset, encoded);
                $q.notify({ type: 'positive', message: t('transaction.msg.tx_broadcasted')});
                onDialogOK({ txId });

            } catch (e) {
                console.error(e);
                let errMsg = e.message || t('transaction.msg.sign_failed');
                $q.notify({type: 'negative', message: errMsg});
            } finally {
                signStatus.value = false;
                submitting.value = false;
            }
        };

        // --- Scan & Image Logic ---
        const handleScanResult = (text) => {
            let address = text;
            if (address.includes(':')) address = address.split(':').pop();
            form.to = address;
            validateAddressRule();
            $q.notify({message: t('transaction.msg.address_recognized'), color: 'positive', icon: 'check', timeout: 1000});
        };

        const scanQr = () => {
            document.addEventListener('deviceready', () => {
                const scanner = cordova.plugins.mlkit?.barcodeScanner || cordova.plugins.barcodeScanner;
                if (!scanner) {
                    $q.notify({message: t('transaction.msg.scanner_plugin_missing'), color: 'negative'});
                    return;
                }
                scanner.scan({
                            barcodeFormats: {QRCode: true},
                            beepOnSuccess: false,
                            vibrateOnSuccess: false,
                            detectorSize: 0.6,
                            rotateCamera: false
                        },
                        (result) => {
                            if (!result.cancelled && result.text) handleScanResult(result.text);
                        },
                        (err) => {
                            $q.notify({message: t('transaction.msg.scan_error', { error: err }), color: 'negative'});
                        }
                );
            }, false);
        };

        const pickQrImage = () => {
            if (!navigator.camera) {
                $q.notify({message: t('transaction.msg.camera_error'), color: 'warning'});
                return;
            }
            navigator.camera.getPicture((imageData) => {
                        decodeQrCodeFromBase64(imageData);
                    },
                    (err) => {
                        if (err !== 'Selection cancelled.' && err !== 'no image selected') $q.notify({
                            message: t('transaction.msg.image_error', { error: err }),
                            type: 'negative'
                        });
                    },
                    {
                        quality: 50,
                        destinationType: navigator.camera.DestinationType.DATA_URL,
                        sourceType: navigator.camera.PictureSourceType.PHOTOLIBRARY,
                        mediaType: navigator.camera.MediaType.PICTURE,
                        correctOrientation: true
                    }
            );
        };

        const decodeQrCodeFromBase64 = (base64Data) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                context.drawImage(img, 0, 0);
                const imageData = context.getImageData(0, 0, img.width, img.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code) handleScanResult(code.data); else $q.notify({
                    message: t('transaction.msg.qr_invalid'),
                    type: 'warning',
                    icon: 'qr_code_2'
                });
            };
            img.onerror = () => {
                $q.notify({message: t('transaction.msg.image_load_failed'), type: 'negative'});
            };
            const cleanData = base64Data.replace(/[\r\n]/g, '');
            img.src = cleanData.startsWith('data:') ? cleanData : "data:image/jpeg;base64," + cleanData;
        };

        // --- Secure Keyboard Logic ---
        const openKeyboard = () => {
            keyboardVisible.value = true;
            isFocused.value = true;
        };

        const onKeyboardToggle = (val) => {
            isFocused.value = val;
        };

        const onKeyInput = (char) => {
            if (password.value.length < 32) {
                password.value += char;
            }
        };

        const onKeyDelete = () => {
            if (password.value.length > 0) password.value = password.value.slice(0, -1);
        };

        const onKeyConfirm = () => {
            if (password.value.length >= 6) {
                onConfirm();
            }
        };

        return {
            // Quasar Dialog
            dialogRef, onDialogHide,

            // State
            step, form, currentBalance, password, showPassword,
            loadingNetwork, submitting, chainError, addressError, signStatus, loadTronResource,

            // Strategy Computed
            hasMemo, displayFee, warningMsg, tronResource,

            // Utils
            isMemoSupported,

            // Methods
            toStep2, validateAddressRule, setMaxAmount, onConfirm, formatBalance,
            scanQr, pickQrImage,

            // Keyboard
            keyboardVisible, isFocused, unlockBtnRef,
            openKeyboard, onKeyboardToggle, onKeyInput, onKeyDelete, onKeyConfirm,

            singlePrice: (coin) => {
                return priceStore.getPrice(coin)
            },

            // Memo Name
            memoName: computed(() => {
                let name = 'Memo';
                if (props.asset.coin === 'ripple') {
                    name = 'Tag';
                }
                return name;
            }),

            // Gas Unit Name
            unitName: computed(() => {
                if (props.asset.contract) {
                    const parent = chainStore.getCoin(props.asset.coin);
                    if (parent && parent.symbol) {
                        return parent.symbol;
                    }
                    return props.asset.coin;
                }
                return props.asset.symbol;
            }),

            // Tron Refresh
            onRefreshResource: throttle(async () => {
                loadTronResource.value = true;
                try {
                    if (txStrategy && typeof txStrategy.refreshResource === 'function') {
                        try {
                            await txStrategy.refreshResource();
                        } catch (e) {
                            console.error(e);
                            $q.notify({message: t('transaction.msg.refresh_failed'), color: 'negative'});
                        }
                    }
                } finally {
                    loadTronResource.value = false;
                }
            }, 3000),

        };
    }
});
</script>