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

import { api } from 'src/boot/axios';
import {updateBalance, updateTransactionHistory} from "src/services/DbService.js";

class ChainService {

    /**
     * [Universal] Get balance (Main unit string)
     * Supports: BTC, ETH, TRX, MONA...
     * @param asset
     * @param timeout
     * @returns {Promise<Object>}
     */
    async getBalance(asset, timeout = 15000) {
        try {
            let contract = "";
            if (asset.contract) {
                contract = "?contract=" + asset.contract;
            }

            const response = await api.get(`/balance/${asset.coin}/${asset.address}${contract}`, {
                timeout: timeout,
            });

            if (response.status === 200) {
                const { address, balance } = response.data;
                // Only update if it's a valid balance returned
                if (address === asset.address && !balance.startsWith('-')) {
                    // 1. Assign first
                    asset.balance = balance;

                    // 2. Critical modification: use await to wait for database update completion
                    // If updateBalance throws an error internally, it will be caught by the outer catch block
                    await updateBalance(asset);

                    // 3. Only return balance if both steps above succeed
                    return response.data;
                }
            }

            return {balance: asset.balance};
        } catch (e) {
            const msg = e.response?.data?.detail || e.message;
            throw new Error(`[getBalance] Error: ${msg}`)
        }
    }

    /**
     * Query other account balance
     * @param coin
     * @param address
     * @param timeout
     * @returns {Promise<any>}
     */
    async getBalanceFormCoinAndAddress(coin, address, timeout = 15000) {
        try {
            const response = await api.get(`/balance/${coin}/${address}`, {
                timeout: timeout,
            });

            if (response.status === 200) {
                return response.data;
            }
        } catch (e) {
            const msg = e.response?.data?.detail || e.message;
            throw new Error(`[getBalanceFormCoinAndAddress] Error: ${msg}`)
        }
    }

    /**
     * [Tron] Get account resources
     * @param coin
     * @param address
     * @param contract
     * @param timeout
     * @returns {Promise<void>}
     */
    async getAccountResource(coin, address, contract, timeout = 15000) {
        try {
            let contractStr = "";
            if (contract) {
                contractStr = "?contract=" + contract;
            }
            const response = await api.get(`/accountResource/${coin}/${address}${contractStr}`, {
                timeout: timeout,
            });

            return response.data;
        } catch (e) {
            const msg = e.response?.data?.detail || e.message;
            throw new Error(`[getAccountResource] Error: ${msg}`)
        }
    }

    /**
     * Query the latest 'limit' transaction records
     * @param asset
     * @param limit
     * @param timeout
     * @returns {Promise<int>}
     */
    async getTransaction(asset, limit = 10, timeout = 15000) {
        try {
            let contract = "";
            if (asset.contract) {
                contract = "&contract=" + asset.contract;
            }
            const response = await api.get(`/transaction/${asset.coin}/${asset.address}?limit=${limit}${contract}`, {
                timeout: timeout,
            });

            if (response.status === 200) {
                // Return the number of successfully inserted records
                return await updateTransactionHistory(asset, response.data);
            }

            return 0;
        } catch (e) {
            const msg = e.response?.data?.detail || e.message;
            throw new Error(`[getTransaction] Error: ${msg}`)
        }
    }

    /**
     * [UTXO] Get UTXO list
     * @param asset
     * @param totalValue
     * @returns {Promise<any|*[]>}
     */
    async getUtxos(asset, totalValue) {
        try {
            const res = await api.get(`/utxo/${asset.coin}/${asset.address}?total_value=${totalValue}`);
            return res.data || [];
        } catch (e) {
            const msg = e.response?.data?.detail || e.message;
            throw new Error(`[getUtxos] Error: ${msg}`)
        }
    }

    /**
     * Get the latest block
     * @param asset
     * @returns {Promise<any|{}|{}>}
     */
    async getBlock(asset) {
        try {
            const res = await api.get(`/block/${asset.coin}/${asset.address}`);
            return res.data || {};
        } catch (e) {
            const msg = e.response?.data?.detail || e.message;
            throw new Error(`[getBlock] Error: ${msg}`)
        }
    }

    /**
     * [Universal] Get fee rate
     * @param asset
     * @returns {Promise<any|number|number>}
     */
    async getFeeRate(asset) {
        try {
            const res = await api.get(`/fee/${asset.coin}`);
            return res.data || {};
        } catch (e) {
            const msg = e.response?.data?.detail || e.message;
            throw new Error(`[getFeeRate] Error: ${msg}`)
        }
    }

    /**
     * seqno (Sequence Number)
     * In TON blockchain, it specifically refers to "which transaction this is in the history of successful transactions sent from this wallet address"
     * @param asset
     * @returns {Promise<void>}
     */
    async getSeqno(asset) {
        try {
            const res = await api.get(`/seqno/${asset.coin}/${asset.address}`);
            return res.data || {};
        } catch (e) {
            const msg = e.response?.data?.detail || e.message;
            throw new Error(`[getSeqno] Error: ${msg}`)
        }
    }

    /**
     * [EVM] Query Nonce
     * @param asset
     * @returns {Promise<any|number>}
     */
    async getNonce(asset) {
        try {
            const res = await api.get(`/nonce/${asset.coin}/${asset.address}`);
            return res.data || 0;
        } catch (e) {
            const msg = e.response?.data?.detail || e.message;
            throw new Error(`[getSeqno] Error: ${msg}`)
        }
    }

    /**
     * [EVM] Estimate Gas
     * @param asset
     * @param txParams
     * @returns {Promise<string>}
     */
    async estimateGas(asset, txParams) {
        try {
            let contract = "";
            if (asset.contract) {
                contract = "?contract=" + asset.contract;
            }
            const res = await api.get(`/estimateGas/${asset.coin}/${asset.address}${contract}`);
            return res.data || {};

        } catch (e) {
            const msg = e.response?.data?.detail || e.message;
            throw new Error(`[estimateGas] Error: ${msg}`)
        }
    }

    /**
     * [Universal] Broadcast transaction
     * @param asset Asset object
     * @param signedHex Signing result (could be Hex string, JSON string, or even an object)
     * @returns {Promise<string>}
     */
    async broadcast(asset, signedHex) {
        try {
            const res = await api.post(`/broadcast/${asset.coin}`, {
                tx_hex: signedHex
            });
            return res.data.txid;
        } catch (e) {
            const msg = e.response?.data?.detail || e.message;
            console.error(msg);
            throw new Error(`Broadcast transaction failed`);
        }
    }

}

export default new ChainService();