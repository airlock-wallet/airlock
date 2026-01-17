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

// ==========================================
// Helper function: Wrap NativeStorage as Promise
// ==========================================
export const NativeStorageService = {
    getItem: (key) => new Promise((resolve) => {
        if (typeof window.NativeStorage === 'undefined') {
            console.warn('NativeStorage not found, fallback to null');
            resolve(null);
            return;
        }
        window.NativeStorage.getItem(
            key,
            (data) => resolve(data),
            (error) => {
                // code 2 usually means key does not exist (first install), should not error
                if (error.code !== 2) console.log('NativeStorage load info:', error);
                resolve(null);
            }
        );
    }),
    setItem: (key, data) => new Promise((resolve, reject) => {
        if (typeof window.NativeStorage === 'undefined') return resolve();
        window.NativeStorage.setItem(key, data, resolve, reject);
    }),
    remove: (key) => new Promise((resolve, reject) => {
        if (typeof window.NativeStorage === 'undefined') return resolve();
        window.NativeStorage.remove(key, resolve, reject);
    })
};