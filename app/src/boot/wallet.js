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

import { boot } from 'quasar/wrappers';
// Use import instead of require
import { initWasm } from '@trustwallet/wallet-core';

// Define a variable for export, initially null
let WalletCore = null;

export default boot(async ({ app }) => {
    try {
        console.log('[WalletCore] Initializing WASM...');

        // 1. Initialize inside boot so Quasar can handle the splash screen/loading state
        // initWasm() returns the core instance
        WalletCore = await initWasm();

        // 2. Mount to global properties
        app.config.globalProperties.$WalletCore = WalletCore;
    } catch (e) {
        // 4. Error handling: Prevent the entire App from crashing (white screen) if WASM fails to load
        console.error('[WalletCore] Init Failed:', e);
    }
});

// Export the instance for use in non-Vue files (e.g., .js Service files)
// Note: If this object is imported before boot completes, it may be null. Check for null before use.
export { WalletCore };