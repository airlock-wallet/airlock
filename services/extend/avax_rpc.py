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
# Avalanche C-Chain Service (RPC + Routescan API)
# Core: Uses Official RPC (https://api.avax.network/ext/bc/C/rpc)
# History: Uses Routescan (Etherscan-compatible format)
# ==============================================================================

# Official Avalanche C-Chain RPC
AVAX_RPC_URL = "https://api.avax.network/ext/bc/C/rpc"

# Avalanche Etherscan-Compatible API provided by Routescan (Free & No Key Required)
# This is an excellent alternative as it maintains the legacy module=account&action=txlist format
HISTORY_API_URL = "https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api"


def _get_rpc_sem():
    """RPC Concurrency Control"""
    if getattr(config, 'SEM_AVAX_RPC', None) is None:
        config.SEM_AVAX_RPC = asyncio.Semaphore(10)
    return config.SEM_AVAX_RPC


async def _rpc_post(method: str, params: List[Any]) -> Any:
    """General JSON-RPC Request Wrapper"""
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
                # AVAX RPC requires POST method
                resp = await client.post(AVAX_RPC_URL, json=payload)
                if resp.status_code >= 400:
                    print(f"[AVAX RPC Error] HTTP {resp.status_code}")
                    return None

                data = resp.json()
                if "error" in data:
                    print(f"[AVAX RPC Protocol Error] {data['error']}")
                    return None

                return data.get("result")
            except Exception as e:
                print(f"[AVAX RPC Exception] {e}")
                return None


# ==============================================================================
# Core Business Logic (Pure RPC Implementation - Highly Stable)
# ==============================================================================

async def get_balance(chain_key: str, address: str, contract: Optional[str] = None) -> Any:
    """Fetch Balance - Pure RPC"""
    if not contract:
        # Native AVAX Balance
        hex_val = await _rpc_post("eth_getBalance", [address, "latest"])
        if hex_val is None:
            return "-0.000000"
        val_int = int(hex_val, 16)
        return to_standard_amount(val_int, chain_key, None, True)
    else:
        # ARC20 Token Balance (via eth_call)
        # Construct balanceOf(address) call
        clean_addr = address.lower().replace("0x", "").rjust(64, "0")
        data_payload = "0x70a08231" + clean_addr
        call_params = {
            "to": contract,
            "data": data_payload
        }

        hex_val = await _rpc_post("eth_call", [call_params, "latest"])
        if not hex_val or hex_val == "0x":
            return "-0.000000"

        val_int = int(hex_val, 16)
        return to_standard_amount(val_int, chain_key, contract, True)


async def get_nonce(chain_key: str, address: str) -> int:
    """Fetch Nonce - Pure RPC (Pending tag)"""
    hex_val = await _rpc_post("eth_getTransactionCount", [address, "pending"])
    if hex_val:
        return int(hex_val, 16)
    return 0


async def get_estimate_gas(chain_key: str, address: str = None, contract: Optional[str] = None) -> Dict[str, Any]:
    """Fetch Gas Rates - Pure RPC"""
    # 1. Fetch Gas Price
    hex_price = await _rpc_post("eth_gasPrice", [])

    # AVAX dynamic fees are typically around 25-30 nAVAX
    # Setting a floor/minimum of 25 Gwei (25,000,000,000 Wei) for safety
    min_price = 25000000000
    current_price = int(hex_price, 16) if hex_price else min_price
    final_price = max(current_price, min_price)

    # 2. Determine Gas Limit
    # C-Chain calculations are identical to ETH; using a standard safe value
    safe_limit = 21000
    if contract:
        safe_limit = 100000  # Token transfer limit

    return {
        "gasPrice": str(final_price),
        "gasLimit": str(safe_limit)
    }


async def broadcast_transaction(chain_key: str, signed_hex: str) -> str:
    """Broadcast Transaction - Pure RPC"""
    if not signed_hex.startswith("0x"):
        signed_hex = "0x" + signed_hex

    tx_hash = await _rpc_post("eth_sendRawTransaction", [signed_hex])

    if tx_hash and isinstance(tx_hash, str) and tx_hash.startswith("0x"):
        return tx_hash

    print(f"[AVAX Broadcast Fail] RPC returned: {tx_hash}")
    return ""


# ==============================================================================
# Transaction History (Using Routescan-compatible API)
# ==============================================================================

async def get_transactions(chain_key: str, address: str, contract: Optional[str] = None, limit: int = 20) -> List[Dict]:
    """
    Fetch Transaction History
    Note: Uses Routescan's Etherscan-compatible interface. No Key required,
    and the format is identical to Etherscan.
    """
    params = {
        "module": "account",
        "action": "txlist" if not contract else "tokentx",
        "address": address,
        "page": 1,
        "offset": limit,
        "sort": "desc",
        "startblock": 0,
        "endblock": 99999999
    }

    if contract:
        params["contractaddress"] = contract

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            # Routescan may have Rate Limits, but they are more generous than Etherscan's free tier
            resp = await client.get(HISTORY_API_URL, params=params)
            data = resp.json()

            if data.get("message") == "No transactions found":
                return []

            if data.get("status") == "1" and isinstance(data.get("result"), list):
                tx_list = data["result"]
                formatted = []

                coin_info = registry_service.get_coin_info(chain_key)
                symbol_default = coin_info.get("symbol", "AVAX") if coin_info else "AVAX"
                if contract:
                    symbol_default = "ARC20"

                for tx in tx_list:
                    if tx.get("isError") == "1":
                        continue

                    # Handle possible negative signs in results
                    val_wei = tx.get("value", "0").replace("-", "")

                    formatted.append({
                        "txid": tx.get("hash"),
                        "from": tx.get("from"),
                        "to": tx.get("to"),
                        "value": to_standard_amount(val_wei, chain_key, contract, True),
                        "timestamp": int(tx.get("timeStamp", 0)) * 1000,
                        "symbol": tx.get("tokenSymbol", symbol_default),
                    })
                return formatted
        except Exception as e:
            print(f"[AVAX History Fail] {e}")

    return []