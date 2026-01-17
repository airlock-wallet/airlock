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

import sqliteService from 'src/services/SQLiteService';
import { useUserStore } from 'src/stores/userStore';
import { useChainStore } from "stores/chainStore.js";
import { usePriceStore } from "stores/PriceStore.js";
import WalletCoreService from "src/services/WalletCoreService.js";
import { formatToMs } from "src/utils/TimeUtil.js";
import { bus } from "boot/bus.js";
import { MAIN_COIN_NAME_MAP, TOKEN_COIN_NAME_MAP, ACCOUNT_ICON_MAP } from "src/utils/ChainUtil.js";

/**
 * Get account information based on coin identifier and current wallet mode
 * @param {String} coin - Unique identifier of the coin (e.g., 'bitcoin', 'ethereum', 'tron')
 * @returns {Promise<Object|null>} Account object or null
 */
export async function getAccount(coin) {
    const userStore = useUserStore();
    const currentMode = userStore.walletMode;

    // 1. Safety check: Return directly if no wallet mode (not logged in)
    if (!currentMode) return null;

    try {
        // 2. Execute query: Find in accounts table
        // Note: Add LIMIT 1 for efficiency
        const res = await sqliteService.executeSql(
            'SELECT * FROM accounts WHERE coin = ? AND wallet_mode = ? LIMIT 1',
            [coin, currentMode]
        );

        // 3. Parse result
        // Results returned by Cordova SQLite plugin are in rows, use item(index) to retrieve
        if (res && res.rows && res.rows.length > 0) {
            return res.rows.item(0);
        }

        return null;
    } catch (e) {
        console.error(`[getAccount] Error fetching account for ${coin}:`, e);
        return null;
    }
}

/**
 * Get paginated asset list under the specified account
 * @param {Object} account - Account object (must include id)
 * @param {Number} page - Current page number (starting from 1)
 * @param {Number} size - Quantity per page
 * @param {Object} filters - Filter conditions { name: 'all'|'ethereum', minBalance: int, keyword: string }
 * @returns {Promise<Array>} Asset list array
 */
export async function getAssets(account, page = 1, size = 20, filters = {}) {
    // Validate account object validity
    if (!account || !account.id) {
        console.warn('[getAssets] Invalid account object provided');
        return [];
    }

    try {
        // Calculate pagination offset
        const offset = (page - 1) * size;
        const params = [account.id];

        // Dynamically build SQL query
        let sql = `SELECT * FROM assets WHERE account_id = ?`;

        // Chain filter
        if (filters.name && filters.name !== 'all') {
            sql += ` AND symbol = ?`;
            params.push(filters.name);
        }

        // Balance filter
        // Logic improvement: Support custom minimum amount (minBalance)
        // Trick: Adding balance != '0' hits Partial Index (idx_assets_balance_nonzero)
        // avoiding full table scan for better performance
        if (filters.minBalance > 0) {
            sql += ` AND balance != '0' AND CAST(balance AS REAL) > ?`;
            params.push(filters.minBalance);
        }

        // Address/Contract keyword filter
        if (filters.keyword) {
            // Support searching address, token name, or symbol
            sql += ` AND (address LIKE ? OR symbol LIKE ? OR name LIKE ?)`;
            const kw = `%${filters.keyword}%`;
            params.push(kw, kw, kw);
        }

        // 3. Sorting and pagination
        // Sort by ID to ensure pagination stability
        sql += ` ORDER BY id ASC LIMIT ? OFFSET ?`;
        params.push(size, offset);

        console.log(`[getAssets] Query sql = ${sql}`);

        // Execute query
        const res = await sqliteService.executeSql(sql, params);

        // Parse results
        const list = [];
        if (res && res.rows && res.rows.length > 0) {
            for (let i = 0; i < res.rows.length; i++) {
                list.push(res.rows.item(i));
            }
        }
        return list;

    } catch (e) {
        console.error(`[getAssets] Error fetching assets for account ${account.id}:`, e);
        return [];
    }
}

/**
 * Get account list only (Used for UI list display)
 * Only queries the accounts table
 */
