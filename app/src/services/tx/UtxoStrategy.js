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
import { WalletCore } from 'boot/wallet';
import WalletCoreService from "src/services/WalletCoreService";
import { toAtomicAmount, toNormalString } from "src/utils/NumberUtil";
import { getContractWithMainAsset } from 'src/services/DbService.js'; // Import this to query main coin in the future

export default class UtxoStrategy extends TxStrategy {

    async fetchNetworkData(amountInput) {
        // 1. Get UTXO
        // Note: If transferring tokens, the utxos obtained here should be unique to that token (or utxos containing inscriptions)
        const rawUtxos = await ChainService.getUtxos(this.asset, amountInput);

        // If it is a smart contract/token asset, must additionally query main coin balance for calculating Gas
        if (this.asset.contract) {
            try {
                // "Smart contracts" on UTXO chains usually refer to BRC20/Runes etc.
                // We need to know the balance of the main coin (BTC/LTC/DOGE) to pay miner fees
                const mainAssetRaw = await getContractWithMainAsset(this.asset);
                // Temporarily store in nativeBalance, unit is Satoshi
                this.networkParams.nativeBalance = mainAssetRaw
                    ? toAtomicAmount(mainAssetRaw.balance, mainAssetRaw.decimals)
                    : "0";

                // Also need to get the main coin's UTXO list, because paying Gas requires main coin UTXOs (Funding UTXOs)
                // This step needs improvement in the future: rawUtxos might be inscription UTXOs, we need additional "Gas UTXOs"
                // Temporarily assume ChainService has handled mixed returns, or we only handle pure coin transfers
            } catch (e) {
                console.error("Fetch native balance for UTXO token failed:", e);
                this.networkParams.nativeBalance = "0";
            }
        }

        // 2. Decide Fee Rate
        let finalFeeRate = 1;
        const coin = this.asset.coin;

        if (coin === 'bitcoin') {
            const rate = await ChainService.getFeeRate(this.asset);
            if (rate?.medium) {
                finalFeeRate = parseFloat(rate.medium);
            }
        } else if (coin === 'doge') {
            finalFeeRate = 4000;
        }

        // 3. Assign reactive object
        Object.assign(this.networkParams, {
            feeRate: finalFeeRate,
            utxos: rawUtxos.map(u => ({
                ...u,
                value: toAtomicAmount(u.valueAsString || u.value, this.asset.decimals)
            }))
        });
    }

    getDisplayFee() {
        if (!this.networkParams.feeRate) return '0';
        // Estimate: Fee Rate * 250 bytes (Average transaction size)
        const totalSats = this.networkParams.feeRate * 250;
        return toNormalString((Math.ceil(totalSats) / 100000000));
    }

    async buildParams(form, password, walletMode) {
        const amountSmall = toAtomicAmount(form.amount, this.asset.decimals);
        const safeFeeRate = Math.ceil(this.networkParams.feeRate).toString();

        // Check if sending all
        const isMaxSend = BigInt(amountSmall) === BigInt(toAtomicAmount(this.asset.balance, this.asset.decimals));

        // 1. Determine Gas payment capability
        let gasBalanceBigInt = 0n;

        if (this.asset.contract) {
            // *** Scenario A: Token/Inscription Transfer ***
            // Gas fee must be deducted from main coin balance
            gasBalanceBigInt = BigInt(this.networkParams.nativeBalance || "0");
        } else {
            // *** Scenario B: Main Coin Transfer ***
            // Gas fee deducted from current balance (i.e., totalValue)
            // Here temporarily set as sum of UTXOs, selectUtxos will calculate precisely later
            gasBalanceBigInt = this.networkParams.utxos.reduce((sum, u) => sum + BigInt(u.value), 0n);
        }

        // 2. Call smart selection algorithm
        // Note: If transferring tokens, what is selected here is "UTXOs containing tokens" + "Main coin UTXOs for paying Gas"
        // Current _selectUtxos logic is mainly for pure coins, future needs "dual selection" modification for tokens
        const selection = this._selectUtxos(this.networkParams.utxos, amountSmall, safeFeeRate);

        let finalAmountBigInt;
        const estimatedFeeBigInt = BigInt(selection.fee);

        // 3. Calculate final amount & Validate Gas
        if (this.asset.contract) {
            // === Token Mode ===
            finalAmountBigInt = BigInt(amountSmall);

            // Validate if main coin is enough to pay miner fee
            if (gasBalanceBigInt < estimatedFeeBigInt) {
                // e.g. You have 100 ORDI, but BTC balance is 0, cannot transfer
                throw new Error("Insufficient balance to pay Gas fee");
            }

            // Validate token balance (Total token amount from UTXOs)
            if (selection.totalValue < finalAmountBigInt) {
                throw new Error("Insufficient balance"); // Token insufficient
            }

        } else {
            // === Main Coin Mode ===
            if (isMaxSend) {
                // Send All: Balance - Fee
                finalAmountBigInt = selection.totalValue - estimatedFeeBigInt;
            } else {
                // Normal Transfer
                finalAmountBigInt = BigInt(amountSmall);
                // Validate if (Transfer + Fee) exceeds total value of selected UTXOs
                const totalCost = finalAmountBigInt + estimatedFeeBigInt;
                if (selection.totalValue < totalCost) {
                    throw new Error("Insufficient balance to pay Gas fee");
                }
            }
        }

        // 4 Intercept dust amount
        if (finalAmountBigInt < 546n) {
            // Note: For BRC20 Transfer inscriptions, its value is often 546 sats, cannot intercept here
            // Only intercept if pure coin transfer. So in future add !this.asset.contract check here
            if (!this.asset.contract) {
                throw new Error("Transfer amount too small, network will reject transaction");
            }
        }

        // 5. Generate locking script
        let encodedScript = null;
        let script = null;
        try {
            const coinObj = this.chainStore.getCoin(this.asset.coin);
            const coinType = WalletCoreService.getCoinTypeById(WalletCore, coinObj.coinId);
            script = WalletCore.BitcoinScript.lockScriptForAddress(this.asset.address, coinType);
            encodedScript = WalletCore.HexCoding.encode(script.data());
        } catch (e) {
            throw e;
        } finally {
            if (script) {
                script.delete();
            }
        }
        if (!encodedScript) {
            throw new Error('Error occurred, please try again later');
        }

        // 6. Format selected UTXOs
        const validUtxos = selection.utxos.map(u => ({
            ...u,
            amount: u.value,
            script: encodedScript
        }));

        if (!validUtxos.length) throw new Error("No available UTXO");

        return {
            asset: this.asset,
            txData: {
                toAddress: form.to,
                memo: form.memo,
                amount: finalAmountBigInt.toString(), // Final amount
                byteFee: safeFeeRate,
                utxos: validUtxos,
                changeAddress: this.asset.address,
                useMax: isMaxSend // Key flag, passed to lower layer
            },
            mode: walletMode,
            password: password
        };
    }

