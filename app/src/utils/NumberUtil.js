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

import Decimal from 'decimal.js';
// ---------------------------------------------
// Global Configuration (Very Important)
// ---------------------------------------------
// Set sufficient precision to accommodate large numbers like ETH/Wei
// Bitcoin only needs 8 digits, but ETH has 18, intermediate calculations may need more
Decimal.set({
    precision: 50,                  // Set calculation precision to 50 digits, sufficient for any cryptocurrency
    rounding: Decimal.ROUND_DOWN,   // Global default round down (prevent over-sending)
    toExpNeg: -30,                  // Avoid converting small numbers to scientific notation (e.g. 1e-7)
    toExpPos: 30                    // Avoid converting large numbers to scientific notation
});

/**
 * Convert scientific notation or numbers to normal string display (remove trailing zeros)
 * @param {string|number|null} value - Input value (e.g. "5.72e-8", 100, "0.100")
 * @param {number} maxDecimals - [Optional] Max decimal places, default 20 (sufficient to cover ETH's 18 decimals and even higher precision)
 * @returns {string} - Formatted string
 */
export function toNormalString(value, maxDecimals = 20) {
    // 1. Null check
    if (value === null || value === undefined || value === '') {
        return '0';
    }

    try {
        // 2. Create Decimal instance (pass in value)
        const val = new Decimal(value);

        // 3. toFixed(n) forces expansion of scientific notation and keeps enough decimal places
        // This generates a string like "0.00000005720544890000"
        const str = val.toFixed(maxDecimals);

        // 4. Regex to remove trailing zeros and potential remaining decimal point
        // - \.?  Matches possible decimal point
        // - 0+   Matches one or more zeros
        // - $    Matches end of string
        return str.replace(/\.?0+$/, "");

    } catch (e) {
        console.error("Format Error:", e);
        return '0'; // Return default value on conversion failure
    }
}

/**
 * Format Balance
 * @param val
 * @param decimals
 * @returns {string}
 */
export const formatFriendly = (val, decimals = 8) => {
    let maxDecimals = Math.min(decimals, 8);

    // 1. Convert to number type
    let num = parseFloat(val);

    // 2. Check if valid number
    if (isNaN(num)) {
        return "0.00";
    }

    return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: maxDecimals,
        useGrouping: true
    });
};

/**
 * [Core Function] Convert UI display amount to on-chain smallest unit (BigInt)
 * * @param {string | number} amountStr - User input amount (e.g. "0.000185")
 * @param {number} decimals - Currency decimals (BTC=8, ETH=18)
 * @returns {string} - Return integer string, safe for BigInt() or TrustWallet
 */
export function toAtomicAmount(amountStr, decimals) {
    try {
        if (!amountStr) return "0";

        // 1. Create Decimal instance
        const d = new Decimal(amountStr);

        // 2. Check for invalid numbers
        if (d.isNaN() || !d.isFinite()) {
            console.warn('[Wallet] Invalid amount input:', amountStr);
            return "0";
        }

        // 3. Calculate: Amount * 10^decimals
        // Use mul (multiply) and pow (power)
        const atomicValue = d.mul(new Decimal(10).pow(decimals));

        // 4. Key: Integer output
        // toFixed(0) means keeping 0 decimal places (becomes integer)
        // Decimal.ROUND_DOWN means direct truncation, no rounding
        return atomicValue.toFixed(0, Decimal.ROUND_DOWN);

    } catch (e) {
        console.error('[Wallet] Amount conversion error:', e);
        return "0";
    }
}

/**
 * [UI Display] Convert on-chain smallest unit to human-readable amount
 * @param {string | number | BigInt} atomicStr - On-chain amount (e.g. 18500)
 * @param {number} decimals - Decimals
 * @returns {string} - e.g. "0.000185"
 */
export function fromAtomicAmount(atomicStr, decimals) {
    if (!atomicStr) return "0";
    try {
        const d = new Decimal(atomicStr.toString());
        // Divide by 10^decimals
        const humanValue = d.div(new Decimal(10).pow(decimals));
        // toFixed() defaults to not keeping invalid zeros, or you can specify decimals
        return humanValue.toFixed();
    } catch (e) {
        return "0";
    }
}