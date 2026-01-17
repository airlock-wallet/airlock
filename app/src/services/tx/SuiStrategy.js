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

import TxStrategy from './TxStrategy';
import ChainService from 'src/services/ChainService';
import { fromAtomicAmount, toAtomicAmount } from "src/utils/NumberUtil";
import { getContractWithMainAsset } from 'src/services/DbService.js';
import {useChainStore} from "stores/chainStore.js";

export default class SuiStrategy extends TxStrategy {
    // Hardware wallet limit: Max inputs per signature
    static MAX_HARDWARE_INPUTS = 50;
    // Standard storage fee rebate
    static STANDARD_STORAGE_COST = 1000000n;

    /**
     * SUI Initialization Data Fetch
     */
    async fetchNetworkData(amount) {
        const [gasRes, rawCoinsRes] = await Promise.all([
            ChainService.getFeeRate(this.asset),
            ChainService.getUtxos(this.asset, 0)
        ]);

        // If it is a token asset, additionally query main coin (SUI) balance
        let nativeBalance = "0";
        if (this.asset.contract) {
            try {
                const mainAssetRaw = await getContractWithMainAsset(this.asset);
                nativeBalance = mainAssetRaw
                    ? toAtomicAmount(mainAssetRaw.balance, mainAssetRaw.decimals)
                    : "0";
            } catch (e) {
                console.error("Fetch native SUI balance failed:", e);
            }
        }

        Object.assign(this.networkParams, {
            gasPrice: gasRes.medium.toString(),
            objects: rawCoinsRes.map(coin => ({
                ...coin,
                value: toAtomicAmount(coin.value, this.asset.decimals)
            })),
            nativeBalance: nativeBalance
        });
    }

    getDisplayFee() {
        if (!this.networkParams.gasPrice) return '0';
        const budget = this._calculateGasBudget(this.networkParams.gasPrice);
        // Precision must be the mainnet's decimals
        const chainStore = useChainStore();
        let decimals = this.asset.decimals;
        if (this.asset.contract) {
            const coin = chainStore.getCoin(this.asset.coin);
            decimals = coin.decimals;
        }
        return fromAtomicAmount(budget, decimals);
    }

    async buildParams(form, password, walletMode) {
        // 1. Basic data preparation
        const gasPriceBig = BigInt(this.networkParams.gasPrice || "1000");
        const inputAmountAtomic = BigInt(toAtomicAmount(form.amount, this.asset.decimals));
        const assetBalanceAtomic = BigInt(toAtomicAmount(this.asset.balance, this.asset.decimals));

        // 2. Determine Send Max
        // As long as Input Amount == Book Balance, consider it Max
        const isMaxSend = inputAmountAtomic === assetBalanceAtomic;

        // 3. Calculate Gas Budget
        const gasBudgetBig = this._calculateGasBudget(gasPriceBig, isMaxSend);

        // 4. Validate Main Coin SUI Reserve (Gas)
        let nativeBalanceAtomic = 0n;
        if (this.asset.contract) {
            // [Token Mode] Read SUI balance fetched in fetchNetworkData
            nativeBalanceAtomic = BigInt(this.networkParams.nativeBalance || "0");
        } else {
            // [SUI Mode] Read own balance
            nativeBalanceAtomic = assetBalanceAtomic;
        }

        // 5. Check if Gas is sufficient (Token Mode only)
        // SUI Mode validation is done in coin selection logic
        if (this.asset.contract) {
            if (nativeBalanceAtomic < gasBudgetBig) {
                throw new Error("Insufficient mainnet coin (SUI) to pay Gas fee");
            }
        }

        // 6. Prepare selection target
        // Token Transfer: Just need amount (Gas paid by SUI account separately)
        // SUI Transfer: Need Amount + Gas
        const targetForSelection = this.asset.contract ? inputAmountAtomic : (inputAmountAtomic + gasBudgetBig);

        // SUI Max Mode needs to reserve Gas
        const reservedGasForMax = (!this.asset.contract && isMaxSend) ? gasBudgetBig : 0n;

        // 7. Call BTC-style coin selection algorithm
        const { selectedCoins, totalSelectedVal } = this._selectCoinsBtcStyle(
            this.networkParams.objects,
            targetForSelection,
            reservedGasForMax,
            isMaxSend
        );

        // 8. Calculate final amount
        let finalAmountAtomic = inputAmountAtomic;

        if (isMaxSend) {
            if (this.asset.contract) {
                // Token Max: Send all
                finalAmountAtomic = totalSelectedVal;
            } else {
                // SUI Max: Send all - Gas
                finalAmountAtomic = totalSelectedVal - gasBudgetBig;
            }
            if (finalAmountAtomic <= 0n) throw new Error("Insufficient balance to pay Gas fee");
        } else {
            // Normal transfer validation
            if (!this.asset.contract) {
                // SUI: Selected Amount >= Target (includes Gas)
                if (totalSelectedVal < (finalAmountAtomic + gasBudgetBig)) {
                    throw new Error("Insufficient balance to pay Gas fee");
                }
            } else {
                // Token: Selected Amount >= Target
                if (totalSelectedVal < finalAmountAtomic) {
                    throw new Error("Insufficient balance to pay Gas fee");
                }
            }
        }

        return {
            asset: this.asset,
            txData: {
                toAddress: form.to,
                amount: finalAmountAtomic.toString(),
                utxos: selectedCoins.map(coin => ({
                    objectId: coin.objectId,
                    version: String(coin.version),
                    objectDigest: coin.objectDigest,
                    balance: coin.value
                })),
                gasLimit: gasBudgetBig.toString(),
                gasPrice: gasPriceBig.toString(),
                contractAddress: this.asset.contract,
                memo: form.memo || ""
            },
            mode: walletMode,
            password: password
        };
    }

