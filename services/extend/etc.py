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


# ==============================================================================
# ETC Community API
# RPC: https://etc.rivet.link (Used for balance, broadcast, and passthrough for getEvmParams)
# History: https://etc.blockscout.com/api (Used for transaction records)
# ==============================================================================

def _get_etc_sem():
    """Lazy load to fetch SEM_ETC semaphore"""
    if getattr(config, 'SEM_ETC', None) is None:
        # ETC RPC is relatively fast; higher concurrency is permitted.
        config.SEM_ETC = asyncio.Semaphore(10)
    return config.SEM_ETC


async def _request(method: str, endpoint: str, json_data: dict = None, params: dict = None) -> Any:
    """
    Initiate ETC API request (Compatible with both RPC and Blockscout)
    """
    # Default RPC Node
    base_url = "https://etc.rivet.link"

    # Use endpoint directly if it is a full Blockscout URL
    if endpoint.startswith("http"):
        url = endpoint
    else:
        url = f"{base_url}{endpoint}"

    sem = _get_etc_sem()

    # Enable follow_redirects=True to handle Blockscout 301 redirects
    async with sem:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            try:
                if method.upper() == "GET":
                    resp = await client.get(url, params=params)
                else:
                    resp = await client.post(url, json=json_data)

                if resp.status_code >= 400:
                    print(f"[ETC Official Error] {method} {url} -> {resp.status_code}: {resp.text}")
                    return None

                data = resp.json()

                # 1. Handle RPC responses (containing jsonrpc field)
                # Return data directly without extracting 'result' to allow frontend error handling via 'error' field.
                if "jsonrpc" in data:
                    return data

                # 2. Handle Blockscout responses
                return data

            except Exception as e:
                print(f"[ETC Request Exception] {url}: {e}")
                return None


# ==============================================================================
# Business Logic Methods
# ==============================================================================


async def get_nonce(chain_key: str, address: str) -> int:
    """
    1.1 [Fetch Nonce]
    Used for transaction construction to prevent replay attacks.
    RPC Method: eth_getTransactionCount
    """
    payload = {
        "jsonrpc": "2.0",
        "method": "eth_getTransactionCount",
        "params": [address, "latest"],
        "id": 1
    }

    data = await _request("POST", "", json_data=payload)

    if data and "result" in data:
        return int(data["result"], 16)

    return 0


async def get_estimate_gas(chain_key: str, address: str = None, contract: Optional[str] = None) -> Dict[str, Any]:
    """
    3. [Fetch/Estimate Fee Rates]
    Retrieves Gas Price and provides a recommended Gas Limit.
    """
    # 1. Retrieve Gas Price
    payload = {
        "jsonrpc": "2.0",
        "method": "eth_gasPrice",
        "params": [],
        "id": 1
    }

    data = await _request("POST", "", json_data=payload)

    # Default to 1 Gwei
    gas_price = 1000000000
    if data and "result" in data:
        gas_price = int(data["result"], 16)

    # 2. Recommended Gas Limit (Heuristic)
    # ETC is similar to ETH: 21,000 for standard transfers, 100,000 buffer for tokens.
    safe_limit = 21000
    if contract:
        safe_limit = 100000

    return {
        "gasPrice": str(gas_price),
        "gasLimit": str(safe_limit)
    }


async def get_balance(chain_key: str, address: str) -> Dict[str, Any]:
    """
    Fetch Balance
    RPC Method: eth_getBalance
    """
    payload = {
        "jsonrpc": "2.0",
        "method": "eth_getBalance",
        "params": [address, "latest"],
        "id": 1
    }

    data = await _request("POST", "", json_data=payload)
    balance_val = "-0.000000"
    if data and "result" in data:
        # Hex -> Int -> Standard String
        wei = int(data["result"], 16)
        balance_val = to_standard_amount(wei, chain_key, None, True)

    return {"balance": balance_val}


async def get_etc_transactions(chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]:
    """
    Fetch Transaction Records
    Blockscout API: https://etc.blockscout.com/api
    """
    # Standard parameters for Blockscout/Etherscan
    params = {
        "module": "account",
        "action": "txlist",
        "address": address,
        "startblock": 0,
        "endblock": 99999999,
        "sort": "desc",
        "offset": limit,
        "page": 1
    }

    data = await _request("GET", "https://etc.blockscout.com/api", params=params)

    # Validate Blockscout response format
    if not data or "result" not in data or not isinstance(data["result"], list):
        return []

    formatted = []
    my_addr = address.lower()

    for tx in data["result"]:
        # Blockscout occasionally returns pending transactions; filter those without a hash.
        if not tx.get("hash"):
            continue

        tx_hash = tx.get("hash")
        timestamp = int(tx.get("timeStamp", 0)) * 1000
        value_wei = int(tx.get("value", 0))

        from_addr = tx.get("from", "").lower()
        to_addr = tx.get("to", "").lower()

        # Determine flow direction
        direction = "incoming"
        other_addr = from_addr

        if from_addr == my_addr:
            direction = "outgoing"
            other_addr = to_addr

        formatted.append({
            "txid": tx_hash,
            "from": from_addr,
            "to": to_addr,
            "value": to_standard_amount(value_wei, chain_key, contract, True),
            "timestamp": timestamp,
            "symbol": "ETC",
        })

    return formatted


async def get_etc_estimate_fee() -> Dict[str, Any]:
    """
    Fetch Fee Rates (Gas Price)
    Used only for UI "Slow/Medium/Fast" display.
    The actual GasPrice used for signing is retrieved via getEvmParams on the frontend.
    """
    payload = {
        "jsonrpc": "2.0",
        "method": "eth_gasPrice",
        "params": [],
        "id": 1
    }

    data = await _request("POST", "", json_data=payload)

    # Default to 1 Gwei
    default_price = 1000000000
    current_wei = default_price

    if data and "result" in data:
        current_wei = int(data["result"], 16)

    # ETC follows the Legacy gas model; return simple multiplier suggestions.
    return {
        "low": current_wei,
        "medium": int(current_wei * 1.1),
        "high": int(current_wei * 1.2),
        "desc": "Standard Gas Price"
    }

async def broadcast_etc_transaction(signed_hex: str) -> str:
    """
    Broadcast Transaction
    RPC Method: eth_sendRawTransaction
    """
    # Auto-prepend 0x if missing
    if not signed_hex.startswith("0x") and not signed_hex.startswith("0X"):
        signed_hex = "0x" + signed_hex

    payload = {
        "jsonrpc": "2.0",
        "method": "eth_sendRawTransaction",
        "params": [signed_hex],
        "id": 1
    }

    data = await _request("POST", "", json_data=payload)

    if data and "result" in data:
        return data["result"]

    # Log error (data usually contains an 'error' field)
    print(f"[ETC Broadcast Fail] {data}")
    return ""