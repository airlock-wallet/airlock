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
    <div class="bg-grey-1 column no-wrap overflow-hidden" :style="pageStyle">
        <div class="col-auto bg-primary text-white shadow-2 safe-pt q-mb-xs">
            <div class="z-top q-px-sm">
                <div class="flex items-center justify-between">
                    <q-btn flat round dense icon="arrow_back" color="white" @click="$router.back()"/>
                    <div class="col-grow">
                        <div class="row justify-center items-center">
                            <AutoFontSize
                                    class="text-center"
                                    :min-size="12"
                                    :max-size="32"
                                    :style="{ width: ($q.screen.width - 120) + 'px' }">
                            <span class="text-weight-bolder">
                                {{ formatFriendly(asset?.balance) }}
                            </span>
                                <q-avatar color="white" size="24px" class="q-ml-xs q-mb-xs">
                                    <q-icon v-if="asset" :name="`img:${asset.icon}`" size="20px"/>
                                </q-avatar>
                            </AutoFontSize>
                        </div>
                    </div>
                </div>
                <div class="text-center q-pb-md" style="margin-left: 34px;">
                    <q-chip
                            clickable
                            @click="copyAddress"
                            color="white"
                            text-color="primary"
                            class="q-px-md shadow-1">
                        <span class="fs-12 q-mr-xs">{{ shortAddress }}</span>
                        <q-icon name="content_copy"/>
                    </q-chip>
                </div>
            </div>
        </div>
        <div class="col column bg-grey-1 relative-position">
            <div class="q-px-md q-py-md text-weight-bold text-grey-8">{{ $t('assetDetailPage.title_history') }}</div>
            <div v-if="loadingTransfer && transactions.length === 0" class="column flex-center q-py-xl text-grey-5">
                <q-spinner size="lg" class="q-mt-lg"/>
            </div>
            <div v-else class="col scroll q-px-md q-pb-sm">
                <q-virtual-scroll
                        v-if="transactions.length"
                        style="height: 100%;"
                        :items="transactions"
                        separator
                        @virtual-scroll="onScroll">
                    <template v-slot="{ item: tx }">
                        <q-item :key="tx.txid" class="q-py-md" clickable v-ripple @click="openHistory(asset.coin, tx.txid)">
                            <q-item-section avatar>
                                <q-avatar :color="tx.type === 'send' ? 'orange-1' : 'green-1'"
                                          :text-color="tx.type === 'send' ? 'orange-8' : 'green-8'" size="40px">
                                    <q-icon :name="tx.type === 'send' ? 'call_made' : 'call_received'" size="20px" />
                                </q-avatar>
                            </q-item-section>
                            <q-item-section>
                                <q-item-label class="text-weight-bold">
                                    {{ tx.type === 'send' ? $t('assetDetailPage.tx_type_send') : $t('assetDetailPage.tx_type_receive') }}
                                </q-item-label>
                                <q-item-label caption class="ellipsis" style="max-width: 150px">
                                    {{ tx.type === 'send' ? (tx.to_addr || tx.txid) : (tx.from_addr || tx.txid) }}
                                </q-item-label>
                                <q-item-label caption>{{ date.formatDate(tx.timestamp, 'YYYY-MM-DD HH:mm:ss') }}</q-item-label>
                            </q-item-section>
                            <q-item-section side class="text-right self-end">
                                <q-item-label :class="tx.type === 'send' ? 'text-orange-8' : 'text-green-8'" class="text-weight-bolder">
                                    {{ tx.type === 'send' ? '-' : '+' }} {{ formatFriendly(tx.amount, asset.decimals) }}
                                </q-item-label>
                                <q-item-label caption>
                                    ≈ ${{(parseFloat(singlePrice(asset.symbol)) * parseFloat(tx.amount)).toFixed(2)}}
                                </q-item-label>
                            </q-item-section>
                        </q-item>
                    </template>
                    <template v-slot:after>
                        <div v-if="hasMore" class="row justify-center q-my-md">
                            <q-spinner-dots color="primary" size="30px" />
                        </div>
                    </template>
                </q-virtual-scroll>
                <div v-else class="column flex-center q-py-xl text-grey-5">
                    <q-icon name="history" size="60px" class="opacity-50 q-mb-md"/>
                    <div>{{ $t('assetDetailPage.no_history') }}</div>
                </div>
            </div>
        </div>
        <div class="col-auto bg-white shadow-up-3 q-pa-md row q-gutter-x-md z-top fixed-bottom">
            <q-btn
                    class="col q-py-sm"
                    rounded
                    outline
                    color="primary"
                    icon="call_received"
                    :label="$t('assetDetailPage.btn_receive')"
                    size="md"
                    @click="onReceive"/>
            <q-btn
                    class="col q-py-sm"
                    rounded
                    unelevated
                    color="primary"
                    icon="send"
                    :label="$t('assetDetailPage.btn_send')"
                    size="md"
                    @click="onSend"/>
        </div>
    </div>
