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

import { isEVM, isUTXO } from "src/utils/ChainUtil";
import EvmStrategy from "src/services/tx/EvmStrategy";
import UtxoStrategy from "src/services/tx/UtxoStrategy";
import TronStrategy from "src/services/tx/TronStrategy";
import TonStrategy from "src/services/tx/TonStrategy.js";
import SolStrategy from "src/services/tx/SolStrategy.js";
import XrpStrategy from "src/services/tx/XrpStrategy.js";
import SuiStrategy from "src/services/tx/SuiStrategy.js";

export default class TxStrategyFactory {
    /**
     * Returns the corresponding strategy instance based on asset type
     * @param {object} asset Asset object
     * @param {object} chainStore Pinia Store
     * @returns {TxStrategy}
     */
    static getStrategy(asset, chainStore) {
        if (isEVM(asset.blockchain)) {
            return new EvmStrategy(asset, chainStore);
        }
        else if (isUTXO(asset.blockchain)) {
            return new UtxoStrategy(asset, chainStore);
        }
        else if (asset.coin === 'tron') {
            return new TronStrategy(asset, chainStore);
        }
        else if (asset.coin === 'ton') {
            return new TonStrategy(asset, chainStore);
        }
        else if (asset.coin === 'solana') {
            return new SolStrategy(asset, chainStore);
        }
        else if (asset.coin === 'ripple') {
            return new XrpStrategy(asset, chainStore);
        }
        else if (asset.coin === 'sui') {
            return new SuiStrategy(asset, chainStore);
        }
        else {
            // Can be extended here
            throw new Error(`Chain not supported yet: ${asset.blockchain}`);
        }
    }
}