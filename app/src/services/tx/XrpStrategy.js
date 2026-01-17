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
import { toAtomicAmount, fromAtomicAmount } from "src/utils/NumberUtil";
// Import DB service to query main coin XRP balance
import { getContractWithMainAsset } from 'src/services/DbService.js';

export default class XrpStrategy extends TxStrategy {

    async fetchNetworkData(amount, toAddress) {
        // 1. Get aggregated info (Balance, Sequence, Reserve)
        const accountInfo = await ChainService.getBalance(this.asset);

        // 2. Get real-time fee rate
        const rate = await ChainService.getFeeRate(this.asset);

        // 3. Convert data to Atomic (BigInt)
        let feeDrops = 0;
        if (rate?.medium) {
            feeDrops = toAtomicAmount(rate.medium, this.asset.decimals);
        }

        // 4. If it is a token asset, must additionally query main coin (XRP) balance
        let nativeBalance = "0";
        if (this.asset.contract) {
            try {
                const mainAssetRaw = await getContractWithMainAsset(this.asset);
                nativeBalance = mainAssetRaw
                    ? toAtomicAmount(mainAssetRaw.balance, mainAssetRaw.decimals)
                    : "0";
            } catch (e) {
                console.error("Fetch native XRP balance failed:", e);
            }
        }

        let isDestinationActive = false;
        try {
            const destInfo = await ChainService.getBalanceFormCoinAndAddress(this.asset.coin, toAddress);
            if (parseFloat(destInfo.balance) >= 0) {
                isDestinationActive = true;
            }
        } catch (e) {
            // If not found, it means not activated
            isDestinationActive = false;
        }

        // Even if backend returns 1.0, convert to drops. Fallback default 10 (although backend has fallback)
        const reserveXrp = accountInfo.base_reserve || 1;
        const reserveDrops = BigInt(toAtomicAmount(reserveXrp, 6));

        Object.assign(this.networkParams, {
            sequence: accountInfo.sequence || 0,
            ledgerIndex: accountInfo.ledgerIndex || 0,
            fee: feeDrops > 0n ? feeDrops : 12n,
            baseReserve: reserveDrops,
            isDestinationActive: isDestinationActive, // Mark destination status
            nativeBalance: nativeBalance // Store XRP balance
        });
    }

    getDisplayFee() {
        if (!this.networkParams.fee) return '0';
        return fromAtomicAmount(this.networkParams.fee, this.asset.decimals);
    }

    async buildParams(form, password, walletMode) {
        // === 1. Prepare Data ===
        const inputAmountAtomic = BigInt(toAtomicAmount(form.amount, this.asset.decimals));
        const balanceAtomic = BigInt(toAtomicAmount(this.asset.balance, this.asset.decimals));
        const feeAtomic = BigInt(this.networkParams.fee);
        const reserveAtomic = BigInt(this.networkParams.baseReserve);

        // Determine Gas Reserve (XRP Balance)
        let nativeBalanceAtomic = 0n;
        if (this.asset.contract) {
            // [Token Mode] Use retrieved XRP balance
            nativeBalanceAtomic = BigInt(this.networkParams.nativeBalance || "0");
        } else {
            // [XRP Mode] Use own balance
            nativeBalanceAtomic = balanceAtomic;
        }

        let finalAmount = inputAmountAtomic;

        // === 2. Smart Balance Correction (Smart Clamping) ===

        if (this.asset.contract) {
            // === Scenario A: Token (Issued Currency) Transfer ===

            // Check 1: Is XRP balance sufficient to pay transaction fees
            // Although XRP network Gas is low, having no XRP is absolutely not allowed
            if (nativeBalanceAtomic < feeAtomic) {
                throw new Error("Insufficient mainnet coin (XRP) to pay miner fees");
            }

            // Check 2: Is token balance sufficient (Send Max)
            if (finalAmount > balanceAtomic) {
                finalAmount = balanceAtomic;
            }

            // Note: Token transfer does not need to check if destination is activated (TrustSet is a prerequisite, but that is on-chain logic, here we only care about Gas)

        } else {
            // === Scenario B: Native XRP Transfer ===

            // XRP Available Balance = Total Balance - Fee - Required Frozen Reserve
            const maxAvailable = nativeBalanceAtomic - feeAtomic - reserveAtomic;

            // B1. Not enough to pay fee and reserve
            if (maxAvailable < 0n) {
                throw new Error(`Balance insufficient to pay Gas fee`);
            }

            // B2. Smart Truncation (Send Max)
            if (inputAmountAtomic > maxAvailable) {
                console.log(`[XRP] Trigger smart correction: User input ${inputAmountAtomic} -> Corrected to ${maxAvailable}`);
                finalAmount = maxAvailable;
            }

            // B3. Check if destination address is an activated address
            // (Activation threshold check only for XRP transfers; not needed for Tokens, as those receiving Tokens must already be activated)
            if (!this.networkParams.isDestinationActive) {
                if (finalAmount < reserveAtomic) {
                    throw new Error(`First transfer must be greater than ${fromAtomicAmount(reserveAtomic, this.asset.decimals)} XRP to activate account`);
                }
            }
        }

        // === 3. Memo (Tag) Processing ===
        let destinationTag = null;
        if (form.memo) {
            // Tag must be all digits
            if (/^\d+$/.test(form.memo)) {
                destinationTag = parseInt(form.memo);
            } else {
                console.warn("[XRP] Memo contains non-digits, ignoring tag.");
            }
        }

        // Calculate LastLedgerSequence
        let lastLedgerSequence = 0;
        if (this.networkParams.ledgerIndex > 0) {
            lastLedgerSequence = this.networkParams.ledgerIndex + 50;
        }

        // === 4. Return Signing Parameters ===
        return {
            asset: this.asset,
            txData: {
                toAddress: form.to,
                amount: finalAmount.toString(),
                byteFee: feeAtomic.toString(),
                sequenceNumber: this.networkParams.sequence,
                lastLedgerSequence: lastLedgerSequence,
                memo: destinationTag,
            },
            mode: walletMode,
            password: password
        };
    }
}