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
import { toAtomicAmount } from "src/utils/NumberUtil";
// Import DB service to query main coin TON balance
import { getContractWithMainAsset } from 'src/services/DbService.js';

export default class TonStrategy extends TxStrategy {

    // TON fee estimation (Native transfers are usually cheap)
    DEFAULT_ESTIMATE_FEE = "0.01";

    // ★★★ Key Constant: TON amount required to attach for Jetton (Token) transfers ★★★
    // This money is used to pay for contract execution fees; excess will be refunded. 0.05 TON is a safe value.
    static JETTON_ATTACH_AMOUNT = 50000000n; // 0.05 TON (9 decimals)

    /**
     * Fetch on-chain data
     * Core parameter required by TON is: seqno (sequence number)
     */
    async fetchNetworkData(amount, toAddress = null) {
        // 1. Get Seqno and basic info
        const params = await ChainService.getSeqno(this.asset);

        // 2. If it is a Jetton token, must fetch main coin (TON) balance additionally
        let nativeBalance = "0";
        if (this.asset.contract) {
            try {
                const mainAssetRaw = await getContractWithMainAsset(this.asset);
                nativeBalance = mainAssetRaw
                    ? toAtomicAmount(mainAssetRaw.balance, mainAssetRaw.decimals)
                    : "0";
            } catch (e) {
                console.error("Fetch native TON balance failed:", e);
            }
        }

        Object.assign(this.networkParams, {
            seqno: params.seqno || 0,
            isDeployed: params.is_active || false,
            estimatedFee: params.estimated_fee || this.DEFAULT_ESTIMATE_FEE,
            nativeBalance: nativeBalance
        });
    }

    /**
     * Get estimated fee for UI display
     */
    getDisplayFee() {
        return this.networkParams.estimatedFee || '0';
    }

    /**
     * Construct signing parameters (data sent to hardware/Worker)
     */
    async buildParams(form, password, walletMode) {
        // 1. Prepare amount data
        const inputAmountAtomic = BigInt(toAtomicAmount(form.amount, this.asset.decimals));
        const assetBalanceAtomic = BigInt(toAtomicAmount(this.asset.balance, this.asset.decimals));

        // 2. Determine Gas reserve (TON balance)
        let nativeBalanceAtomic = 0n;
        if (this.asset.contract) {
            // [Token Mode] Use fetched TON balance
            nativeBalanceAtomic = BigInt(this.networkParams.nativeBalance || "0");
        } else {
            // [TON Mode] Use own balance
            nativeBalanceAtomic = assetBalanceAtomic;
        }

        // 3. Calculate SendMode and final amount
        // Mode 3   = 1 (Pay fees separately) + 2 (Ignore errors) -> Normal Transfer
        // Mode 130 = 128 (Carry all remaining balance) + 2 (Ignore errors) -> Transfer All
        let finalMode = 3;
        let finalAmount = inputAmountAtomic;

        // Check if sending all
        const isMaxSend = inputAmountAtomic === assetBalanceAtomic;

        if (this.asset.contract) {
            // === Scenario A: Jetton (Token) Transfer ===

            // Check 1: Is TON balance sufficient to pay attached TON (0.05 TON)
            // Note: This doesn't include network transmission fees yet, but 0.05 usually covers everything
            if (nativeBalanceAtomic < TonStrategy.JETTON_ATTACH_AMOUNT) {
                throw new Error("Insufficient balance to pay Gas fee");
            }

            // Check 2: Is token balance sufficient
            // Max Send Logic: If Max, transfer all token balance
            if (isMaxSend) {
                finalAmount = assetBalanceAtomic;
            }

            // For Jetton, SendMode is always 3 (Normal).
            // Because we cannot use Mode 128, that would transfer all TON from the account, not the Jetton.
            finalMode = 3;

        } else {
            // === Scenario B: Native TON Transfer ===

            if (isMaxSend) {
                // Max Send: Use Mode 128 (Carry All)
                // At this point, finalAmount doesn't matter much, chain nodes automatically calculate Balance - Fee
                finalMode = 128 | 2; // 130
                // You can also set amount to 0 or balance, the underlying library usually only looks at Mode 128
                finalAmount = assetBalanceAtomic;
            } else {
                // Normal Transfer: Check balance
                // Simple estimation: Balance > Transfer + Estimated Fee
                const estimatedFeeAtomic = BigInt(toAtomicAmount(this.networkParams.estimatedFee, 9));
                if (nativeBalanceAtomic < (finalAmount + estimatedFeeAtomic)) {
                    throw new Error("Insufficient balance to pay Gas fee");
                }
            }
        }

        // 4. Assemble core transaction data
        const txData = {
            toAddress: form.to,
            amount: finalAmount.toString(), // Transfer amount (if Mode 128, this value might be ignored)
            memo: form.memo || '',
            sequenceNumber: this.networkParams.seqno,
            sendMode: finalMode,
            isDeployed: this.networkParams.isDeployed,
            timestamp: Date.now(),
            attachedGas: TonStrategy.JETTON_ATTACH_AMOUNT.toString()
        };

        return {
            asset: this.asset,
            txData: txData,
            mode: walletMode,
            password: password
        };
    }
}