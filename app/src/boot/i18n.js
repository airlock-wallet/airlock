/**
 * Copyright (C) 2026 Le Wang
 *
 * This file is part of Airlock.
 *
 * Airlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Airlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Airlock.  If not, see <https://www.gnu.org/licenses/>.
 */

import {boot} from 'quasar/wrappers'
import {createI18n} from 'vue-i18n'
import messages from 'src/i18n'

export default boot(async ({app}) => {
    // Default fallback language
    let locale = 'en-US';

    // =========================================================
    // 1. Highest Priority: User manual setting (LocalStorage)
    // =========================================================
    const savedLocale = localStorage.getItem('user_locale');

    if (savedLocale) {
        locale = savedLocale;
    } else {
        // =========================================================
        // 2. Secondary Priority: Auto-detect System language
        // =========================================================

        // Modern Standard: navigator.language
        // This works perfectly in iOS (WKWebView) and Android (System WebView)
        // It usually returns strings like 'en-US', 'zh-CN', etc.
        const systemLocale = navigator.language || 'en-US';

        console.log('[i18n] System Locale detected:', systemLocale);

        // =========================================================
        // 3. Language Normalization
        // =========================================================

        const lowerLocale = systemLocale.toLowerCase();

        if (lowerLocale.startsWith('zh')) {
            // Treat all Chinese variants (zh-CN, zh-TW, zh-HK, zh-SG) as Simplified Chinese
            locale = 'zh-CN';
        } else {
            // Fallback to English for any other language
            locale = 'en-US';
        }
    }

    console.log('[i18n] Final Active Locale:', locale);

    const i18n = createI18n({
        locale: locale,
        globalInjection: true,
        legacy: false,
        warnHtmlMessage: false,
        messages
    })

    app.use(i18n);
})