    _calculateGasBudget(gasPrice, isMaxSend = false) {
        // SUI Gas = Computation + Storage
        // Fixed computation budget
        const computation = 3000000n;
        // Storage fee: Send Max destroys Object, rebate usually offsets storage, so 0 or very little
        // Normal transfer creates new Object (Recipient + Change), needs storage fee
        const storage = isMaxSend ? 0n : SuiStrategy.STANDARD_STORAGE_COST;
        return computation + storage;
    }

    /**
     * ★★★ BTC Style Coin Selection Algorithm (Accumulative Strategy) ★★★
     * Core Logic: Largest First
     * Pros: Uses minimal Coins to reach amount, least likely to trigger hardware wallet 50 Input limit
     */
    _selectCoinsBtcStyle(availableCoins, targetAmount, reservedGasForMax, isMaxSend) {
        // 1. Filter invalid coins and sort descending (Large -> Small)
        const sortedCoins = availableCoins
            .filter(c => c && BigInt(c.value) > 0n)
            .sort((a, b) => {
                const diff = BigInt(b.value) - BigInt(a.value);
                return diff > 0n ? 1 : (diff < 0n ? -1 : 0);
            });

        // 2. Scenario A: Send Max (Transfer All)
        if (isMaxSend) {
            // Directly take the top 50 largest (Hardware limit)
            const selected = sortedCoins.slice(0, SuiStrategy.MAX_HARDWARE_INPUTS);
            const total = selected.reduce((sum, c) => sum + BigInt(c.value), 0n);

            if (selected.length === 0) throw new Error("Wallet balance is 0");

            // If SUI Max, must ensure enough money for Gas
            if (reservedGasForMax > 0n && total < reservedGasForMax) {
                throw new Error("Insufficient balance to pay Gas fee");
            }

            // Warn about fragmentation
            if (sortedCoins.length > SuiStrategy.MAX_HARDWARE_INPUTS) {
                console.warn(`[SuiStrategy] Only processing top ${SuiStrategy.MAX_HARDWARE_INPUTS} large Objects`);
            }

            return { selectedCoins: selected, totalSelectedVal: total };
        }

        // 3. Scenario B: Normal Transfer (Accumulate)
        let selected = [];
        let currentSum = 0n;

        // Iterate from large to small
        for (const coin of sortedCoins) {
            // Hardware circuit breaker
            if (selected.length >= SuiStrategy.MAX_HARDWARE_INPUTS) break;

            selected.push(coin);
            currentSum += BigInt(coin.value);

            // Once enough, stop immediately (Coin Selection Complete)
            if (currentSum >= targetAmount) {
                return { selectedCoins: selected, totalSelectedVal: currentSum };
            }
        }

        // 4. Result check
        throw new Error(`Insufficient balance or too many fragments`);
    }
}