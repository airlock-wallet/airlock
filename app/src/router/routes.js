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

const routes = [
    {
        path: '/',
        component: () => import('layouts/MainLayout.vue'),
        meta: {authorization: true},
        children: [
            { path: '', redirect: {name: 'home'} },
            {
                path: 'accounts',
                name: 'home',
                meta: {statusBg: 'primary'},
                component: () => import('pages/AccountPage.vue')
            },
            {
                path: 'device',
                name: 'device',
                meta: {statusBg: 'white'},
                component: () => import('pages/DevicePage.vue')
            },
            {
                path: 'me',
                name: 'me',
                meta: {statusBg: 'white'},
                component: () => import('pages/MePage.vue')
            },
            {
                path: 'wallet/:coin',
                name: 'wallet',
                meta: { statusBg: 'primary', backButton: true },
                component: () => import('pages/WalletListPage.vue')
            },
            {
                path: 'asset/:id',
                name: 'asset-detail',
                meta: { statusBg: 'primary', backButton: true },
                component: () => import('pages/AssetDetailPage.vue')
            },
        ]
    },
    {
        path: '/login',
        component: () => import('layouts/EmptyLayout.vue'),
        meta: {authorization: false},
        children: [
            {
                path: '',
                name: 'login',
                meta: {statusBg: null},
                component: ()=> import('pages/LoginPage.vue')
            }
        ]
    },
    {
        path: '/setup',
        component: () => import('layouts/EmptyLayout.vue'),
        meta: {authorization: false},
        children: [
            {
                path: '',
                name: 'setup',
                meta: {statusBg: null},
                component: ()=> import('pages/SetupPage.vue')
            }
        ]
    },
    {
        path: '/loadWallet',
        component: () => import('layouts/EmptyLayout.vue'),
        meta: {authorization: true},
        children: [
            {
                path: '',
                name: 'loadWallet',
                meta: {statusBg: null},
                component: ()=> import('pages/LoadWalletPage.vue')
            }
        ]
    }
]

export default routes
