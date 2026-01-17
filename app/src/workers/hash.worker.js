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


// Recommend using * as import for best compatibility
import * as CryptoJS from 'crypto-js';

// --- Helper Functions ---
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// --- Listen for Messages ---
self.onmessage = async (e) => {
    const { pin, saltHex } = e.data;

    try {
        let resultHash = '';

        // A. Attempt Native Web Crypto (if environment supports it)
        if (self.crypto && self.crypto.subtle) {
            try {
                const enc = new TextEncoder();
                const keyMaterial = await self.crypto.subtle.importKey(
                    "raw",
                    enc.encode(pin),
                    { name: "PBKDF2" },
                    false,
                    ["deriveBits", "deriveKey"]
                );

                const salt = hexToBytes(saltHex);
                const derivedBits = await self.crypto.subtle.deriveBits(
                    {
                        name: "PBKDF2",
                        salt: salt,
                        iterations: 100000,
                        hash: "SHA-256"
                    },
                    keyMaterial,
                    256
                );

                resultHash = bufferToHex(derivedBits);
            } catch (err) {
                // Ignore native error, fallback to JS
            }
        }

        // B. Fallback: Use CryptoJS
        if (!resultHash) {
            const saltWord = CryptoJS.enc.Hex.parse(saltHex);

            // PBKDF2 here indeed requires 3 parameters: password, salt, configuration object
            const derivedKey = CryptoJS.PBKDF2(pin, saltWord, {
                keySize: 256 / 32,
                iterations: 100000,
                hasher: CryptoJS.algo.SHA256
            });

            resultHash = CryptoJS.enc.Hex.stringify(derivedKey);
        }

        // Worker's postMessage only takes 1 parameter (message)
        self.postMessage({ success: true, hash: resultHash });

    } catch (error) {
        self.postMessage({ success: false, error: error.toString() });
    }
}