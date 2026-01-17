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
        <div class="col-auto bg-primary text-white q-pb-md q-px-md shadow-2 safe-pt">
            <div class="row items-center">
                <div>
                    <div class="text-caption text-white q-pb-xs">{{ $t('accountPage.total_assets') }}</div>
                    <AutoFontSize :min-size="12"
                                  :max-size="32"
                                  :style="{ width: ($q.screen.width - 40) + 'px' }">
                        <span class="text-weight-bolder">$ {{ totalUsdValue }}</span>
                    </AutoFontSize>
                </div>
            </div>
        </div>
        <div class="col column q-pt-sm q-px-sm q-pb-sm">
            <q-card flat class="column full-height">
                <q-card-section class="col-auto q-pa-sm">
                    <q-input
                            v-model="searchKeyword"
                            dense
                            filled
                            :placeholder="$t('accountPage.search_placeholder')"
                            clearable
                            class="bg-white">
                        <template v-slot:prepend>
                            <q-icon name="search" class="text-grey"/>
                        </template>
                    </q-input>
                </q-card-section>
                <q-card-section class="flex items-center justify-between col-auto q-py-sm">
                    <div class="text-subtitle1 text-weight-bold text-grey-7">{{ $t('accountPage.account_list') }}({{ filteredAccounts.length }})</div>
                    <q-btn flat dense icon="add_circle" color="primary" @click="addAccount"/>
                </q-card-section>
                <q-card-section v-if="loading" class="col">
                    <q-skeleton type="text" width="60%"/>
                    <q-skeleton type="text" width="40%"/>
                </q-card-section>
                <q-card-section v-else class="col q-pa-none">
                    <q-virtual-scroll
                            v-if="filteredAccounts.length"
                            class="full-height"
                            :items="filteredAccounts"
                            v-slot="{ item, index }">
                        <q-card :key="item.id"
                                class="q-mb-xs q-mx-sm"
                                v-ripple
                                flat
                                bordered
                                @click="enterWallet(item)">
                            <q-item class="q-py-md">
                                <q-item-section avatar>
                                    <q-icon :name="`img:${item.icon}`" size="lg"/>
                                </q-item-section>
                                <q-item-section>
                                    <q-item-label class="text-weight-bold text-body1">
                                        {{ item.name }}
                                    </q-item-label>
                                    <q-item-label>
                                        <div class="flex no-wrap" style="max-width: 160px">
                                            <div class="col-shrink fs-15 text-grey-9 ellipsis">
                                                {{ displayBalance(item.coin) }}
                                            </div>
                                            <div class="col-auto text-weight-bolder text-grey fs-9 q-ml-xs">
                                                {{ item.symbol }}
                                            </div>
                                        </div>
                                    </q-item-label>
                                </q-item-section>
                                <q-item-section avatar>
                                    <q-item-label caption class="fs-13">
                                        ${{ singlePrice(item.symbol) }}
                                    </q-item-label>
                                    <q-item-label class="fs-14 text-grey-8">
                                        ≈ ${{(parseFloat(singlePrice(item.symbol)) * parseFloat(singleBalance(item.coin))).toFixed(2)}}
                                    </q-item-label>
                                </q-item-section>
                            </q-item>
                        </q-card>
                    </q-virtual-scroll>
                    <div v-else class="q-mt-md text-grey text-center">
                        <div>{{ $t('accountPage.no_account_match') }}</div>
                    </div>
                </q-card-section>
            </q-card>
        </div>
    </div>
</template>
<script>
import {defineComponent, ref, onMounted, computed, defineAsyncComponent, inject, onUnmounted} from 'vue';
import {getAccountList, getAllAssetsForValuation, saveAccounts} from 'src/services/DbService';
import {useQuasar} from "quasar";
import BleService from "src/services/BleService";
import {usePriceStore} from 'src/stores/PriceStore';
import {storeToRefs} from 'pinia'; // Destructure ref while keeping reactivity
import {useRouter} from 'vue-router';
import {formatFriendly} from "src/utils/NumberUtil.js";
import AutoFontSize from "components/AutoFontSize.vue";
import { bus } from "boot/bus.js";
import { useI18n } from 'vue-i18n'; // Import i18n

