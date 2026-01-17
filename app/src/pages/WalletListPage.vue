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
    <div class="bg-grey-1 column no-wrap" :style="pageStyle">

        <div class="col-auto bg-primary text-white shadow-2 safe-pt relative-position overflow-hidden z-top">
            <q-img v-if="headerIcon" :src="headerIcon" width="60px" height="60px" class="absolute-right" style="opacity: 0.125; top: 30px; right: 30px; pointer-events: none; filter: sepia(1);"/>
            <q-img v-if="headerIcon" :src="headerIcon" width="40px" height="40px" class="absolute-left" style="opacity: 0.125; top: 45px; left: 35px; pointer-events: none; filter: sepia(1); transform: rotateZ(35deg)"/>

            <div class="z-top q-mb-md q-px-sm">
                <div class="flex items-center justify-between">
                    <q-btn round dense flat icon="arrow_back" color="white" @click="goBack"/>
                    <div class="row items-center justify-center">
                        <AutoFontSize :max-size="32"
                                      :min-size="12"
                                      class="text-center"
                                      :style="{ width: ($q.screen.width - 120) + 'px' }">
                            <span class="text-weight-bolder">
                                $ {{ accountTotalUsd }}
                            </span>
                            <q-badge color="green-14"
                                     text-color="white"
                                     class="fs-10 text-weight-bolder">
                                {{ account?.symbol }}</q-badge>
                        </AutoFontSize>
                    </div>
                    <q-btn round dense flat icon="add" color="white" @click="handleAddAsset" :loading="addAssetLoading"/>
                </div>
            </div>
        </div>

        <div class="col-auto bg-white border-bottom-grey q-px-md q-py-sm row items-center justify-between shadow-1">
            <div class="col row items-center text-grey-7 fs-12 text-overflow cursor-pointer" @click="openFilterDialog">
                <q-icon name="filter_list" size="16px" class="q-mr-xs text-primary"/>
                <span v-if="filterSummary" class="text-weight-medium text-black">{{ filterSummary }}</span>
                <span v-else class="text-grey-6">{{ $t('walletListPage.filter.summary_prefix') }} ({{ assets.length }})</span>
            </div>
            <div class="col-auto row q-gutter-x-xs">
                <q-btn v-if="hasActiveFilters" flat dense round icon="close" color="grey-5" size="sm" @click="resetFilters"/>
                <q-btn unelevated dense color="primary" :label="$t('walletListPage.filter.label')" icon-right="tune" size="sm" class="q-px-sm" @click="openFilterDialog"/>
            </div>
        </div>

        <div class="col scroll relative-position q-px-sm q-pb-sm q-mt-sm" ref="scrollTargetRef">
            <q-virtual-scroll
                    v-if="processedWallets.length > 0"
                    ref="virtualScrollRef"
                    :items="processedWallets"
                    :scroll-target="scrollTargetRef"
                    :virtual-scroll-slice-size="30"
                    class="full-height"
                    @virtual-scroll="onVirtualScroll">
                <template v-slot="{ item: asset, index }">
                    <div :key="index" class="q-mb-sm">
                        <q-card flat bordered class="rounded-borders">
                            <q-item class="q-py-md" clickable v-ripple @click="toAssetDetail(asset)">
                                <q-item-section avatar>
                                    <q-icon :name="`img:${asset.icon}`" size="lg"/>
                                </q-item-section>

                                <q-item-section>
                                    <q-item-label class="text-weight-bold row items-center">
                                        <span class="text-body1 q-mr-sm ellipsis">{{ asset.displayName }}</span>
                                        <q-badge v-if="asset.contract" color="orange" label="Token" outline rounded/>
                                    </q-item-label>
                                    <q-item-label caption class="row items-center fs-12 q-mt-xs">
                                        <span class="text-grey-8 text-break-all">{{ asset.formattedAddr }}</span>
                                    </q-item-label>
                                </q-item-section>

                                <q-item-section side class="text-right">
                                    <q-item-label>
                                        <div class="flex">
                                            <div class="text-black fs-15">
                                                {{ asset.formattedBalance }}
                                            </div>
                                            <div class="fs-9 text-weight-medium text-grey">{{ asset.symbol }}</div>
                                        </div>
                                    </q-item-label>
                                    <q-item-label caption v-if="asset.usdValue">≈ ${{ asset.usdValue }}</q-item-label>
                                </q-item-section>
                            </q-item>

                            <template v-if="asset.displayTokens && asset.displayTokens.length && !asset.contract">
                                <q-separator :inset="true" color="grey-3"/>
                                <div class="row no-wrap items-center q-py-xs q-px-md full-width">
                                    <q-badge label="Token" outline color="grey-5" class="q-mr-sm" style="flex-shrink: 0"/>
                                    <q-scroll-area class="col" style="height: 28px;" :thumb-style="{ opacity: 0 }" :bar-style="{ opacity: 0 }">
                                        <div class="row no-wrap items-center">
                                            <q-btn v-for="(token, tIdx) in asset.displayTokens"
                                                   :key="tIdx"
                                                   round
                                                   size="xs"
                                                   flat
                                                   :icon="`img:/coins/${token.icon}`"
                                                   @click.stop="handleAddToken(asset, token)"/>
                                        </div>
                                    </q-scroll-area>
                                </div>
                            </template>
                        </q-card>
                    </div>
                </template>
            </q-virtual-scroll>
            <div v-if="initialLoading" class="absolute-center">
                <q-spinner color="primary" size="40px" />
            </div>
            <div v-else-if="isLoadingMore" class="row justify-center q-py-md">
                <q-spinner-dots color="primary" size="30px"/>
            </div>
        </div>

        <q-dialog v-model="showFilterDialog" position="bottom">
            <q-card class="full-width safe-pb" :style="{ paddingBottom: `${keyboardHeight}px` }">
                <q-card-section class="row items-center q-pb-none">
                    <div class="text-h6 text-weight-bold">{{ $t('walletListPage.filter.title') }}</div>
                    <q-space />
                    <q-btn icon="close" flat round dense v-close-popup color="grey-7" />
                </q-card-section>
                <q-card-section>
                    <div class="q-gutter-y-lg">
                        <div>
                            <div class="text-caption text-grey-8 q-mb-xs text-weight-bold">{{ $t('walletListPage.filter.network') }}</div>
                            <div class="row q-gutter-sm">
                                <q-btn
                                        v-for="opt in chainOptions" :key="opt.value"
                                        :outline="tempFilters.name !== opt.value"
                                        :unelevated="tempFilters.name === opt.value"
                                        :color="tempFilters.name === opt.value ? 'primary' : 'grey-5'"
                                        :text-color="tempFilters.name === opt.value ? 'white' : 'grey-9'"
                                        :label="opt.label"
                                        size="md" no-caps
                                        @click="tempFilters.name = opt.value"
                                        class="rounded-borders"/>
                            </div>
                        </div>
                        <div>
                            <div class="text-caption text-grey-8 q-mb-xs text-weight-bold">{{ $t('walletListPage.filter.balance') }}</div>
                            <q-input
                                    v-model.number="tempFilters.minBalance"
                                    type="number"
                                    outlined
                                    clearable
                                    dense
                                    :label="$t('walletListPage.filter.balance_placeholder')"
                                    class="q-mt-xs">
                                <template v-slot:prepend><q-icon name="functions" size="xs" /></template>
                            </q-input>
                        </div>
                        <div>
                            <div class="text-caption text-grey-8 q-mb-xs text-weight-bold">{{ $t('walletListPage.filter.fuzzy') }}</div>
                            <q-input
                                    v-model="tempFilters.keyword"
                                    outlined dense
                                    :placeholder="$t('walletListPage.filter.fuzzy_placeholder')"
                                    clearable>
                                <template v-slot:prepend><q-icon name="search" /></template>
                            </q-input>
                        </div>
                    </div>
                </q-card-section>
                <q-card-actions align="between" class="q-pa-md bg-grey-1">
                    <q-btn flat :label="$t('walletListPage.filter.reset')" color="grey-7" class="q-px-md col" @click="resetTempFilters" />
                    <q-btn unelevated :label="$t('walletListPage.filter.apply')" color="primary" class="q-px-xl col" @click="applyFilters" />
                </q-card-actions>
            </q-card>
        </q-dialog>
    </div>