export async function getAccountList() {
    const userStore = useUserStore();
    const currentMode = userStore.walletMode;
    const list = [];

    if (!currentMode) return list;

    try {
        const res = await sqliteService.executeSql(
            'SELECT * FROM accounts WHERE wallet_mode = ?',
            [currentMode]
        );

        if (res && res.rows && res.rows.length > 0) {
            for (let i = 0; i < res.rows.length; i++) {
                list.push(res.rows.item(i));
            }
        }

        return list;
    } catch (e) {
        console.error('[DbService] Get Accounts Error:', e);
        return [];
    }
}

/**
 * Get balances of all assets under current mode (Used for calculating total asset valuation)
 * Joint query: Assets + Accounts (To filter wallet_mode)
 * Returns: [{ symbol: 'BTC', balance: '0.5', coin: 'bitcoin' }, ...]
 */
export async function getAllAssetsForValuation() {
    const userStore = useUserStore();
    const currentMode = userStore.walletMode;
    const assetsList = [];

    if (!currentMode) return assetsList;

    try {
        const sql = `
            SELECT a.id, a.symbol, a.balance, a.coin, a.decimals, a.contract
            FROM assets a 
            JOIN accounts ac ON a.account_id = ac.id 
            WHERE ac.wallet_mode = ?
        `;

        const res = await sqliteService.executeSql(sql, [currentMode]);

        if (res && res.rows && res.rows.length > 0) {
            for (let i = 0; i < res.rows.length; i++) {
                assetsList.push(res.rows.item(i));
            }
        }

        return assetsList;
    } catch (e) {
        console.error('[DbService] GetAllAssetsForValuation Stats Error:', e);
        return [];
    }
}

/**
 * Get total price of current assets by accountId
 * @param accountId
 * @returns {Promise<number>}
 */
export async function getAllAssetsForAccountId(accountId) {
    const priceStore = usePriceStore();
    let total = 0;

    try {
        // Optimization: AND balance != '0' to reduce JS processing
        const res = await sqliteService.executeSql(
            `SELECT symbol, balance FROM assets WHERE account_id = ? AND balance != '0'`,
            [accountId]
        );

        if (res && res.rows && res.rows.length > 0) {
            for (let i = 0; i < res.rows.length; i++) {
                const item = res.rows.item(i);
                const price = priceStore.getPrice(item.symbol);
                const balance = parseFloat(item.balance || 0);
                if (!isNaN(balance) && price > 0) {
                    total += balance * price;
                }
            }
        }
    } catch (e) {
        console.error('Calc total failed:', e);
    }
    return total;
}

/**
 * Save account and initialize assets (Used for Setup or restoring wallet)
 * @param {Object} accountData { xpub, address, name, path, icon, walletMode }
 * @param {Array} assetsList [{ coin, symbol, contract, decimals, balance, icon }, ...]
 */
