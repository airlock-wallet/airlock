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

import enUS from './en-US';
import zhCN from './zh-CN'


// 1. Export language message bundles (used by Vue I18n)
export const messages = {
  'en-US': enUS,
  'zh-CN': zhCN,
  // Extension: 'ja-JP': jaJP
}

// 2. Export supported language metadata (used by the UI)
// Benefit: the UI can generate the language menu by iterating over this list,
// without requiring any UI code changes when adding new languages
export const languageList = [
  {
    label: 'English',
    code: 'en-US'
  },
  {
    label: '简体中文',
    code: 'zh-CN'
  },
  // Extension: { label: '日本語', code: 'ja-JP' }
]

// Keep default export for backward compatibility
export default messages
