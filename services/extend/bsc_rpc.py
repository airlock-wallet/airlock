# Copyright (C) 2026 Le Wang
#
# This file is part of Airlock.
#
# Airlock is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# Airlock is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with Airlock.  If not, see <https://www.gnu.org/licenses/>.

import httpx
import asyncio
from typing import Dict, Any, Optional, List
from core import config
from core.utils import to_standard_amount
from services.registry_service import registry_service

# ==============================================================================
# BSC Native RPC Service (Binance Smart Chain)
# Uses direct connection to official nodes to bypass BscScan API limitations
# ==============================================================================

# Official BSC Stable Nodes (Global Acceleration)
BSC_RPC_URL = "https://bsc-dataseed.binance.org"
# BscScan API (Used only for transaction history; failures can be ignored)
BSCSCAN_API_URL = "https://api.bscscan.com/api"


def _get_rpc_sem():
    """RPC Concurrency Control"""
    if getattr(config, 'SEM_BSC_RPC', None) is None:
        # Official nodes are robust; higher concurrency is permitted.
        config.SEM_BSC_RPC = asyncio.Semaphore(10)
    return config.SEM_BSC_RPC


async def _rpc_post(method: str, params: List[Any]) -> Any:
    """
    General JSON-RPC Request Wrapper
    """
    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1
    }

    sem = _get_rpc_sem()
    async with sem:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.post(BSC_RPC_URL, json=payload)
                if resp.status_code >= 400:
                    print(f"[BSC RPC Error] HTTP {resp.status_code}")
                    return None

                data = resp.json()
                if "error" in data:
                    print(f"[BSC RPC Protocol Error] {data['error']}")
                    return None

                return data.get("result")
            except Exception as e:
                print(f"[BSC RPC Exception] {e}")
                return None


# ==============================================================================
# Core Business Logic (RPC Implementation)
# ==============================================================================

async def get_balance(chain_key: str, address: str, contract: Optional[str] = None) -> Any:
    """
    Fetch Balance - Pure RPC Implementation
    """
    # 1. Fetch BNB Balance
    if not contract:
        # eth_getBalance
        hex_val = await _rpc_post("eth_getBalance", [address, "latest"])
        if hex_val is None:
            return "-0.000000"

        val_int = int(hex_val, 16)
        return to_standard_amount(val_int, chain_key, None, True)

    # 2. Fetch BEP20 Token Balance
    else:
        # Manually construct balanceOf(address) call
        # Function Signature: 0x70a08231
        # Params: Address stripped of '0x', padded to 64 characters
        clean_addr = address.lower().replace("0x", "").rjust(64, "0")
        data_payload = "0x70a08231" + clean_addr

        call_params = {
            "to": contract,
            "data": data_payload
        }

        # eth_call
        hex_val = await _rpc_post("eth_call", [call_params, "latest"])

        if not hex_val or hex_val == "0x":
            return "-0.000000"

        val_int = int(hex_val, 16)
        return to_standard_amount(val_int, chain_key, contract, True)


async def get_nonce(chain_key: str, address: str) -> int:
    """
    Fetch Nonce - Pure RPC Implementation
    Uses 'pending' tag to ensure sequential transactions are not blocked
    """
    hex_val = await _rpc_post("eth_getTransactionCount", [address, "pending"])
    if hex_val:
        return int(hex_val, 16)
    return 0


