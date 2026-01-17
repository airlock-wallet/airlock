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
 * Unify format timestamp to "milliseconds" (13 digits)
 * @param {number|string} ts Original timestamp
 * @returns {number} 13-digit millisecond timestamp
 */
export function formatToMs(ts) {
    if (!ts) return 0;

    // Ensure it is a number type
    let timestamp = Number(ts);
    if (isNaN(timestamp) || timestamp <= 0) return 0;

    const tsStr = timestamp.toString();

    // Logic determination:
    // 1. 10 digits: Seconds (Unix) -> Multiply by 1000 to get milliseconds
    // 2. 13 digits: Milliseconds -> Return directly
    // 3. 16 digits: Microseconds -> Divide by 1000
    // 4. 19 digits: Nanoseconds -> Divide by 1,000,000

    if (tsStr.length <= 10) {
        // Seconds to milliseconds
        return timestamp * 1000;
    } else if (tsStr.length <= 13) {
        // Already milliseconds
        return timestamp;
    } else {
        // Handle microseconds, nanoseconds, or longer cases
        // The goal is to keep 13 digits, so divide by 10^(current length - 13)
        const divisor = Math.pow(10, tsStr.length - 13);
        return Math.floor(timestamp / divisor);
    }
}