</template>

<script>
import {computed, inject, onMounted, ref, reactive, nextTick, onUnmounted} from "vue";
import { useRoute, useRouter } from 'vue-router';
import { useQuasar, throttle } from 'quasar';
import {
    getAccount, getAssets, getAllAssetsForAccountId,
    deriveNewWalletWithSecp256k1, getAssetsByCoinWithMaxDerivationIndex,
    createNewWalletWithEd25519, createNewToken, getAllTokensForAccountId
} from "src/services/DbService.js";
import { usePriceStore } from 'src/stores/PriceStore';
import { useChainStore } from "stores/chainStore.js";
import { useUserStore } from "stores/userStore.js";
import BleService from "src/services/BleService.js";
import {formatFriendly} from "src/utils/NumberUtil.js";
import AutoFontSize from "components/AutoFontSize.vue";
import {bus} from "boot/bus.js";
import { useI18n } from 'vue-i18n'; // Import i18n

export default {
    name: "WalletListPage",
    components: {
        AutoFontSize
    },
    setup() {
        const $q = useQuasar();
        const { t } = useI18n(); // Use t function
        const route = useRoute();
        const router = useRouter();
        const chainStore = useChainStore();
        const priceStore = usePriceStore();
        const userStore = useUserStore();

        // --- Reactive State ---
        const assets = ref([]);
        const allAlreadyCreateTokens = ref([]);
        const account = ref(null);
        const accountTotalUsd = ref('0.00');
        const initialLoading = ref(true);
        const isLoadingMore = ref(false);
        const addAssetLoading = ref(false);
        const isFinished = ref(false);
        const page = ref(1);
        const pageSize = 20;

        const scrollTargetRef = ref(null);
        const virtualScrollRef = ref(null);
        const coin = route.params.coin;
        const keyboardHeight = ref(0);

        const footerHeight = inject('layoutFooterHeight', ref(70));
        const pageStyle = computed(() => ({ height: `calc(100vh - ${footerHeight.value}px)` }));

        // --- [Core Performance Optimization] Computed Property Pre-processing ---
        // Use Map index to significantly improve lookup performance, reducing complexity from O(N*M) to O(N)
        const processedWallets = computed(() => {
            if (!account.value) return [];
            const contractLookup = new Map();
            // Build hash map for already created Tokens
            allAlreadyCreateTokens.value.forEach(t => {
                if (!contractLookup.has(t.address)) contractLookup.set(t.address, new Set());
                contractLookup.get(t.address).add(t.contract);
            });
            const validTokens = chainStore.getValidTokens(account.value.coin);

            return assets.value.map((asset) => {
                const price = priceStore.getPrice(asset.symbol) || 0;
                const bal = parseFloat(asset.balance || 0);
                const createdSet = contractLookup.get(asset.address);
                return {
                    ...asset,
                    displayName: asset.name,
                    formattedAddr: asset.address ? `${asset.address.slice(0, 8)}...${asset.address.slice(-8)}` : '',
                    formattedBalance: formatFriendly(bal, asset.decimals),
                    usdValue: price > 0 ? (bal * price).toFixed(2) : null,
                    // Pre-filter tokens not added under this asset
                    displayTokens: asset.contract ? [] : validTokens.filter(t => !createdSet?.has(t.contract))
                };
            });
        });
        // --- Scroll & Load Logic ---

        // Monitor virtual scroll position to implement seamless pagination loading
        const onVirtualScroll = ({ to }) => {
            if (!isFinished.value && !isLoadingMore.value && to >= assets.value.length - 1) {
                loadMoreData();
            }
        };

        // Query asset prices (throttled to avoid frequent requests)
        const throttleFetchPrices = throttle(async (symbols) => {
            await priceStore.fetchPrices(symbols);
        }, 3000);

        const loadMoreData = async () => {
            if (isLoadingMore.value || isFinished.value || !account.value) return;
            isLoadingMore.value = true;
            try {
                const newItems = await getAssets(account.value, page.value, pageSize, activeFilters);
                if (newItems.length > 0) {
                    const combinedList = [...assets.value, ...newItems];

                    // -----------------------------------------------------
                    // Step 1: Pre-calculate the "weight" of each address (use main coin balance to represent address status)
                    // -----------------------------------------------------
                    const addressWeight = {};

                    combinedList.forEach(item => {
                        // If it is the main coin (!item.contract), record its balance as the weight of this address
                        // If an address has multiple assets, we only use the main coin's balance as the sorting basis
                        if (!item.contract) {
                            // Use parseFloat is sufficient for sorting, prevents BigInt error on empty string
                            addressWeight[item.address] = parseFloat(item.balance || '0');
                        }
                        // If the address hasn't recorded weight yet (main coin might not be loaded), temporarily assign 0
                        if (addressWeight[item.address] === undefined) {
                            addressWeight[item.address] = 0;
                        }
                    });

                    // -----------------------------------------------------
                    // Step 2: Execute sorting
                    // -----------------------------------------------------
                    combinedList.sort((a, b) => {
                        // [Level 1]: Compare "weight" of two addresses (whoever has more main coin money, their whole family ranks first)
                        if (a.address !== b.address) {
                            const weightA = addressWeight[a.address] || 0;
                            const weightB = addressWeight[b.address] || 0;
                            // Descending: larger weight ranks first
                            // Note: If weights are equal (e.g. both 0), fallback to sorting by address string to ensure stability
                            if (weightB !== weightA) {
                                return weightB - weightA;
                            }
                            return a.address.localeCompare(b.address);
                        }

                        // [Level 2]: (Inside same address) Pin main coin to top
                        const isNativeA = !a.contract;
                        const isNativeB = !b.contract;
                        if (isNativeA && !isNativeB) return -1;
                        if (!isNativeA && isNativeB) return 1;

                        // [Level 3]: (Inside same address) Balance descending
                        const balA = parseFloat(a.balance || '0');
                        const balB = parseFloat(b.balance || '0');
                        return balB - balA;
                    });

                    // Assign to reactive variable to trigger view update
                    assets.value = combinedList;

                    page.value++;
                    // Asynchronously fetch prices of new assets
                    throttleFetchPrices([...new Set(newItems.map(i => i.symbol))]).catch(e=>console.error(e));
                    if (newItems.length < pageSize) isFinished.value = true;
                } else {
                    isFinished.value = true;
                }

            } finally {
                isLoadingMore.value = false;
            }
        };

        // Add new asset logic: Includes hardware Bluetooth interaction and derivation algorithm determination
        const handleAddAsset = async () => {
            try {
                addAssetLoading.value = true;
                const coinObj = chainStore.getCoin(account.value.coin);
                let newAssets;

                if (coinObj.curve === 'secp256k1') {
                    // SECP algorithm direct derivation
                    newAssets = await deriveNewWalletWithSecp256k1(coinObj);
                } else if (coinObj.curve === 'ed25519') {
                    // ED25519 algorithm involves hardware Bluetooth communication
                    const dbAsset = await getAssetsByCoinWithMaxDerivationIndex(account.value.id, coinObj.id);
                    if (!dbAsset) {
                        $q.notify({type: 'negative', message: t('walletListPage.msg.error_retry')});
                        return;
                    }
                    const hwAssets = await BleService.sendRequest('get_account', {
                        coin: dbAsset.coin,
                        index: dbAsset.derivation_index,
                        mode: userStore.walletMode
                    }, 5000);
                    if (Array.isArray(hwAssets) && hwAssets.length > 0) {
                        newAssets = await createNewWalletWithEd25519(account.value, hwAssets);
                    } else {
                        $q.notify({type: 'warning', message: t('walletListPage.msg.limit_exceeded')});
                    }
                }
                if (newAssets) await addAfterReload(newAssets);
            } catch (e) {
                $q.notify({type: 'negative', message: t('walletListPage.msg.derive_failed', { error: e.message })});
            } finally { addAssetLoading.value = false; }
        };

        const handleAddToken = async (asset, token) => {
            const res = await createNewToken(asset, token);
            if (res) await addAfterReload(res);
        };

        // Unify handling of view refresh and auto-scroll after data update
        const addAfterReload = async (newItems) => {
            if (newItems?.length > 0) {
                assets.value = [...assets.value, ...newItems];
                allAlreadyCreateTokens.value = await getAllTokensForAccountId(account.value.id);
                await updateTotalAssetValue();

                await nextTick();
                // [Optimization] Auto scroll to the position of the newly generated asset
                if (virtualScrollRef.value && scrollTargetRef.value) {
                    // 1. Virtual scroll component jumps to target index
                    virtualScrollRef.value.scrollTo(assets.value.length - 1);
                    // 2. Force native container to bottom to ensure full visibility
                    setTimeout(() => {
                        scrollTargetRef.value.scrollTop = scrollTargetRef.value.scrollHeight;
                    }, 50);
                }
                $q.notify({ type: 'positive', message: t('walletListPage.msg.added', { count: newItems.length }) });
            }
        };

        // Total asset value calculation (throttled to avoid frequent calculations)
        const updateTotalAssetValue = throttle(async () => {
            if (!account.value?.id) return;
            const total = await getAllAssetsForAccountId(account.value.id);
            accountTotalUsd.value = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }, 1500);

        // Initialization
        const init = async () => {
            account.value = await getAccount(coin);
            if (account.value) {
                await updateTotalAssetValue();
                allAlreadyCreateTokens.value = await getAllTokensForAccountId(account.value.id);
                await loadMoreData();
            }
            initialLoading.value = false;
        };

        // --- Filter Logic ---
        const showFilterDialog = ref(false);
        // If not in Store, getFiltersForCoin returns default value
        const savedFilters = chainStore.getFiltersForCoin(coin);

        const activeFilters = reactive({ ...savedFilters });
        const tempFilters = reactive({ ...savedFilters });

        const resetAndReload = () => { page.value = 1; assets.value = []; isFinished.value = false; loadMoreData(); };

        const onKeyboardShow = (e) => {
            keyboardHeight.value = e.keyboardHeight + 24;
        };

        const onKeyboardHide = () => {
            keyboardHeight.value = 0;
        };

        // Async balance update
        const balanceUpdated = async (newAssets) => {
            if (!newAssets || newAssets.length === 0) return;

            const balanceMap = {};
            newAssets.forEach(item => {
                balanceMap[item.id] = item.balance;
            });

            assets.value.forEach(asset => {
                // Try to get new balance corresponding to this ID from map
                const newBalance = balanceMap[asset.id];

                // Update only if: (1) ID exists in Map AND (2) Balance actually changed
                // undefined check is to prevent clearing balance if ID is missing in Map
                if (newBalance !== undefined && asset.balance !== newBalance) {
                    asset.balance = newBalance;
                    console.log(`[UI] Updated balance for ${asset.symbol}: ${newBalance}`);
                }
            });
        }

        // Lifecycle listeners
        onMounted(() => {
            init();
            window.addEventListener('native.keyboardshow', onKeyboardShow);
            window.addEventListener('native.keyboardhide', onKeyboardHide);
            bus.on('balance:updated', balanceUpdated);
        });

        // Unmount listeners
        onUnmounted(() => {
            window.removeEventListener('native.keyboardshow', onKeyboardShow);
            window.removeEventListener('native.keyboardhide', onKeyboardHide);
            bus.off('balance:updated');
        });

        return {
            account, assets, accountTotalUsd, initialLoading, isLoadingMore, isFinished, addAssetLoading,
            scrollTargetRef, virtualScrollRef, pageStyle, processedWallets,
            keyboardHeight, onVirtualScroll, handleAddAsset, handleAddToken,

            headerIcon: computed(() => null), showFilterDialog, tempFilters, activeFilters,
            hasActiveFilters: computed(() => activeFilters.name !== 'all' || Number(activeFilters.minBalance) > 0 || activeFilters.keyword !== ''),
            filterSummary: computed(() => {
                const p = [];
                if (activeFilters.name !== 'all') p.push(activeFilters.name);
                if (Number(activeFilters.minBalance) > 0) {
                    // Use interpolation for translation
                    p.push(t('walletListPage.filter.summary_balance', { amount: activeFilters.minBalance }));
                }
                if (activeFilters.keyword) p.push(`"${activeFilters.keyword}"`);
                return p.join(" · ");
            }),
            chainOptions: computed(() => {
                // Translated label for "All Chains"
                const opts = [{label: t('walletListPage.filter.all_chains'), value: 'all'}];
                if (!account.value) return opts;
                opts.push({label: account.value.symbol, value: account.value.symbol});
                chainStore.getValidTokens(coin).forEach(c => opts.push({label: c.symbol, value: c.symbol}));
                return opts;
            }),

            goBack: () => router.back(),
            toAssetDetail: (asset) => asset?.id && router.push({ name: 'asset-detail', params: { id: asset.id } }),
            openFilterDialog: () => { Object.assign(tempFilters, activeFilters); showFilterDialog.value = true; },
            applyFilters: () => {
                Object.assign(activeFilters, tempFilters);
                chainStore.saveFiltersForCoin(coin, tempFilters);
                showFilterDialog.value = false;
                resetAndReload();
            },
            resetFilters: () => {
                const defaultFilters = { name: 'all', minBalance: '', keyword: '' };
                Object.assign(activeFilters, defaultFilters);
                chainStore.saveFiltersForCoin(coin, defaultFilters);
                resetAndReload();
            },
            resetTempFilters: () => Object.assign(tempFilters, { name: 'all', minBalance: '', keyword: '' }),
        };
    }
}
</script>