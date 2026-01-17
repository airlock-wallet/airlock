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

/**
 * src/utils/security.js
 * Security Utilities (Web Worker Version - Vite Specific Syntax)
 */
import CryptoJS from 'crypto-js';
// Import using Vite's Worker suffix to allow automatic bundling by the build tool
import HashWorker from 'src/workers/hash.worker.js?worker';

function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Generate random salt
 */
export function generateSalt() {
    if (window.crypto && window.crypto.getRandomValues) {
        const array = new Uint8Array(16);
        window.crypto.getRandomValues(array);
        return bufferToHex(array.buffer);
    } else {
        const randomWord = CryptoJS.lib.WordArray.random(16);
        return CryptoJS.enc.Hex.stringify(randomWord);
    }
}

/**
 * Calculate PBKDF2 Hash (Async Worker Version)
 */
export function hashPin(pin, saltHex) {
    return new Promise((resolve, reject) => {
        // [Critical Modification] Instantiate the imported Worker class directly
        const worker = new HashWorker();

        worker.onmessage = (event) => {
            const { success, hash, error } = event.data;
            worker.terminate(); // Terminate immediately after use

            if (success) {
                resolve(hash);
            } else {
                reject(new Error(error || 'Worker computation failed'));
            }
        };

        worker.onerror = (e) => {
            console.error('[Worker Error]', e);
            worker.terminate();
            reject(new Error('Worker script failed to load or execute.'));
        };

        // Send task
        worker.postMessage({ pin, saltHex });
    });
}