    /**
     * Simple UTXO Selection Algorithm (Accumulative Strategy)
     * Native Segwit (bc1q...)
     * Logic:
     * 1. Try to accumulate enough amount from largest to smallest.
     * 2. If enough, return that subset (Calculate fee including change).
     * 3. If traversing all is still not enough, or if it's send all, return all UTXOs (Calculate fee without change).
     * @param availableUtxos
     * @param targetAmountStr
     * @param feeRateStr
     */
    _selectUtxos(availableUtxos, targetAmountStr, feeRateStr) {
        const targetAmount = BigInt(targetAmountStr);
        const feeRate = BigInt(feeRateStr);

        const TX_FIXED_OVERHEAD = 10n;
        const TX_INPUT_SIZE = 68n;
        const TX_OUTPUT_SIZE = 31n;
        const TX_BASE_SIZE = TX_FIXED_OVERHEAD + TX_OUTPUT_SIZE;
        const DUST_THRESHOLD = 546n; // Dust threshold

        // Sort by amount descending
        const sortedUtxos = [...availableUtxos].sort((a, b) =>
            Number(BigInt(b.value || b.amount) - BigInt(a.value || a.amount))
        );

        let selectedInputs = [];
        let totalValue = 0n;

        for (const utxo of sortedUtxos) {
            selectedInputs.push(utxo);
            totalValue += BigInt(utxo.value || utxo.amount);

            // 1. Calculate case with change (2 Outputs)
            const bytesWithChange = TX_BASE_SIZE + TX_OUTPUT_SIZE + (BigInt(selectedInputs.length) * TX_INPUT_SIZE);
            const feeWithChange = bytesWithChange * feeRate;
            const remaining = totalValue - (targetAmount + feeWithChange);

            // 2. Check if enough to pay
            if (totalValue >= targetAmount + feeWithChange) {
                // 3. Check if change is dust
                if (remaining > 0n && remaining < DUST_THRESHOLD) {
                    // If change is dust (e.g. only 100 sats left), don't give change!
                    // Treat as no change (Burn this change to miner, or include in fee)
                    // Recalculate fee without change (One less Output)
                    const bytesNoChange = TX_BASE_SIZE + (BigInt(selectedInputs.length) * TX_INPUT_SIZE);
                    const feeNoChange = bytesNoChange * feeRate;

                    return {
                        utxos: selectedInputs,
                        fee: feeNoChange.toString(), // Miner actually earns (totalValue - targetAmount)
                        totalValue: totalValue
                    };
                }

                // Normal case: Change greater than dust, or exactly 0
                return {
                    utxos: selectedInputs,
                    fee: feeWithChange.toString(),
                    totalValue: totalValue
                };
            }
        }

        // Scenario B: Fallback mode (Insufficient balance or Send All)
        const bytesNoChange = TX_BASE_SIZE + (BigInt(sortedUtxos.length) * TX_INPUT_SIZE);
        const feeNoChange = bytesNoChange * feeRate;

        return {
            utxos: sortedUtxos,
            fee: feeNoChange.toString(),
            totalValue: totalValue
        };
    }
}