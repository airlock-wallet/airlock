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
import axios from 'axios';
import { useNodeStore } from 'stores/nodeStore';

// Be careful when using SSR for cross-request state pollution
// due to creating a Singleton instance here;
// If any client changes this (global) instance, it might be a
// good idea to move this instance creation inside of the
// "export default () => {}" function below (which runs individually
// for each client)
const api = axios.create({
    timeout: 15000,
});

export default boot(({ app, store }) => {
    // for use inside Vue files (Options API) through this.$axios and this.$api
    const nodeStore = useNodeStore(store)

    // Add request interceptor
    api.interceptors.request.use((config) => {
        // Before each request, read the latest apiUrl from the Store
        // If config.baseURL has already been manually set (e.g., during connection testing), do not overwrite it
        if (!config.baseURL) {
            config.baseURL = nodeStore.apiUrl
        }
        return config
    }, (error) => {
        return Promise.reject(error)
    })

    app.config.globalProperties.$axios = axios;
    // ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
    //       so you won't necessarily have to import axios in each vue file

    app.config.globalProperties.$api = api;
    // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
    //       so you can easily perform requests against your app's API
})

export { api }