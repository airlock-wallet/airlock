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
import { getContractWithMainAsset } from 'src/services/DbService.js';
import {useChainStore} from "stores/chainStore.js";

export default class SolStrategy extends TxStrategy {
    // Solana fixed fee (5000 Lamports)
    FEE = 5000n;

    /**
     * Fetch Solana on-chain data
     * Core requirement: Get the latest Blockhash (RecentBlockhash)
     */
    async fetchNetworkData(amount) {
        // 1. Fetch latest block info
        const block = await ChainService.getBlock(this.asset);

        if (block && block.hash) {
            this.networkParams.recentBlockhash = block.hash;
        } else {
            throw new Error("Failed to fetch Solana recent blockhash");
        }

        // If it is a token asset, must query the main coin (SOL) balance to pay for Gas
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

        // 2. (Optional) Get priority fee suggestion
        // Currently Solana base fee is fixed at 5000 Lamports/Signature
        // If priority fee support is needed in the future, call ChainService.getFee() here
    }

    /**
     * Get estimated fee for UI display
     */
    getDisplayFee() {
        // Fixed rate: 0.000005 SOL
        // Precision must be the mainnet's decimals
        const chainStore = useChainStore();
        let decimals = this.asset.decimals;
        if (this.asset.contract) {
            const coin = chainStore.getCoin(this.asset.coin);
            decimals = coin.decimals;
        }
        return fromAtomicAmount(this.FEE, decimals);
    }

    /**
     * Construct signing parameters
     */
    async buildParams(form, password, walletMode) {
        // 1. Prepare amount data
        const inputAmountAtomic = BigInt(toAtomicAmount(form.amount, this.asset.decimals));
        const balanceAtomic = BigInt(toAtomicAmount(this.asset.balance, this.asset.decimals));

        // 2. Determine Gas reserve amount
        // If token, take nativeBalance (SOL); if SOL, take current balance
        const nativeBalanceAtomic = this.asset.contract
            ? BigInt(this.networkParams.nativeBalance || "0")
            : balanceAtomic;

        let finalAmount = inputAmountAtomic;

        // 3. Smart judgment and validation
        if (this.asset.contract) {
            // === Token Logic (SPL Token) ===

            // Check A: Is main coin SOL sufficient to pay the fee?
            if (nativeBalanceAtomic < this.FEE) {
                throw new Error("Insufficient balance to pay Gas fee");
            }

            // Check B: Token balance logic (Send Max)
            if (finalAmount > balanceAtomic) {
                finalAmount = balanceAtomic; // Transfer all
            }

        } else {
            // === Main Coin Logic (SOL) ===

            // Calculate theoretical max available amount (Balance - Fee)
            const maxAvailable = balanceAtomic - this.FEE;

            // Check A: Not even enough for fee
            if (maxAvailable < 0n) {
                throw new Error("Insufficient balance to pay Gas fee");
            }

            // Check B: Smart truncation (Send Max)
            if (finalAmount > maxAvailable) {
                finalAmount = maxAvailable;
            }
        }

        return {
            asset: this.asset,
            txData: {
                toAddress: form.to,
                amount: finalAmount.toString(),
                memo: form.memo,
                recentBlockhash: this.networkParams.recentBlockhash,
                contractAddress: this.asset.contract,
                decimals: this.asset.decimals
            },
            mode: walletMode,
            password: password
        };
    }
}