export async function saveAccountWithAssets(accountData, assetsList) {
    try {
        let accountId;

        // 1. Attempt to insert account
        const insertRes = await sqliteService.executeSql(
            `INSERT OR IGNORE INTO accounts (coin, symbol, name, blockchain, xpub, path, curve, icon, wallet_mode) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                accountData.coin,
                accountData.symbol,
                accountData.name,
                accountData.blockchain,
                accountData.xpub,
                accountData.path,
                accountData.curve,
                accountData.icon,
                accountData.walletMode
            ]
        );

        // 2. Get Account ID
        if (insertRes.insertId) {
            // A. Insert successful, use new ID
            accountId = insertRes.insertId;
        } else {
            // B. Insert ignored (duplicate), query existing ID
            const res = await sqliteService.executeSql(
                'SELECT id FROM accounts WHERE xpub = ? AND path = ?',
                [accountData.xpub, accountData.path]
            );

            if (res && res.rows && res.rows.length === 0) {
                throw new Error(`Account ID recovery failed for ${accountData.coin} (${accountData.walletMode})`);
            }
            accountId = res.rows.item(0).id;
        }

        console.log(`[DbService] Account processed. ID: ${accountId}, Mode: ${insertRes.insertId ? 'Inserted' : 'Found Existing'}`);

        // Parse derivation index from path
        let derivedIndex = 0;
        try {
            const parts = accountData.path.split('/');
            const lastPart = parts[parts.length - 1];
            const parsed = parseInt(lastPart.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(parsed)) {
                derivedIndex = parsed;
            }
        } catch (e) {
            console.warn('Path parsing error:', e);
        }

        // 3. Insert assets (Batch insert for performance)
        const batchQueries = assetsList.map(asset => {
            const finalAddress = asset.address || '';
            const finalPath = asset.path || accountData.path || '';
            const finalContract = asset.contract || '';

            if (!finalAddress || !finalPath) {
                console.warn(`[DbService] Skipping asset ${asset.symbol}: Address or Path is null.`);
                return null;
            }

            return {
                sql: `
                    INSERT INTO assets (
                        account_id, coin, symbol, name, blockchain, contract, decimals, curve, balance, icon, address, derivation_path, derivation_index
                    )
                    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                    WHERE NOT EXISTS (
                        SELECT 1 FROM assets 
                        WHERE account_id = ? AND coin = ? AND contract = ? AND address = ?
                    )
                `,
                params: [
                    accountId,
                    asset.coin,
                    asset.symbol,
                    asset.name,
                    asset.blockchain,
                    finalContract,
                    asset.decimals,
                    accountData.curve,
                    asset.balance || '0',
                    asset.icon || (asset.symbol.toLowerCase().replace('-') + '.svg'),
                    finalAddress,
                    finalPath,
                    derivedIndex,
                    // WHERE NOT EXISTS params
                    accountId,
                    asset.coin,
                    finalContract,
                    finalAddress
                ]
            };
        }).filter(q => q !== null);

        if (batchQueries.length > 0) {
            await sqliteService.executeBatch(batchQueries);
            console.log(`[DbService] Saved ${batchQueries.length} assets for Account ${accountId}`);
        }

        // 4. Retrieve saved assets to update UI/Stores
        const params = [accountId];
        const orConditions = assetsList.map(asset => {
            const c = asset.contract || '';
            params.push(asset.coin, asset.address, c);
            return `(coin = ? AND address = ? AND contract = ?)`;
        });

        const savedAssets = [];
        if (orConditions.length > 0) {
            const sql = `SELECT * FROM assets WHERE account_id = ? AND (${orConditions.join(' OR ')})`;
            const res = await sqliteService.executeSql(sql, params);
            if (res && res.rows && res.rows.length > 0) {
                for (let i = 0; i < res.rows.length; i++) {
                    savedAssets.push(res.rows.item(i));
                }
            }
        }

        console.log(`[DbService] Retrieved ${savedAssets.length} precise assets for Account ${accountId}`);
        bus.emit('balance:query', savedAssets);

    } catch (e) {
        console.error('[DbService] Save Error:', e);
        throw e;
    }
}

/**
 * Clear all data (Used for wallet reset)
 */
export async function clearAllData() {
    try {
        await sqliteService.executeSql('DELETE FROM transactions');
        await sqliteService.executeSql('DELETE FROM assets');
        await sqliteService.executeSql('DELETE FROM accounts');
        console.log('[DbService] All data cleared.');
    } catch (e) {
        console.error('[DbService] Clear data failed:', e);
        throw e;
    }
}

/**
 * Quickly check if accounts exist in database
 * @returns {Promise<boolean>}
 */
export async function hasAccounts() {
    try {
        const res = await sqliteService.executeSql('SELECT count(*) as count FROM accounts');
        return res.rows.item(0).count > 0;
    } catch (e) {
        console.error('[DbService] Check accounts failed:', e);
        return false;
    }
}

/**
 * Save accounts wrapper
 * @param accounts
 * @param loadToken
 * @returns {Promise<void>}
 */
export async function saveAccounts(accounts, loadToken = false) {
    const chainStore = useChainStore();

    for (const account of accounts) {
        if (!account.coin && !account.symbol) continue;

        const config = chainStore.getCoin(account.coin);
        if (!config) {
            console.warn(`Cannot find ${account.coin} in validCoins, might be unsupported coin!`);
            continue;
        }
        const realDecimals = config.decimals ?? account.decimals;
        const mainPath = account.path || '';
        const mainAddress = account.address || '';
        const accountIcon = ACCOUNT_ICON_MAP[account.coin] || (account.symbol.toLowerCase() + '.svg')

        // 1. Prepare asset list
        const assetsToSave = [{
            coin: account.coin,
            symbol: config.symbol || account.symbol,
            name: MAIN_COIN_NAME_MAP[config.name] || config.name,
            contract: '',
            decimals: realDecimals,
            blockchain: account.blockchain,
            curve: account.curve,
            balance: '0',
            icon: `/coins/${accountIcon}`,
            address: mainAddress,
            path: mainPath
        }];

        // 2. Preload tokens
        if (loadToken) {
            const defaultTokens = chainStore.getValidTokens(config.id);
            for (const token of defaultTokens) {
                assetsToSave.push({
                    coin: account.coin,
                    symbol: token.symbol || account.symbol,
                    name: TOKEN_COIN_NAME_MAP[token.name] || token.name,
                    contract: token.contract || '',
                    decimals: token.decimals,
                    blockchain: account.blockchain,
                    curve: account.curve,
                    balance: '0',
                    icon: `/coins/${token.icon}`,
                    address: mainAddress,
                    path: mainPath
                });
            }
        }

        // 3. Construct account data
        const accountData = {
            coin: account.coin,
            symbol: account.symbol,
            name: account.name,
            blockchain: account.blockchain,
            curve: account.curve,
            xpub: account.xpub || '',
            path: account.path,
            icon: `/coins/${accountIcon}`,
            walletMode: (account.is_main === 1 || account.wallet_mode === 'HIDDEN') ? 'HIDDEN' : 'STANDARD',
        };

        // 4. Save
        await saveAccountWithAssets(accountData, assetsToSave);
    }
}

/**
 * Get next available derivation index for specified account
 * @param {Object} account - Account object
 * @returns {Promise<Number>} Next index
 */
export async function getNextDerivationIndex(account) {
    if (!account || !account.id) return 0;

    try {
        const res = await sqliteService.executeSql(
            `SELECT MAX(derivation_index) as maxIndex FROM assets WHERE account_id = ?`,
            [account.id]
        );

        if (res && res.rows && res.rows.length > 0) {
            const max = res.rows.item(0).maxIndex;
            return (max === null || max === undefined) ? 0 : max + 1;
        }
        return 0;
    } catch (e) {
        console.error('Get index failed:', e);
        return 0;
    }
}

/**
 * Add new wallet via Xpub (Account +1)
 * @param {Object} coinObj - Coin identifier
 * @param loadToken - Whether to load tokens
 */
export async function deriveNewWalletWithSecp256k1(coinObj, loadToken = false) {
    if (coinObj.curve !== 'secp256k1') {
        return [];
    }

    // 1. Get current account info
    const account = await getAccount(coinObj.id);
    if (!account) throw new Error('Account not found');

    const chainStore = useChainStore();
    const config = chainStore.getCoin(account.coin);
    if (!config) {
        console.warn(`Cannot find ${account.coin} in validCoins!`);
        return [];
    }

    // 2. Get next index
    const nextIndex = await getNextDerivationIndex(account);

    // 3. Calculate new path
    let newPath = account.path;
    if (account.path) {
        const parts = account.path.split('/');
        if (parts.length > 0) {
            parts[parts.length - 1] = nextIndex.toString();
        }
        newPath = parts.join('/');
    } else {
        throw new Error('Account path is invalid');
    }

    console.log(`[Derive] New Path: ${newPath}`);

    // 4. Derive address via WalletCore
    const derivedInfo = await WalletCoreService.deriveAddressFromXpub(
        account.xpub,
        coinObj.coinId,
        newPath
    );

    const realDecimals = config.decimals ?? account.decimals;
    const accountIcon = ACCOUNT_ICON_MAP[account.coin] || (account.symbol.toLowerCase() + '.svg')

    // 4.1 Prepare new assets
    const newAssets = [{
        coin: account.coin,
        symbol: account.symbol,
        name: MAIN_COIN_NAME_MAP[account.name] || account.name,
        contract: '',
        decimals: realDecimals,
        balance: '0',
        icon: `/coins/${accountIcon}`,
        address: derivedInfo.address,
        blockchain: account.blockchain,
        curve: account.curve,
        derivationPath: derivedInfo.path,
        derivedIndex: nextIndex
    }];

    // 4.2 Tokens
    if (loadToken) {
        const defaultTokens = chainStore.getValidTokens(account.coin);
        for (const token of defaultTokens) {
            newAssets.push({
                coin: account.coin,
                symbol: token.symbol,
                name: TOKEN_COIN_NAME_MAP[token.name] || token.name,
                contract: token.contract || '',
                decimals: token.decimals || config.decimals,
                balance: '0',
                icon: `/coins/${token.icon}`,
                address: derivedInfo.address,
                blockchain: account.blockchain,
                curve: account.curve,
                derivationPath: derivedInfo.path,
                derivedIndex: nextIndex
            });
        }
    }

    // 5. Save to Assets table only
    await saveAssetsForAccount(account.id, newAssets);

    try {
        const res = await sqliteService.executeSql(
            `SELECT * FROM assets WHERE account_id = ? AND address = ? ORDER BY id ASC`,
            [account.id, derivedInfo.address]
        );

        const savedAssets = [];
        if (res && res.rows && res.rows.length > 0) {
            for (let i = 0; i < res.rows.length; i++) {
                savedAssets.push(res.rows.item(i));
            }
        }

        console.log(`[Derive] Returned ${savedAssets.length} new assets to UI.`);
        return savedAssets;

    } catch (e) {
        console.error('[Derive] Failed to fetch new assets:', e);
        return [];
    }
}

/**
 * Create new wallet address from Raspberry Pi via Bluetooth
 */
export async function createNewWalletWithEd25519(account, assets, loadToken = false) {
    const newAssets = [];
    if (!account || !assets || assets.length === 0) return newAssets;

    for (const asset of assets) {
        const accountIcon = ACCOUNT_ICON_MAP[account.coin] || (account.symbol.toLowerCase() + '.svg')
        newAssets.push({
            coin: account.coin,
            symbol: asset.symbol,
            name: MAIN_COIN_NAME_MAP[asset.name] || asset.name,
            contract: asset.contract || '',
            decimals: asset.decimals || account.decimals,
            balance: '0',
            icon: `/coins/${accountIcon}`,
            address: asset.address,
            blockchain: asset.blockchain,
            curve: asset.curve,
            derivationPath: asset.path,
            derivedIndex: asset.address_index
        });

        if (loadToken) {
            const chainStore = useChainStore();
            const defaultTokens = chainStore.getValidTokens(account.coin);
            for (const token of defaultTokens) {
                newAssets.push({
                    coin: account.coin,
                    symbol: token.symbol,
                    name: TOKEN_COIN_NAME_MAP[token.name] || token.name,
                    contract: token.contract || '',
                    decimals: token.decimals || account.decimals,
                    balance: '0',
                    icon: `/coins/${token.icon}`,
                    address: asset.address,
                    blockchain: account.blockchain,
                    curve: account.curve,
                    derivationPath: asset.path,
                    derivedIndex: asset.address_index
                });
            }
        }
    }

    await saveAssetsForAccount(account.id, newAssets);

    // Retrieve and return
    const addresses = assets.map(a => a.address);
    try {
        if (!addresses || addresses.length === 0) return [];

        const placeholders = addresses.map(() => '?').join(',');
        const sql = `SELECT * FROM assets WHERE account_id = ? AND address IN (${placeholders}) ORDER BY id ASC`;
        const params = [account.id, ...addresses];
        const res = await sqliteService.executeSql(sql, params);

        const resultList = [];
        if (res && res.rows && res.rows.length > 0) {
            for (let i = 0; i < res.rows.length; i++) {
                resultList.push(res.rows.item(i));
            }
        }
        return resultList;
    } catch (e) {
        console.error('[Derive] Failed to fetch new assets:', e);
        return [];
    }
}

/**
 * Save assets to specified Account ID only
 * Wrapper for batch insertion
 */
async function saveAssetsForAccount(accountId, assetsList) {
    try {
        const batchQueries = assetsList.map(asset => ({
            sql: `INSERT INTO assets (account_id, coin, symbol, name, blockchain, contract, decimals, curve, balance, icon, address, derivation_path, derivation_index) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params: [
                accountId,
                asset.coin,
                asset.symbol,
                asset.name,
                asset.blockchain,
                asset.contract,
                asset.decimals,
                asset.curve,
                '0',
                asset.icon,
                asset.address,
                asset.derivationPath,
                asset.derivedIndex
            ]
        }));

        // Use batch execution to ensure transaction safety on iOS
        await sqliteService.executeBatch(batchQueries);

        // Verification query
        const params = [accountId];
        const orConditions = assetsList.map(asset => {
            const c = asset.contract || '';
            params.push(asset.coin, asset.address, c);
            return `(coin = ? AND address = ? AND contract = ?)`;
        });

        const savedAssets = [];
        if (orConditions.length > 0) {
            const sql = `SELECT * FROM assets WHERE account_id = ? AND (${orConditions.join(' OR ')})`;
            const res = await sqliteService.executeSql(sql, params);
            if (res && res.rows && res.rows.length > 0) {
                for (let i = 0; i < res.rows.length; i++) {
                    savedAssets.push(res.rows.item(i));
                }
            }
        }

        console.log(`[DbService] Retrieved ${savedAssets.length} precise assets for Account ${accountId}`);
        bus.emit('balance:query', savedAssets);

    } catch (e) {
        console.error('[DbService] saveAssetsForAccount Error:', e);
        throw e;
    }
}

