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

import {api} from "boot/axios.js";

class UpdateService {

    /**
     * Check for App updates
     * This simply checks for updates and does not actually implement the App's automatic update logic
     * @param timeout
     * @returns {Promise<{}|*>}
     */
    async check(timeout = 15000) {
        try {
            const response = await api.get('/version', {
                timeout: timeout,
            });

            if (response.status === 200 && response.data.code === 200) {
                return response.data.data;
            }

            return {};

        } catch (e) {
            throw new Error('Check update failed');
        }
    }

}

export default new UpdateService();