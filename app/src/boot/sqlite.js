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
import sqliteService from 'src/services/SQLiteService';

export default boot(async ({ app }) => {
    // Initialize database service
    await sqliteService.init();

    // Mount service to global properties (optional, for use as this.$sqlite in Options API)
    app.config.globalProperties.$sqlite = sqliteService;
});