/**
 * Add new token
 */
export async function createNewToken(asset, token) {
    const newAssets = [];
    const chainStore = useChainStore();
    const supportTokens = chainStore.getValidTokens(asset.coin);
    if (supportTokens.length === 0) return [];

    // Check duplicates
    const res = await sqliteService.executeSql(
        'SELECT 1 FROM assets WHERE address = ? AND contract = ? LIMIT 1',
        [asset.address, token.contract]
    );
    const exists = res.rows ? res.rows.length > 0 : res.length > 0;
    if (exists) return [];

    const config = chainStore.getCoin(asset.coin);
    if (!config) return [];

    newAssets.push({
        coin: asset.coin,
        symbol: token.symbol,
        name: TOKEN_COIN_NAME_MAP[token.name] || token.name,
        contract: token.contract || '',
        decimals: token.decimals || config.decimals,
        balance: '0',
        icon: `/coins/${token.icon}`,
        address: asset.address,
        blockchain: asset.blockchain,
        curve: asset.curve,
        derivationPath: asset.derivation_path,
        derivedIndex: asset.derivation_index
    });

    await saveAssetsForAccount(asset.account_id, newAssets);

    // Return new asset
    try {
        const sql = `SELECT * FROM assets WHERE account_id =? AND address = ? AND contract = ?`;
        const params = [asset.account_id, asset.address, token.contract];
        const resQuery = await sqliteService.executeSql(sql, params);
        const resultList = [];
        if (resQuery && resQuery.rows && resQuery.rows.length > 0) {
            for (let i = 0; i < resQuery.rows.length; i++) {
                resultList.push(resQuery.rows.item(i));
            }
        }
        return resultList;
    } catch (e) {
        return [];
    }
}

