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
              @before-hide="hideDialog"
              @before-show="showDialog"
              @hide="onDialogHide"
              maximized
              transition-duration="500"
              transition-show="slide-up"
              transition-hide="slide-down">
        <q-card class="q-dialog-plugin safe-mt safe-pb">
            <q-card-section class="row items-center">
                <div class="text-h6">{{ $t('addAccount.title') }}</div>
                <q-space/>
                <q-btn icon="close" color="grey-9" flat round dense v-close-popup/>
            </q-card-section>
            <q-card-section>
                <q-input
                        v-model="searchKeyword"
                        dense
                        filled
                        :placeholder="$t('addAccount.placeholder_search')"
                        clearable>
                    <template v-slot:prepend>
                        <q-icon name="search"/>
                    </template>
                </q-input>
            </q-card-section>
            <q-card-section class="col q-pa-none scroll">
                <q-virtual-scroll
                        v-if="filteredCoins.length"
                        :items="filteredCoins"
                        separator
                        style="max-height: calc(100vh - 175px)"
                        class="q-pb-sm"
                        v-slot="{ item, index }">
                    <q-item
                            :key="index"
                            v-ripple
                            clickable
                            class="q-px-lg"
                            @click="handleSelect(item)">
                        <q-item-section avatar>
                            <q-icon :name="getIcon(item)" size="md"/>
                        </q-item-section>
                        <q-item-section>
                            <q-item-label class="text-subtitle2">
                                {{ item.name }}
                            </q-item-label>
                            <q-item-label caption>
                                <div class="flex items-baseline">
                                    <div>{{ item.symbol }}</div>
                                    <div class="fs-10">({{item.blockchain}})</div>
                                </div>
                            </q-item-label>
                        </q-item-section>
                        <q-item-section avatar>
                            <q-icon name="add" color="grey"/>
                        </q-item-section>
                    </q-item>
                </q-virtual-scroll>
                <div v-else class="text-center q-pb-xl text-grey">
                    <div class="q-mt-sm">{{ $t('addAccount.no_coin_found') }}</div>
                </div>
            </q-card-section>
        </q-card>
    </q-dialog>
</template>

<script>
import {useDialogPluginComponent} from 'quasar';
import {useChainStore} from "stores/chainStore.js";
import {computed, ref} from "vue";
import { setStatusBar } from "src/utils/SystemUtil.js";
import { useI18n } from 'vue-i18n'; // Import i18n

export default {
    name: "AddAccount",
    props: {
        accounts: { type: Array, required: true }
    },
    emits: [
        ...useDialogPluginComponent.emits
    ],
    setup(props) {
        const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();
        const chainStore = useChainStore();
        const { t } = useI18n(); // Use t function

        // Search keyword
        const searchKeyword = ref('');

        // Step 1: Calculate available coins (exclude existing ones)
        // Use Set to optimize lookup performance
        const availableCoins = computed(() => {
            const existingCoins = new Set(props.accounts.map(c => c.coin));
            return chainStore.validCoins.filter(c => !existingCoins.has(c.id));
        });

        // Step 2: Filter again based on search keyword
        const filteredCoins = computed(() => {
            const list = availableCoins.value;
            const keyword = searchKeyword.value?.trim().toLowerCase();
            if (!keyword) {
                return list;
            }

            return list.filter(c =>
                    c.id.toLowerCase().includes(keyword) ||
                    c.name.toLowerCase().includes(keyword) ||
                    c.symbol.toLowerCase().includes(keyword)
            );
        });

        // Handle click selection
        const handleSelect = (coin) => {
            // Return selected coin to parent component
            onDialogOK(coin);
        };

        function showDialog() {
            setStatusBar('white');
        }

        function hideDialog() {
            setStatusBar('primary');
        }

        return {
            dialogRef,
            onDialogHide,
            onCancelClick: onDialogCancel,

            searchKeyword,
            filteredCoins,
            handleSelect,
            hideDialog,
            showDialog,
            getIcon: (coin) => {
                const accountIconMap = {
                    'arbitrum': 'etharbitrum.svg'
                };
                const accountIcon = accountIconMap[coin.id] || (coin.symbol.toLowerCase() + '.svg')
                return 'img:/coins/' + accountIcon;
            }
        }
    }
}
</script>

<style scoped>
</style>