</template>
<script>
import {defineComponent, ref, computed, onMounted, defineAsyncComponent, inject} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {useQuasar, date} from 'quasar';
import {getAssetById, getTransactionsByAsset} from 'src/services/DbService';
import {usePriceStore} from 'src/stores/PriceStore';
import ChainService from "src/services/ChainService.js";
import {formatFriendly} from "src/utils/NumberUtil.js";
import { openHistory } from 'src/utils/TransferHistoryUtil.js';
import AutoFontSize from "components/AutoFontSize.vue";
import { useI18n } from 'vue-i18n'; // Import i18n

export default defineComponent({
    name: 'AssetDetailPage',
    components: {
        AutoFontSize,
    },
    setup() {
        const $q = useQuasar();
        const route = useRoute();
        const router = useRouter();
        const priceStore = usePriceStore();
        const { t } = useI18n(); // Use t function

        const transactions = ref([]);
        const hasMore = ref(true);
        const pageLimit = 20;
        let currentOffset = 0;

        const assetId = route.params.id;
        const asset = ref(null);

        const loadingBalance = ref(false);
        const loadingTransfer = ref(false);

        const footerHeight = inject('layoutFooterHeight', ref(70));
        const pageStyle = computed(() => {
            return {
                height: `calc(100vh - ${footerHeight.value}px)`,
            }
        });

        // Load data
        const loadData = async () => {
            if (!assetId) return;
            loadingBalance.value = true;
            loadingTransfer.value = true;
            const res = await getAssetById(assetId);
            if (res) {
                asset.value = res;
                console.log(`Current Asset address: ${asset.value.address}`);

                // 1. Prioritize loading local first page
                await fetchLocalTransactions(true);

                // 2. Async check balance
                ChainService.getBalance(asset.value)
                        .then(data => { asset.value.balance = data.balance || 0; })
                        .finally(() => {
                            loadingBalance.value = false;
                        });

                // 3. Async check latest transactions
                ChainService.getTransaction(asset.value)
                        .then(async (hasNew) => {
                            if (hasNew) {
                                await fetchLocalTransactions(true);
                            }
                        })
                        .finally(() => {
                            loadingTransfer.value = false;
                        });
            } else {
                $q.notify({type: 'negative', message: t('assetDetailPage.msg.asset_not_found')});
                router.back();
            }
        };

        const usdValue = computed(() => {
            if (!asset.value) return '0.00';
            const price = priceStore.getPrice(asset.value.symbol);
            const bal = parseFloat(asset.value.balance || 0);
            return (bal * price).toFixed(2);
        });

        const shortAddress = computed(() => {
            const addr = asset.value?.address;
            if (!addr) return '';
            if (addr.length < 35) return addr;
            return addr.substring(0, 16) + '...' + addr.substring(addr.length - 16);
        });

        const copyAddress = () => {
            if (asset.value?.address) {
                if (window.cordova && cordova.plugins && cordova.plugins.clipboard) {
                    cordova.plugins.clipboard.copy(asset.value.address, () => {
                        $q.notify({type: 'positive', message: t('assetDetailPage.msg.copied'), timeout: 1000})
                    }, (error) => {
                        reject(error);
                        $q.notify({ message: t('assetDetailPage.msg.copy_failed'), color: 'negative' });
                    });
                } else {
                    $q.notify({ message: t('assetDetailPage.msg.clipboard_unavailable'), color: 'negative' });
                }
            }
        };

        const onReceive = () => {
            if (!asset.value) return;
            $q.dialog({
                component: defineAsyncComponent(() => import('src/dialog/ReceiveDialog.vue')),
                componentProps: {
                    asset: asset.value
                }
            })
        };

        const onSend = () => {
            if (!asset.value) return;
            $q.dialog({
                component: defineAsyncComponent(() => import('src/dialog/Transaction.vue')),
                componentProps: {
                    asset: asset.value
                }
            }).onOk((payload) => {
                console.log(`Transaction result: ${JSON.stringify(payload)}`);
            })
        };

        // Pagination loading core logic
        const fetchLocalTransactions = async (reset = false) => {
            if (reset) {
                currentOffset = 0;
                hasMore.value = true;
            }
            const moreTxs = await getTransactionsByAsset(
                    asset.value,
                    currentOffset,
                    pageLimit
            );

            if (moreTxs.length < pageLimit) {
                hasMore.value = false;
            }

            if (reset) {
                transactions.value = moreTxs;
            } else {
                transactions.value.push(...moreTxs);
            }
            currentOffset += moreTxs.length;
        };

        // Listen for virtual scroll
        const onScroll = ({ index, to }) => {
            // Trigger load when scrolling to 5 items from the end
            if (hasMore.value && to >= transactions.value.length - 5) {
                fetchLocalTransactions();
            }
        };

        onMounted(async () => {
            await loadData();
        });

        return {
            asset,
            shortAddress,
            usdValue,
            transactions,
            hasMore,
            loadingBalance,
            loadingTransfer,
            pageStyle,
            formatFriendly,
            copyAddress,
            onReceive,
            onSend,
            onScroll,
            openHistory,
            date,
            singlePrice: (coin) => {
                return priceStore.getPrice(coin)
            },
        };
    }
});
</script>
<style scoped>
</style>