/**
 * Get single asset detail by ID
 */
export async function getAssetById(id) {
    try {
        const res = await sqliteService.executeSql(
            'SELECT * FROM assets WHERE id = ? LIMIT 1',
            [id]
        );
        if (res && res.rows && res.rows.length > 0) {
            return res.rows.item(0);
        }
        return null;
    } catch (e) {
        console.error(`[getAssetById] Error:`, e);
        return null;
    }
}

/**
 * Query all tokens
 */
export async function getAllTokensForAccountId(accountId) {
    const tokens = [];
    try {
        const res = await sqliteService.executeSql(
            'SELECT * FROM assets WHERE account_id = ? AND contract IS NOT NULL AND contract != ""',
            [accountId]
        );

        if (res && res.rows && res.rows.length > 0) {
            for (let i = 0; i < res.rows.length; i++) {
                tokens.push(res.rows.item(i));
            }
        }
        return tokens;
    } catch (e) {
        console.error('Database error:', e);
        return [];
    }
}

/**
 * Get individual asset detail with max DerivationIndex by coin
 */
export async function getAssetsByCoinWithMaxDerivationIndex(accountId, coin) {
    try {
        const res = await sqliteService.executeSql(
            'SELECT * FROM assets WHERE account_id = ? AND coin = ? ORDER BY derivation_index DESC LIMIT 1',
            [accountId, coin]
        );
        if (res && res.rows && res.rows.length > 0) {
            return res.rows.item(0);
        }
        return null;
    } catch (e) {
        console.error(`[getAssetById] Error:`, e);
        return null;
    }
}

