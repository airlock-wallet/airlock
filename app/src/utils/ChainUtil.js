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

// 1. EVM Compatible Chains (EVM Model)
// Definition: Must request nonce (eth_getTransactionCount), gasPrice (eth_gasPrice), chainId (eth_chainId) before transaction
// Includes standard Ethereum and its sidechains, Layer2, etc.
const EVM_CHAINS = [
    "Ethereum",
    "Kava",
    "Theta",
    "Vechain",
    "Ronin",
];

// 2. UTXO Model Chains (UTXO Model)
// Definition: Transaction structure is completely different, must fetch UTXOs array from node as inputs first
const UTXO_CHAINS = [
    "Bitcoin",
    "BitcoinCash",
    "Zcash",
    "Decred",
    "Groestlcoin",
    "Komodo"
];

// 3. Chains requiring Memo/Tag (Memo Supported)
// Definition: Supports or enforces Memo/Destination Tag during transaction
// Includes the 4 you specified, and adds other common Memo chains (can be trimmed if strict adherence to your list is required)
const MEMO_CHAINS = [
    "Ripple",           // Destination Tag
    "Stellar",          // Memo
    "Solana",           // Memo
    "EOS",              // Memo
    "Cosmos",           // Memo
    "Binance",          // BNB Beacon Chain (Memo)
    "Kava",             // Cosmos SDK based (Memo)
    "Terra",            // Memo
    "BandChain",        // Memo
    "IOST",             // Memo
    "NEM",              // Message
    "Algorand",         // Note
    "Hedera",           // Memo
    "TheOpenNetwork"    // Comment (Note: Your previous records mentioned TON, which usually also requires Comment/Memo)
];

/**
 * Helper Functions: Judgment Logic
 */
export const isEVM = (blockchain) => EVM_CHAINS.includes(blockchain);
export const isUTXO = (blockchain) => UTXO_CHAINS.includes(blockchain);
export const isMemoSupported = (blockchain) => MEMO_CHAINS.includes(blockchain);

// Account, Main Coin Icon Mapping
export const ACCOUNT_ICON_MAP = {
    'arbitrum': 'etharbitrum.svg',
};
// Main Coin Name Mapping
export const MAIN_COIN_NAME_MAP = {
    'Arbitrum': 'Ethereum',
}
// Token Name Mapping
export const TOKEN_COIN_NAME_MAP = {}