export default defineComponent({
    name: 'AccountPage',
    components: {
        AutoFontSize
    },
    setup() {
        const $q = useQuasar();
        const { t } = useI18n(); // Use t function
        const router = useRouter();
        const loading = ref(true);
        const accounts = ref([]);
        const assets = ref([]);
        const searchKeyword = ref('');

        const priceStore = usePriceStore();
        // Destructure priceMap directly (keep reactivity)
        const {priceMap} = storeToRefs(priceStore);
        let pollTimer = null;

        const footerHeight = inject('layoutFooterHeight', ref(70));
        const pageStyle = computed(() => {
            return {
                height: `calc(100vh - ${footerHeight.value}px)`,
            }
        });

        const refreshPrices = () => {
            if (accounts.value.length === 0) return;
            const symbols = [...new Set(accounts.value.map(a => a.symbol))];
            priceStore.fetchPrices(symbols);
        };
        const totalUsdValue = computed(() => {
            let total = 0;

            // Traverse asset list
            assets.value.forEach(asset => {
                // Get current price
                const price = priceStore.getPrice(asset.symbol);
                // Get coin balance
                const balance = parseFloat(asset.balance || 0);
                total += balance * price;
            });

            // Format as currency string (e.g. 12,345.67)
            return total.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        });
        const filteredAccounts = computed(() => {
            const list = accounts.value;
            const keyword = searchKeyword.value?.trim().toLowerCase();
            if (!keyword) return list;
            return list.filter(item => {
                // Search name, path, or symbol
                const nameMatch = item.name?.toLowerCase().includes(keyword);
                const pathMatch = item.path?.toLowerCase().includes(keyword);
                const symbolMatch = item.symbol?.toLowerCase().includes(keyword);
                return nameMatch || pathMatch || symbolMatch;
            });
        });
        const initData = async () => {
            try {
                const [_accounts, _assets] = await Promise.all([
                    getAccountList(),
                    getAllAssetsForValuation()
                ]);
                accounts.value = _accounts;
                assets.value = _assets;
                refreshPrices();
            } finally {
                loading.value = false;
            }
        }
        const addAccount = () => {
            $q.dialog({
                component: defineAsyncComponent(() => import('src/dialog/AddAccount.vue')),
                componentProps: {
                    accounts: accounts.value,
                }
            }).onOk(async (payload) => {
                if (!payload) return;
                try {
                    $q.loading.show();

                    // Request data
                    const accounts = await BleService.sendRequest("create_account", {coin: payload.id});

                    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
                        throw new Error(t('accountPage.msg.empty_response'));
                    }

                    // Save wallet
                    await saveAccounts(accounts);

                    // Reload
                    await initData();

                    // Success notification
                    $q.notify({
                        type: 'positive',
                        message: t('accountPage.msg.account_added'),
                        position: 'top'
                    });

                } catch (e) {
                    // Error handling
                    console.error("Add failed:", e);
                    $q.notify({
                        type: 'negative',
                        message: e.message || t('accountPage.msg.add_failed'), // Show specific error
                        position: 'top'
                    });
                } finally {
                    if ($q.loading.isActive) {
                        $q.loading.hide();
                    }
                }

            })
        }
        const enterWallet = (item) => {
            router.push({name: 'wallet', params: {coin: item.coin}})
        }

        const singlePrice = (coin) => {
            return priceStore.getPrice(coin)
        }
        const singleBalance = (coin) => {
            return assets.value
                    .filter(a => {
                        return a.coin === coin && !a.contract;
                    })
                    .reduce((acc, cur) => {
                        return acc + Number(cur.balance || 0);
                    }, 0);
        }
        const displayBalance = (coin) => {
          return formatFriendly(singleBalance(coin), coin.decimals);
        }

        // Async balance update
        const balanceUpdated = async (newAssets) => {
            if (!newAssets || newAssets.length === 0) return;

            const balanceMap = {};
            newAssets.forEach(item => {
                balanceMap[item.id] = item.balance;
            });

            assets.value.forEach(asset => {
                // Try to get new balance from map
                const newBalance = balanceMap[asset.id];

                // Update only if: (1) ID exists in Map AND (2) Balance actually changed
                // undefined check prevents clearing balance if ID is missing in Map
                if (newBalance !== undefined && asset.balance !== newBalance) {
                    asset.balance = newBalance;
                    console.log(`[UI] Updated balance for ${asset.symbol}: ${newBalance}`);
                }
            });
        }

        onMounted(() => {
            initData();
            // Start polling: update prices every 30 seconds
            pollTimer = setInterval(refreshPrices, 30000);
            bus.on('balance:updated', balanceUpdated);
        });

        onUnmounted(() => {
            if (pollTimer) clearInterval(pollTimer);
            bus.off('balance:updated');
        });

        return {
            loading,
            filteredAccounts,
            assets,
            totalUsdValue,
            searchKeyword,
            addAccount,
            enterWallet,
            pageStyle,
            priceMap,
            singlePrice,
            singleBalance,
            displayBalance,
        };
    }
});
</script>
<style scoped>
</style>