/**
 * Update balance to database
 */
export async function updateBalance(asset) {
    try {
        await sqliteService.executeSql("UPDATE assets SET balance = ? WHERE id = ?", [asset.balance, asset.id]);
    } catch (e) {
        console.error(`[DbService] Update balance failed: ${e}`);
    }
}

/**
 * Update historical transaction records and save to SQLite
 * Replaced manual `BEGIN TRANSACTION` via `executeSql` with `executeBatch`.
 * The iOS SQLite plugin does not allow starting a transaction if the internal connection
 * is already in a transaction state (Nested Transactions are not supported).
 * `executeBatch` handles the transaction internally and safely.
 * @param {Object} asset - Includes account_id, address, coin_id, contract etc.
 * @param {Array} datas - Transaction raw data array
 */
export async function updateTransactionHistory(asset, datas) {
    if (!datas || datas.length === 0) return 0;

    try {
        // Prepare the SQL statement for UPSERT (Insert or Update)
        const sql = `
            INSERT INTO transactions (
                txid, asset_id, from_addr, to_addr, amount, timestamp, type, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(asset_id, txid) DO UPDATE SET
                timestamp = excluded.timestamp,
                amount = excluded.amount,
                from_addr = excluded.from_addr,
                to_addr = excluded.to_addr,
                type = excluded.type,
                status = excluded.status
            WHERE
                transactions.timestamp != excluded.timestamp OR
                transactions.amount != excluded.amount OR
                transactions.status != excluded.status OR
                transactions.type != excluded.type
        `;

        // Map data to batch parameters
        const batchQueries = [];

        for (const tx of datas) {
            // Exclude invalid data
            if (parseFloat(tx.value) === 0) continue;

            const myAddr = asset.address.toLowerCase();
            const txTo = (tx.to || "").toLowerCase();

            // Determine transaction type
            const type = (txTo === myAddr) ? 'receive' : 'send';
            const txFrom = (txTo === myAddr) ? tx.from : asset.address;

            // Format new data
            const newTimestamp = formatToMs(tx.timestamp);
            const newAmount = tx.value.toString();
            const newStatus = 'confirmed';

            const params = [
                tx.txid,
                asset.id,
                txFrom,
                tx.to,
                newAmount,
                newTimestamp,
                type,
                newStatus
            ];

            // Push to batch array
            batchQueries.push({ sql, params });
        }

        if (batchQueries.length > 0) {
            // Execute all updates in a single atomic batch transaction
            // This prevents "cannot start a transaction within a transaction" error on iOS
            await sqliteService.executeBatch(batchQueries);

            console.log(`[DB] ${asset.coin} synced: ${batchQueries.length} transactions processed.`);

            // Note: executeBatch typically returns result of the last query or generic success.
            // Precise 'rowsAffected' for the whole batch is hard to get without a specific API.
            // We return the count of processed items as an approximation of success.
            return batchQueries.length;
        }

        return 0;

    } catch (error) {
        console.error("[DB] Update transaction history failed:", error);
        throw error;
    }
}

