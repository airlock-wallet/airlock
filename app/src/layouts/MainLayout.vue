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
    <q-layout view="hHh lpR fFf">
        <q-header elevated class="bg-primary text-white">
        </q-header>

        <q-page-container>
            <router-view v-slot="{ Component }">
                <component :is="Component"/>
            </router-view>
        </q-page-container>

        <q-footer bordered class="bg-white text-grey-7 safe-pb">
            <q-resize-observer @resize="onFooterResize" />
            <q-tabs
                    no-caps
                    :model-value="tab"
                    active-color="primary"
                    indicator-color="transparent"
                    class="text-grey-7 bottom-menu"
                    align="justify">
                <q-tab
                        name="home"
                        @click="switchTab('home')"
                        icon="bi-wallet2"
                        :label="$t('menu.accounts')"/>
                <q-tab
                        name="device"
                        @click="switchTab('device')"
                        icon="bi-cpu"
                        :label="$t('menu.device')"/>
                <q-tab
                        name="me"
                        @click="switchTab('me')"
                        icon="bi-person-circle"
                        :label="$t('menu.me')"/>
            </q-tabs>
        </q-footer>

    </q-layout>
</template>

<script>
import {ref, provide, computed} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n'; // Import i18n

export default {
    name: "MainLayout",
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { t } = useI18n(); // Use t function

        const tab = computed(() => {
            const routeName = route.name;

            if (routeName === 'home' || routeName === 'wallet') {
                return 'home';
            } else if (routeName === 'device') {
                return 'device';
            } else if (routeName === 'me') {
                return 'me';
            }

            return 'home';
        });
        const footerHeight = ref(0);

        function onFooterResize(size) {
            footerHeight.value = size.height
        }

        function switchTab(tabName) {
            router.push({ name: tabName });
        }

        // Provide this height to all child pages
        provide('layoutFooterHeight', footerHeight);

        return {
            tab,
            onFooterResize,
            switchTab,
        }
    }
}
</script>

<style scoped>

</style>