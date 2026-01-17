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
import json
from typing import Dict, Any, Optional, List
from core import config
from core.utils import to_standard_amount
from services.registry_service import registry_service


# ==============================================================================
# Generic EVM Service (Pure Etherscan V2 Implementation)
# Base URL: https://api.etherscan.io/v2/api
# Logic: Dynamic ChainID from Registry + Etherscan API (POST Supported)
# ==============================================================================

def _get_etherscan_sem():
    """Lazy load to fetch SEM_ETHERSCAN semaphore"""
    if getattr(config, 'SEM_ETHERSCAN', None) is None:
        # Free Tier API limits are strict; a value of 5 is recommended.
        config.SEM_ETHERSCAN = asyncio.Semaphore(5)
    return config.SEM_ETHERSCAN


async def _request(chain_key: str, params: Dict[str, Any]) -> Any:
    """
    Etherscan V2 General Request Wrapper
    """
    base_url = config.ETHERSCAN_base_url

    # 1. Retrieve Chain ID from Registry
    coin_info = registry_service.get_coin_info(chain_key)
    if not coin_info:
        print(f"[EVM Service] Coin not found: {chain_key}")
        return None

    chain_id = coin_info.get("chainId")
    if not chain_id:
        print(f"[EVM Service] ChainId missing: {chain_key}")
        return None

    # 2. Inject Common Parameters
    final_params = {
        "chainid": str(chain_id),
        "apikey": config.ETHERSCAN_API_KEY_MAINNET,
        **params
    }

    sem = _get_etherscan_sem()

    async with sem:
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.get(base_url, params=final_params)

                if resp.status_code >= 400:
                    print(f"[Etherscan Error] {chain_key} {resp.status_code}")
                    return None

                data = resp.json()

                # --- Unified Response Handling ---

                # Case A: Standard API (e.g., 'account' module)
                if "status" in data:
                    if data["status"] == "1":
                        return data["result"]
                    elif data["message"] == "No transactions found":
                        return []
                    else:
                        # Certain failures do not require logging (e.g., empty address history)
                        return None

                # Case B: Proxy API (e.g., 'eth_sendRawTransaction')
                if "jsonrpc" in data:
                    if "error" in data:
                        print(f"[Etherscan Proxy Error] {chain_key}: {data['error']}")
                        return None
                    return data.get("result")

                return data

            except Exception as e:
                print(f"[Etherscan Ex] {chain_key}: {e}")
                return None


def is_support(chain_key: str) -> bool:
    support = [
        'ethereum',
        'arbitrum',
        'arbitrumnova',
        'polygon',
    ]
    return chain_key in support


# ==============================================================================
# Business Logic Methods (Pure Etherscan Implementation)
# ==============================================================================

async def get_balance(chain_key: str, address: str, contract: Optional[str] = None) -> Any:
    """
    Fetch Account Balance
    """
    if not contract:
        # Native Asset
        data = await _request(chain_key, {
            "module": "account",
            "action": "balance",
            "address": address,
            "tag": "latest"
        })
        if not data:
            return "-0.000000"
        return to_standard_amount(data, chain_key, None, True)
    else:
        # ERC20 Token
        data = await _request(chain_key, {
            "module": "account",
            "action": "tokenbalance",
            "contractaddress": contract,
            "address": address,
            "tag": "latest"
        })
        if not data:
            return "-0.000000"
        return to_standard_amount(data, chain_key, contract, True)


async def get_nonce(chain_key: str, address: str) -> int:
    """
    Fetch Transaction Nonce
    """
    hex_nonce = await _request(chain_key, {
        "module": "proxy",
        "action": "eth_getTransactionCount",
        "address": address,
        "tag": "pending"
    })
    if not hex_nonce:
        return 0
    return int(hex_nonce, 16)


async def get_transactions(chain_key: str, address: str, contract: Optional[str] = None, limit: int = 20) -> List[Dict]:
    """
    Fetch Transaction History
    """
    params = {
        "module": "account",
        "address": address,
        "page": 1,
        "offset": limit,
        "sort": "desc"
    }

    coin_info = registry_service.get_coin_info(chain_key)
    symbol_default = coin_info.get("symbol", "ETH") if coin_info else "ETH"

    if not contract:
        params["action"] = "txlist"
    else:
        params["action"] = "tokentx"
        params["contractaddress"] = contract
        symbol_default = "ERC20"

    tx_list = await _request(chain_key, params)

    if not isinstance(tx_list, list):
        return []

    formatted = []
    for tx in tx_list:
        try:
            val_wei = tx.get("value", "0")

            # Determine Direction
            direction = "incoming"
            if tx.get("from", "").lower() == address.lower():
                direction = "outgoing"

            # Determine Transaction Status
            status = 1
            if tx.get("isError") == "1" or tx.get("txreceipt_status") == "0":
                status = 0

            formatted.append({
                "txid": tx.get("hash"),
                "from": tx.get("from"),
                "to": tx.get("to"),
                "value": to_standard_amount(val_wei, chain_key, contract, True),
                "timestamp": int(tx.get("timeStamp", 0)) * 1000,
                "symbol": tx.get("tokenSymbol", symbol_default),
                "status": status,
                "gasUsed": tx.get("gasUsed"),
                "gasPrice": tx.get("gasPrice")
            })
        except:
            continue

    return formatted


async def get_estimate_gas(chain_key: str, address: str = None, contract: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch / Estimate Gas Fee Rates
    """
    # 1. Fetch Current Gas Price
    gas_price_hex = await _request(chain_key, {
        "module": "proxy",
        "action": "eth_gasPrice"
    })
    gas_price = int(gas_price_hex, 16) if gas_price_hex else 2000000000

    # 2. Suggested Gas Limit
    # (Etherscan Proxy endpoints are not ideal for eth_estimateGas;
    # using heuristic/empirical values for stability)
    safe_limit = 21000

    if contract:
        safe_limit = 100000  # Generic ERC20 transfer
    else:
        # L2 Native Transfer Buffers (Arbitrum, Optimism, Base, etc.)
        if chain_key in ["arbitrum", "optimism", "base", "scroll", "linea", "blast"]:
            safe_limit = 600000
        else:
            safe_limit = 21000

    return {
        "gasPrice": str(gas_price),
        "gasLimit": str(safe_limit)
    }


async def broadcast_transaction(chain_key: str, signed_hex: str) -> str:
    """
    Broadcast Transaction to Network
    """
    if not signed_hex.startswith("0x"):
        signed_hex = "0x" + signed_hex

    tx_hash = await _request(chain_key, {
        "module": "proxy",
        "action": "eth_sendRawTransaction",
        "hex": signed_hex
    })

    if tx_hash and isinstance(tx_hash, str) and tx_hash.startswith("0x"):
        return tx_hash

    print(f"[{chain_key} Broadcast Fail] {tx_hash}")
    return ""