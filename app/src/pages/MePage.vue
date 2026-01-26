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
        <div class="col-auto bg-grey-3 text-black q-pt-xl q-pb-lg q-px-md shadow-2 relative-position overflow-hidden">
            <div class="text-h5 q-mt-sm text-weight-bold">{{ $t('mePage.title_app') }}</div>
            <div class="text-caption text-grey-8 q-mt-sm">
                {{ $t('mePage.subtitle') }}
            </div>
        </div>
        <q-list class="col scroll q-mt-xs q-px-md bg-grey-2">

            <q-item clickable v-ripple class="q-my-sm q-py-md bg-grey-1 rounded-borders" @click="showNodeSetting">
                <q-item-section avatar>
                    <q-icon name="dns" color="primary" />
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{ $t('mePage.list.node_setting') }}</q-item-label>
                    <q-item-label caption>{{ $t('mePage.list.node_caption') }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                    <q-icon name="chevron_right" />
                </q-item-section>
            </q-item>

            <q-item clickable v-ripple class="q-my-sm q-py-md bg-grey-1 rounded-borders" @click="showLanguageSetting">
                <q-item-section avatar>
                    <q-icon name="translate" color="pink" class="bg-pink-1 q-pa-xs rounded-borders" />
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{ $t('mePage.list.language') }}</q-item-label>
                    <q-item-label caption>{{ currentLangLabel }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                    <q-icon name="chevron_right" color="grey-5"/>
                </q-item-section>
            </q-item>

            <q-item clickable v-ripple class="q-my-sm q-py-md bg-grey-1 rounded-borders" @click="updatePassword">
                <q-item-section avatar>
                    <q-icon name="password" color="orange" class="bg-orange-1 q-pa-xs rounded-borders" />
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{ $t('mePage.list.app_lock') }}</q-item-label>
                    <q-item-label caption>{{ $t('mePage.list.lock_caption') }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                    <q-icon name="chevron_right" color="grey-5"/>
                </q-item-section>
            </q-item>

            <q-separator class="q-my-md" />

            <q-item clickable v-ripple class="q-my-sm q-py-md bg-grey-1 rounded-borders" @click="docs('/docs/security')">
                <q-item-section avatar>
                    <q-icon name="admin_panel_settings" color="blue" class="bg-blue-1 q-pa-xs rounded-borders" />
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{ $t('mePage.list.security_practice') }}</q-item-label>
                    <q-item-label caption>{{ $t('mePage.list.security_caption') }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                    <q-icon name="chevron_right" color="grey-5"/>
                </q-item-section>
            </q-item>
            <q-item clickable v-ripple class="q-my-sm q-py-md bg-grey-1 rounded-borders" @click="openClick('https://www.airlock.pub')">
                <q-item-section avatar>
                    <q-icon name="menu_book" color="purple" class="bg-purple-1 q-pa-xs rounded-borders" />
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{ $t('mePage.list.project_docs') }}</q-item-label>
                    <q-item-label caption>{{ $t('mePage.list.docs_caption') }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                    <q-icon name="bi-link" color="grey-5"/>
                </q-item-section>
            </q-item>

            <q-item clickable v-ripple class="q-my-sm q-py-md bg-grey-1 rounded-borders" @click="openClick('https://github.com/airlock-wallet')">
                <q-item-section avatar>
                    <q-icon name="bi-github" color="black" class="bg-grey-4 q-pa-xs rounded-borders" />
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{ $t('mePage.list.source_code') }}</q-item-label>
                    <q-item-label caption>{{ $t('mePage.list.source_caption') }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                    <q-icon name="bi-link" color="grey-5"/>
                </q-item-section>
            </q-item>

            <q-separator class="q-my-md" />

            <q-item clickable v-ripple class="q-my-sm q-py-md bg-grey-1 rounded-borders" @click="docs('/docs/privacy')">
                <q-item-section avatar>
                    <q-icon name="privacy_tip" color="teal" class="bg-teal-1 q-pa-xs rounded-borders"/>
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{ $t('mePage.list.privacy') }}</q-item-label>
                    <q-item-label caption>{{ $t('mePage.list.privacy_caption') }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                    <q-icon name="chevron_right" color="grey-5"/>
                </q-item-section>
            </q-item>

            <q-item clickable v-ripple class="q-my-sm q-py-md bg-grey-1 rounded-borders" @click="docs('/docs/terms')">
                <q-item-section avatar>
                    <q-icon name="gavel" color="indigo" class="bg-indigo-1 q-pa-xs rounded-borders"/>
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{ $t('mePage.list.terms') }}</q-item-label>
                    <q-item-label caption>{{ $t('mePage.list.terms_caption') }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                    <q-icon name="chevron_right" color="grey-5"/>
                </q-item-section>
            </q-item>

            <q-item clickable v-ripple class="q-my-sm q-py-md bg-grey-1 rounded-borders" @click="checkUpdate">
                <q-item-section avatar>
                    <q-icon name="system_update" color="cyan" class="bg-cyan-1 q-pa-xs rounded-borders"/>
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{ $t('mePage.list.system_update') }}</q-item-label>
                    <q-item-label caption>{{ $t('mePage.list.update_caption', { version: currentVersion }) }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                    <q-icon name="chevron_right" color="grey-5"/>
                </q-item-section>
            </q-item>

            <q-item clickable v-ripple class="q-my-sm q-py-md bg-grey-1 rounded-borders" @click="openClick('https://www.airlock.pub')">
                <q-item-section avatar>
                    <q-icon name="bug_report" color="deep-orange" class="bg-deep-orange-1 q-pa-xs rounded-borders"/>
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{ $t('mePage.list.feedback') }}</q-item-label>
                    <q-item-label caption>{{ $t('mePage.list.feedback_caption') }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                    <q-icon name="bi-link" color="grey-5"/>
                </q-item-section>
            </q-item>

        </q-list>
    </div>
</template>
<script>
import {defineComponent, ref, inject, computed, defineAsyncComponent, onMounted} from 'vue';
import { useQuasar, openURL } from 'quasar';
import UpdateService from "src/services/UpdateService.js";
import {useUserStore} from "stores/userStore.js";
import { useI18n } from 'vue-i18n'; // Import i18n
import { languageList } from 'src/i18n';

export default defineComponent({
    name: 'MePage',
    setup() {
        const $q = useQuasar();
        const { t, locale } = useI18n(); // Use t function
        const userStore = useUserStore();
        const currentVersion = ref('0');
        const footerHeight = inject('layoutFooterHeight', ref(70));
        const pageStyle = computed(() => {
            return {
                height: `calc(100vh - ${footerHeight.value}px)`,
            }
        });

        function docs(url) {
            const lang = locale.value.startsWith('zh') ? 'zh' : 'en';
            $q.dialog({
                component: defineAsyncComponent(() => import('src/dialog/Docs.vue')),
                componentProps: {
                    url: url,
                    lang: lang
                }
            })
        }

        function openClick(url) {
            if (cordova && cordova.InAppBrowser) {
                window.open(url, '_system');
            } else {
                openURL(url)
            }
        }

        async function checkUpdate() {
            // Simple update prompt, auto download can be added if needed
            const data = await UpdateService.check();
            if (currentVersion.value !== data.version) {
                $q.notify({
                    type: 'warning',
                    message: t('mePage.update.new_version'),
                    caption: t('mePage.update.new_version_caption'),
                    timeout: 5000,
                    actions: [
                        {
                            label: t('mePage.update.btn_visit'),
                            color: 'black',
                            handler: () => {
                                if ($q.platform.is.cordova) {
                                    window.open('https://www.airlock.pub', '_system');
                                } else {
                                    openURL('https://www.airlock.pub');
                                }
                            }
                        },
                        { label: t('mePage.update.btn_close'), color: 'grey-9', handler: () => { /* Do nothing, just close */ } }
                    ]
                })
            } else {
                $q.notify({
                    type: 'positive',
                    message: t('mePage.update.latest_title'),
                    caption: t('mePage.update.latest_caption'),
                    timeout: 2000
                })
            }
        }

        function updatePassword() {
            $q.dialog({
                component: defineAsyncComponent(() => import('src/dialog/UpdatePassword.vue')),
            }).onOk((result) => {
                if (result) {
                    $q.notify({
                        type: 'positive',
                        message: t('mePage.msg.pin_updated')
                    });
                    userStore.logout();
                }
            })
        }

        function showNodeSetting() {
            $q.dialog({
                component: defineAsyncComponent(() => import('src/dialog/NodeSetting.vue')),
            })
        }

        const currentLangLabel = computed(() => {
            const current = languageList.find(l => l.code === locale.value);
            return current ? current.label : locale.value;
        });

        function showLanguageSetting() {
            $q.dialog({
                component: defineAsyncComponent(() => import('src/dialog/LanguageSetting.vue')),
            })
        }

        onMounted(async () => {
            if (cordova && cordova.getAppVersion) {
                currentVersion.value = await cordova.getAppVersion.getVersionNumber();
            }
        });

        return {
            pageStyle,
            currentVersion,
            docs,
            openClick,
            checkUpdate,
            updatePassword,
            showNodeSetting,
            currentLangLabel,
            showLanguageSetting,
        }
    }
});
</script>