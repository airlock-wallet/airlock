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
import { getContractWithMainAsset } from 'src/services/DbService.js'
import {useChainStore} from "stores/chainStore.js";

export default class EvmStrategy extends TxStrategy {

    async fetchNetworkData(amount) {
        const chainStore = useChainStore();
        const coin = chainStore.getCoin(this.asset.coin);

        // Parallel fetch of Nonce, GasPrice, and chainId
        const [rawNonce, rawGas] = await Promise.all([
            ChainService.getNonce(this.asset),
            ChainService.estimateGas(this.asset)
        ]);
        const params = {
            chainId: coin.chainId,
            nonce: rawNonce,
            ...rawGas
        }

        // If it is a token asset
        if (this.asset.contract) {
            try {
                const mainAssetRaw = await getContractWithMainAsset(this.asset);
                this.networkParams.nativeBalance = mainAssetRaw
                    ? toAtomicAmount(mainAssetRaw.balance, mainAssetRaw.decimals)
                    : "0";
            } catch (e) {
                console.error("Fetch native balance failed:", e);
                this.networkParams.nativeBalance = "0";
            }
        }
        Object.assign(this.networkParams, params);
    }

    getDisplayFee() {
        // EVM Estimation: GasPrice * GasLimit
        if (!this.networkParams.gasPrice) return '0';
        const totalWei = BigInt(this.networkParams.gasLimit) * BigInt(this.networkParams.gasPrice);
        // Precision must be the mainnet's decimals
        const chainStore = useChainStore();
        let decimals = this.asset.decimals;
        if (this.asset.contract) {
            const coin = chainStore.getCoin(this.asset.coin);
            decimals = coin.decimals;
        }
        return fromAtomicAmount(totalWei, decimals);
    }

    async buildParams(form, password, walletMode) {
        if (this.networkParams.nonce === undefined || this.networkParams.gasPrice === undefined) {
            throw new Error('Node sync failed, please try again later');
        }

        // ============================================
        // 1. Prepare Basic Data (Convert all to BigInt)
        // ============================================

        // Intended transfer amount entered by user
        const inputAmountAtomic = BigInt(toAtomicAmount(form.amount, this.asset.decimals));

        // Current asset balance (could be ETH or ERC20)
        const balanceAtomic = BigInt(toAtomicAmount(this.asset.balance, this.asset.decimals));

        // Determine balance used for Gas payment
        // If native transfer, deduct from balanceAtomic
        // If token transfer, deduct from nativeBalance
        const nativeBalanceAtomic = this.asset.contract
            ? BigInt(this.networkParams.nativeBalance || "0") // Token Mode: Use ETH balance
            : balanceAtomic; // Native Mode: Use current balance

        // ============================================
        // 2. Estimate Gas Limit & Calculate Total Fee
        // ============================================
        let txDataStr = undefined;

        // A. Pre-generate Data (For Gas estimation)
        if (this.asset.contract) {
            txDataStr = this._generateErc20TransferData(form.to, inputAmountAtomic);
        }

        // B. Estimate Gas with 1.1x buffer (Safety Buffer)
        // Prevent Out of Gas due to sudden Gas fluctuations
        const gasLimitBig = (BigInt(this.networkParams.gasLimit) * 110n) / 100n;
        const gasPriceBig = BigInt(this.networkParams.gasPrice);

        // C. Calculate Total Fee (Wei)
        const totalFee = gasLimitBig * gasPriceBig;

        // ============================================
        // 3. Smart Clamping Logic
        // ============================================

        let finalAmount = inputAmountAtomic;

        if (this.asset.contract) {
            // === Scenario A: ERC20 Token Transfer ===

            // 1. First check if ETH is sufficient for gas fees (Hard requirement)
            // Note: For token transfers, ETH balance must be > fee, cannot be equal, otherwise cannot pay
            if (nativeBalanceAtomic < totalFee) {
                // We could let UI handle this via isAutoDeduct hint,
                // but the underlying layer must intercept because it definitely won't send without ETH
                throw new Error("Insufficient balance to pay Gas fee");
            }

            // 2. Smartly correct token amount
            // Logic: If User Input > Token Balance, correct to Token Balance (Transfer All)
            if (finalAmount > balanceAtomic) {
                finalAmount = balanceAtomic;
            }

        } else {
            // === Scenario B: Mainnet Coin (ETH/BNB) Transfer ===

            // 1. Calculate theoretical max transfer amount = Balance - Fee
            const maxAvailable = balanceAtomic - totalFee;

            // 2. Fallback check: If not even enough for fees
            if (maxAvailable < 0n) {
                throw new Error("Insufficient balance to pay Gas fee");
            }

            // 3. Smart correction: If Input > (Balance - Fee)
            // Indicates user wants to send all, or calculated wrong, we automatically deduct Gas
            if (finalAmount > maxAvailable) {
                finalAmount = maxAvailable;
            }
        }

        // ============================================
        // 4. Data Reconstruction
        // ============================================
        // If it is a token, and amount was corrected (finalAmount != input), txData must be regenerated
        // Because txData Hex contains amount, if not corrected, on-chain execution uses old amount!
        if (this.asset.contract && finalAmount !== inputAmountAtomic) {
            txDataStr = this._generateErc20TransferData(form.to, finalAmount);
        }

        // ============================================
        // 5. Return Results
        // ============================================
        const base = {
            toAddress: form.to,
            memo: form.memo,
            amount: finalAmount.toString(), // Use corrected amount
        };

        return {
            asset: this.asset,
            txData: {
                ...base,
                nonce: this.networkParams.nonce,
                gasPrice: gasPriceBig.toString(),
                gasLimit: gasLimitBig.toString(), // Use buffered Limit
                chainId: this.networkParams.chainId,
                contractAddress: this.asset.contract,
                // Mainnet transfer payload is null, token transfer must pass reconstructed data
                payload: this.asset.contract ? txDataStr : null
            },
            mode: walletMode,
            password: password
        }
    }

    /**
     * Helper method: Generate ERC20 Transfer Hex Data
     * Only for Gas estimation, no need for complex libraries
     * @param toAddress
     * @param amountHexOrString
     * @returns {string}
     * @private
     */
    _generateErc20TransferData(toAddress, amountHexOrString) {
        // 1. Function signature transfer(address,uint256) -> a9059cbb
        const methodId = "0xa9059cbb";

        // 2. Process address (remove 0x, pad to 64 digits)
        const cleanAddress = toAddress.replace("0x", "").toLowerCase();
        const paddedAddress = cleanAddress.padStart(64, "0");

        // 3. Process amount (convert to hex, pad to 64 digits)
        let amountHex = BigInt(amountHexOrString).toString(16);
        const paddedAmount = amountHex.padStart(64, "0");

        return methodId + paddedAddress + paddedAmount;
    }
}