async def get_estimate_gas(chain_key: str, address: str = None, contract: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch Fee Rates - Pure RPC Implementation
    """
    # 1. Get current Gas Price
    hex_price = await _rpc_post("eth_gasPrice", [])

    # BSC defaults to a minimum of 3 Gwei (3,000,000,000 Wei)
    # to prevent transactions from getting stuck if nodes return values that are too low.
    min_gas_price = 3000000000
    current_price = int(hex_price, 16) if hex_price else min_gas_price

    final_price = max(current_price, min_gas_price)

    # 2. Determine Gas Limit (Heuristic/Empirical values)
    # Compared to eth_estimateGas, empirical values are more stable on BSC
    # and do not require sending simulation requests.
    safe_limit = 21000
    if contract:
        safe_limit = 100000  # BEP20 transfers usually cost 40k-60k; 100k is safe.

    return {
        "gasPrice": str(final_price),
        "gasLimit": str(safe_limit)
    }


async def broadcast_transaction(chain_key: str, signed_hex: str) -> str:
    """
    Broadcast Transaction - Pure RPC Implementation
    """
    if not signed_hex.startswith("0x"):
        signed_hex = "0x" + signed_hex

    # eth_sendRawTransaction
    tx_hash = await _rpc_post("eth_sendRawTransaction", [signed_hex])

    if tx_hash and isinstance(tx_hash, str) and tx_hash.startswith("0x"):
        return tx_hash

    print(f"[BSC Broadcast Fail] RPC returned: {tx_hash}")
    return ""


# ==============================================================================
# Transaction History (API Dependent)
# ==============================================================================

async def get_transactions(chain_key: str, address: str, contract: Optional[str] = None, limit: int = 20) -> List[Dict]:
    """
    Fetch Transaction History
    BSC requires the BscScan API as RPC nodes do not support history queries by address.
    """
    # 1. Base parameters
    params = {
        "module": "account",
        "address": address,
        "page": 1,
        "offset": limit,
        "sort": "desc",
        "startblock": 0,         # Critical: Must specify starting block
        "endblock": 99999999,    # Critical: Must specify ending block
        "apikey": getattr(config, "BSCSCAN_API_KEY", "")  # Ensure Key exists
    }

    # 2. Differentiate between Native BNB and Tokens
    if not contract:
        # Query Native BNB transactions (includes standard transfers + contract calls)
        params["action"] = "txlist"
    else:
        # Query BEP20 Token transfers
        params["action"] = "tokentx"
        params["contractaddress"] = contract

    # 3. Initiate request
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            # Debug info (useful for monitoring request parameters)
            # print(f"[BSC History] Requesting {params['action']} for {address[:6]}...")

            resp = await client.get(BSCSCAN_API_URL, params=params)

            if resp.status_code >= 400:
                print(f"[BSC History Error] HTTP {resp.status_code}")
                return []

            data = resp.json()

            # BscScan status "1" indicates success.
            # Status "0" with message "No transactions found" indicates no records (normal).
            if data.get("status") == "0" and data.get("message") == "No transactions found":
                return []

            if data.get("status") == "1" and isinstance(data.get("result"), list):
                tx_list = data["result"]
                formatted = []

                # Fetch symbol info
                coin_info = registry_service.get_coin_info(chain_key)
                symbol_default = coin_info.get("symbol", "BNB") if coin_info else "BNB"
                if contract:
                    # For tokens, prioritize tokenSymbol returned by API; otherwise use default.
                    symbol_default = "BEP20"

                for tx in tx_list:
                    # Filter out failed transactions (optional; remove to see error records)
                    if tx.get("isError") == "1":
                        continue

                    # Get amount
                    val_wei = tx.get("value", "0")

                    # Get token symbol (tokentx endpoint usually returns tokenSymbol)
                    tx_symbol = tx.get("tokenSymbol", symbol_default)

                    formatted.append({
                        "txid": tx.get("hash"),
                        "from": tx.get("from"),
                        "to": tx.get("to"),
                        "value": to_standard_amount(val_wei, chain_key, contract, True),
                        "timestamp": int(tx.get("timeStamp", 0)) * 1000,
                        "symbol": tx_symbol,
                    })
                return formatted

            # Other failure cases
            if data.get("status") == "0":
                print(f"[BSC History Fail] API Message: {data.get('message')}")

        except Exception as e:
            print(f"[BSC History Exception] {e}")

    return []