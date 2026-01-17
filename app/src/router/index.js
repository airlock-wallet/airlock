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

import { route } from 'quasar/wrappers'
import { createRouter, createMemoryHistory, createWebHistory, createWebHashHistory } from 'vue-router'
import routes from './routes'
import { useUserStore } from "stores/userStore.js";
import { useDeviceStore } from "stores/deviceStore.js";
import { setStatusBar } from "src/utils/SystemUtil.js";

/*
 * Note: We added 'async' before the function
 */
export default route(async function ({ store, ssrContext }) {
    const createHistory = process.env.SERVER
        ? createMemoryHistory
        : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

    const Router = createRouter({
        scrollBehavior: () => ({ left: 0, top: 0 }),
        routes,
        history: createHistory(process.env.VUE_ROUTER_BASE)
    });

    // 1. Get Store instances
    const userStore = useUserStore(store);

    const deviceStore = useDeviceStore(store);

    // ============================================================
    // New Core Logic: Block here until data loading is complete
    // ============================================================

    // A. If in Cordova environment, must wait for deviceready, otherwise NativeStorage might be undefined
    if (process.env.MODE === 'cordova') {
        await new Promise((resolve) => {
            document.addEventListener('deviceready', resolve, false);
        });
    }

    // B. Wait for NativeStorage reading to finish
    // (This calls the loadStoredData method we just wrote in the store)
    await userStore.loadStoredData();

    // Load device cache
    await deviceStore.loadStoredData();

    console.log(`Router initialization check result = ${userStore.hasInitialized}`);

    // ============================================================
    // Route Guard Logic (Keep yours as is, basically fine)
    // ============================================================
    Router.beforeResolve((to, from, next) => {

        // Get authorization config for the current route
        const requiresAuth = to.meta.authorization === true;

        // ---------------------------------------------------------------
        // Rule 1: Global initialization check (Highest priority)
        // ---------------------------------------------------------------
        // At this point userStore.hasInitialized is accurate (because we awaited above)
        if (!userStore.hasInitialized) {
            if (to.path !== '/setup') {
                return next('/setup');
            }
            return next();
        }

        // ---------------------------------------------------------------
        // Rule 2: "Reverse" interception for initialized users (UX optimization)
        // ---------------------------------------------------------------
        if (to.path === '/setup') {
            return next('/login');
        }

        if (userStore.isUnlocked && to.path === '/login') {
            return next('/');
        }

        // ---------------------------------------------------------------
        // Rule 3: Authorization verification (Core logic)
        // ---------------------------------------------------------------
        if (requiresAuth) {
            if (!userStore.isUnlocked) {
                return next('/login');
            }
        }

        // ---------------------------------------------------------------
        // Rule 4: Proceed
        // ---------------------------------------------------------------
        next();
    });

    Router.afterEach((to) => {
        setStatusBar(to?.meta?.statusBg);
    });

    return Router
})