/**
 * Get transaction history by asset
 */
export async function getTransactionsByAsset(asset, page, size) {
    if (!asset || !asset.id) {
        console.warn('[getTransactionsByAsset] Invalid asset object provided');
        return [];
    }

    try {
        const offset = (page - 1) * size;
        const params = [asset.id];
        let sql = `SELECT * FROM transactions WHERE asset_id = ?`;

        sql += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
        params.push(size, offset);

        const res = await sqliteService.executeSql(sql, params);

        const list = [];
        if (res && res.rows && res.rows.length > 0) {
            for (let i = 0; i < res.rows.length; i++) {
                list.push(res.rows.item(i));
            }
        }
        return list;

    } catch (e) {
        console.error(`[getTransactionsByAsset] Error:`, e);
        return [];
    }
}

/**
 * Get main chain asset corresponding to current token
 */
export async function getContractWithMainAsset(contractAsset) {
    try {
        const sql = `
            SELECT * FROM assets 
            WHERE account_id = ? 
              AND coin = ? 
              AND address = ?
              AND (contract IS NULL OR contract = '')
            LIMIT 1
        `;

        const params = [
            contractAsset.account_id,
            contractAsset.coin,
            contractAsset.address
        ];

        const res = await sqliteService.executeSql(sql, params);
        if (res && res.rows && res.rows.length > 0) {
            return res.rows.item(0);
        }
        return null;
    } catch (e) {
        console.error(`[getContractWithMainAsset] Error:`, e);
        return null;
    }
}