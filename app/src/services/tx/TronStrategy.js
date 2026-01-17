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
import { ref } from 'vue';
import {toAtomicAmount, fromAtomicAmount} from "src/utils/NumberUtil";
import { getContractWithMainAsset } from 'src/services/DbService.js'
import {useChainStore} from "stores/chainStore.js";

export default class TronStrategy extends TxStrategy {

    constructor(asset, chainStore) {
        super(asset, chainStore);
        this.sourceAccount = ref(null);
        this.targetAccount = ref(null);
        this.blockHeader = ref(null);
    }

    async fetchNetworkData(amount, toAddress) {
        // 1. Fetch core data in parallel
        const [rawBlock, rawSource, rawTarget] = await Promise.all([
            ChainService.getBlock(this.asset),
            ChainService.getAccountResource(this.asset.coin, this.asset.address, this.asset.contract),
            ChainService.getAccountResource(this.asset.coin, toAddress, this.asset.contract),
        ]);

        if (!rawSource) {
            throw new Error("Unable to fetch data, please check network");
        }

        this.sourceAccount.value = rawSource;
        this.targetAccount.value = rawTarget;
        this.blockHeader.value = rawBlock;

        // Smart contracts need to fetch the main coin (TRX) balance
        if (this.asset.contract) {
            try {
                const mainAssetRaw = await getContractWithMainAsset(this.asset);
                this.networkParams.nativeBalance = mainAssetRaw
                    ? toAtomicAmount(mainAssetRaw.balance, mainAssetRaw.decimals)
                    : "0";
            } catch (e) {
                console.error("Fetch native SOL balance failed:", e);
                this.networkParams.nativeBalance = "0";
            }
        }
    }

    getDisplayFee() {
        try {
            const feeBig = this._calculateTotalFee();
            // Precision must be the mainnet's decimals
            const chainStore = useChainStore();
            let decimals = this.asset.decimals;
            if (this.asset.contract) {
                const coin = chainStore.getCoin(this.asset.coin);
                decimals = coin.decimals;
            }
            return fromAtomicAmount(feeBig.toString(), decimals);
        } catch (e) {
            console.error("Fee calc error:", e);
            return "Calculation failed";
        }
    }

    getAccountResource() {
        return this.sourceAccount.value;
    }

    async refreshResource() {
        const rawSource = await ChainService.getAccountResource(
            this.asset.coin,
            this.asset.address,
            this.asset.contract
        );
        // Refresh validation
        if (rawSource && rawSource.feeBandwidth != null) {
            this.sourceAccount.value = rawSource;
        }
        return rawSource;
    }

    async buildParams(form, password, walletMode) {
        // If there is no block header or account data, it means fetchNetworkData failed or was not executed
        if (!this.blockHeader.value?.number || !this.sourceAccount.value) {
            throw new Error('Network data sync failed, unable to build transaction');
        }

        const inputAmountAtomic = BigInt(toAtomicAmount(form.amount, this.asset.decimals));
        const balanceAtomic = BigInt(toAtomicAmount(this.asset.balance, this.asset.decimals));

        // Calculate fee (if data is missing, it will throw an error directly)
        const estimatedFeeAtomic = this._calculateTotalFee();

        let finalAmount = inputAmountAtomic;

        if (this.asset.contract) {
            // === TRC20 ===
            const trxBalanceAtomic = BigInt(this.networkParams.nativeBalance || 0n);

            if (trxBalanceAtomic < estimatedFeeAtomic) {
                throw new Error(`Insufficient balance to pay Gas fee`);
            }

            if (finalAmount > balanceAtomic) {
                finalAmount = balanceAtomic;
            }
        } else {
            // === TRX ===
            const maxAvailable = balanceAtomic - estimatedFeeAtomic;

            if (maxAvailable < 0n) {
                throw new Error(`Insufficient balance to pay Gas fee`);
            }

            if (finalAmount > maxAvailable) {
                finalAmount = maxAvailable;
            }
        }

        return {
            asset: this.asset,
            txData: {
                toAddress: form.to,
                memo: form.memo,
                amount: finalAmount.toString(),
                timestamp: Date.now(),
                contractAddress: this.asset.contract,
                blockHeader: { ...this.blockHeader.value }
            },
            mode: walletMode,
            password: password
        };
    }

    /**
     * [Strict Version] Calculate actual burn (Unit: SUN)
     * Strictly forbid default values; crash if data is missing to force error handling upstream
     */
    _calculateTotalFee() {
        if (!this.sourceAccount.value) {
            return 0;
        }

        const source = this.sourceAccount.value;
        const target = this.targetAccount.value;
        const isTRC20 = !!this.asset.contract;

        // === 1. Parameter extraction and validation (Fail Fast) ===
        // If these fields are undefined/null, the API response format is wrong or the network layer didn't pass it through
        if (source.feeActivation == null || source.feeBandwidth == null || source.feeEnergy == null) {
            throw new Error("Critical network parameters missing, unable to calculate fee");
        }

        // Unit conversion: TRX decimal -> Sun integer (BigInt)
        const feeActivation = BigInt(toAtomicAmount(source.feeActivation, this.asset.decimals));
        const feeBandwidth = BigInt(toAtomicAmount(source.feeBandwidth, this.asset.decimals));
        const feeEnergy = BigInt(toAtomicAmount(source.feeEnergy, this.asset.decimals));
        const feeEnergyNeeded = BigInt(source.feeEnergyNeeded || 0n); // It's okay if energy need is 0

        let totalTrxBurn = 0n;

        // === 2. Bandwidth Calculation ===
        const bytesNeeded = isTRC20 ? 350n : 300n;
        const availableBw = BigInt(source.bandwidth || 0n);

        if (availableBw < bytesNeeded) {
            const deficit = bytesNeeded - availableBw;
            totalTrxBurn += deficit * feeBandwidth;
        }

        // === 3. Energy Calculation (TRC20) ===
        if (isTRC20) {
            let energyNeeded = feeEnergyNeeded;

            let targetHasToken = false;
            if (target && target.trc20) {
                targetHasToken = target.trc20.some(obj => Object.keys(obj).includes(this.asset.contract));
            }

            if (!targetHasToken) {
                energyNeeded = energyNeeded * 2n;
            }

            const availableEnergy = BigInt(source.energy || 0);

            if (availableEnergy < energyNeeded) {
                const deficit = energyNeeded - availableEnergy;
                totalTrxBurn += deficit * feeEnergy;
            }
        }
        // === 4. Activation Fee Calculation (TRX) ===
        else {
            // When transferring TRX, if target info is unavailable, assume activation fee is needed
            if (!target || target.balance === undefined) {
                totalTrxBurn += feeActivation;
            }
        }

        return totalTrxBurn;
    }
}