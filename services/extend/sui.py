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


# ==============================================================================
# SUI Official RPC API
# Endpoint: https://fullnode.mainnet.sui.io
# Docs: https://docs.sui.io/sui-jsonrpc
# ==============================================================================

def _get_sui_sem():
    """Lazy load to fetch SEM_SUI semaphore"""
    if getattr(config, 'SEM_SUI', None) is None:
        # Sui official nodes have high performance; higher concurrency is allowed.
        config.SEM_SUI = asyncio.Semaphore(10)
    return config.SEM_SUI


async def _request(method: str, params: list = None) -> Any:
    """
    Initiate SUI JSON-RPC Request
    """
    url = "https://fullnode.mainnet.sui.io"

    # SUI Standard JSON-RPC 2.0 Format
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params or []
    }

    sem = _get_sui_sem()

    async with sem:
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                # SUI strictly requires the Content-Type header
                headers = {
                    "Content-Type": "application/json"
                }
                resp = await client.post(url, json=payload, headers=headers)

                if resp.status_code >= 400:
                    print(f"[SUI Official Error] {method} -> {resp.status_code}: {resp.text}")
                    return None

                data = resp.json()

                if "error" in data:
                    print(f"[SUI RPC Error] {data['error']}")
                    return None

                return data.get("result")

            except Exception as e:
                print(f"[SUI Request Exception] {e}")
                return None


# ==============================================================================
# Business Logic Methods
# ==============================================================================

async def get_balance(chain_key: str, address: str) -> Any:
    """
    1. [Check Balance]
    RPC Method: suix_getBalance
    """
    # SUI coinType defaults to "0x2::sui::SUI"
    data = await _request("suix_getBalance", [address, "0x2::sui::SUI"])

    if not data:
        return "-0.000000"

    # Data structure: { "coinType": "...", "coinObjectCount": 3, "totalBalance": "1000000000" }
    total_balance_str = data.get("totalBalance") or None
    if total_balance_str is None:
        return "-0.000000"
    return to_standard_amount(total_balance_str, chain_key, None, True)

async def get_sui_transactions(chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]:
    """
    2. [Check Transaction History] (Optimized Parsing Version)
    """
    # Define generic query function
    async def fetch_txs(tx_filter: dict):
        query_params = {
            "filter": tx_filter,
            "options": {
                "showBalanceChanges": True, # Required to calculate amounts
                "showInput": True,          # Required to identify the sender
                "showEffects": True,
                "showTime": True
            },
            "limit": limit,
            "descendingOrder": True
        }
        return await _request("suix_queryTransactionBlocks", [query_params])

    # 1. Concurrent queries for "From" and "To" directions
    task_from = fetch_txs({"FromAddress": address})
    task_to = fetch_txs({"ToAddress": address})

    res_from, res_to = await asyncio.gather(task_from, task_to)

    # 2. Merge and de-duplicate results
    unique_txs = {}
    raw_list = []
    if res_from and "data" in res_from: raw_list.extend(res_from["data"])
    if res_to and "data" in res_to: raw_list.extend(res_to["data"])

    for tx in raw_list:
        digest = tx.get("digest")
        if digest: unique_txs[digest] = tx

    # 3. Sort by timestamp
    sorted_txs = sorted(
        unique_txs.values(),
        key=lambda x: int(x.get("timestampMs", 0)),
        reverse=True
    )
    final_txs = sorted_txs[:limit]

    # 4. Core parsing logic
    formatted = []

    for tx in final_txs:
        try:
            tx_hash = tx.get("digest")
            timestamp = int(tx.get("timestampMs", 0))

            # --- A. Identify the Sender ---
            # Path: transaction -> data -> sender
            sender = tx.get("transaction", {}).get("data", {}).get("sender", "Unknown")

            # --- B. Analyze Balance Changes ---
            balance_changes = tx.get("balanceChanges", [])

            my_change = 0
            receiver_candidates = [] # Potential recipients

            for change in balance_changes:
                # Filter by coin type (SUI only)
                if change.get("coinType") != "0x2::sui::SUI":
                    continue

                owner_address = change.get("owner", {}).get("AddressOwner")
                amount = int(change.get("amount", 0))

                # Track changes to my own address
                if owner_address == address:
                    my_change += amount

                # Identify positive changes for others (to guess the recipient)
                if amount > 0 and owner_address != address and owner_address != sender:
                    receiver_candidates.append(owner_address)

            # --- C. Determine Direction and Counterparty ---
            direction = "unknown"
            display_amount = 0
            other_addr = "Interaction" # Default value

            if my_change > 0:
                # Incoming funds
                direction = "incoming"
                display_amount = my_change
                other_addr = sender # Funds provided by the initiator

            elif my_change < 0:
                # Outgoing funds
                direction = "outgoing"
                display_amount = abs(my_change)
                # Identify recipient: take the first address receiving funds in balanceChanges
                if receiver_candidates:
                    other_addr = receiver_candidates[0]
                else:
                    # If no recipient found, it might be a burn or pure Gas consumption
                    other_addr = "Contract/Gas"

            else:
                # No balance change (Could be a signature or transaction involving other assets/NFTs)
                if sender == address:
                    direction = "outgoing"
                    # Amount is simplified to 0; actual gasUsed could be retrieved from 'effects'
                    display_amount = 0

            formatted.append({
                "txid": tx_hash,
                "from": address if direction == "outgoing" else other_addr,
                "to": other_addr if direction == "outgoing" else address,
                "value": to_standard_amount(display_amount, chain_key, contract, True),
                "timestamp": timestamp,
                "symbol": "SUI"
            })

        except Exception as e:
            print(f"[SUI Parse Error] Tx: {tx.get('digest')} - {e}")
            continue

    return formatted

async def get_sui_estimate_fee() -> Dict[str, Any]:
    """
    3. [Check Fee Rates]
    RPC Method: suix_getReferenceGasPrice
    """
    price = await _request("suix_getReferenceGasPrice", [])

    # SUI Gas Price unit is MIST (1 SUI = 10^9 MIST)
    current_price = int(price or 1000)

    return {
        "low": current_price,
        "medium": current_price,
        "high": current_price
    }

async def get_sui_utxos(chain_key: str, address: str) -> List[Dict]:
    """
    4. [Check UTXO / Coins] (Critical!)
    Sui uses an Object model. SUI Coin Objects must be retrieved to perform transfers.
    This is functionally equivalent to BTC UTXOs.
    RPC Method: suix_getCoins
    """
    # Fetch all unspent SUI Coins at once
    data = await _request("suix_getCoins", [address, "0x2::sui::SUI", None, None])
    if not data or "data" not in data:
        return []

    formatted_objects = []

    for item in data["data"]:
        # item structure: { coinType, coinObjectId, version, digest, balance, previousTransaction }

        formatted_objects.append({
            "chain": "sui-mainnet",
            "txHash": item["digest"],  # Acts like txid
            "index": 0,  # Placeholder (Sui uses Object IDs rather than indices)
            "value": to_standard_amount(item["balance"], chain_key, None, True),
            # --- Sui-specific fields required for transaction construction ---
            "objectId": item["coinObjectId"],
            "version": item["version"],
            "objectDigest": item["digest"]  # Object summary
        })

    return formatted_objects

async def broadcast_sui_transaction(signed_json_str: str) -> str:
    """
    5. [Broadcast Transaction]
    RPC Method: sui_executeTransactionBlock
    Note: Sui broadcasting requires Base64-encoded tx_bytes and a signature list.
    :param signed_json_str: JSON string from frontend
           Format: '{"txBytes": "BASE64...", "signature": "BASE64..."}'
    """
    try:
        # 1. Parse hybrid data from frontend
        payload = json.loads(signed_json_str)
        tx_bytes = payload.get("txBytes")
        signature = payload.get("signature")

        if not tx_bytes or not signature:
            print("[SUI Broadcast] Missing txBytes or signature")
            return ""

        # 2. Assemble RPC parameters
        # Param order: [tx_bytes, [signatures], options, request_type]
        params = [
            tx_bytes,      # Transaction bytes
            [signature],   # Signature list (single signature for now)
            {
                "showEffects": True
            },             # Options
            "WaitForLocalExecution"  # Wait for node confirmation
        ]

        # 3. Submit request
        data = await _request("sui_executeTransactionBlock", params)

        if data and "digest" in data:
            return data["digest"]

        print(f"[SUI Broadcast Fail] {data}")
        return ""

    except Exception as e:
        print(f"[SUI Broadcast Error] Invalid JSON or Network Error: {e}")
        return ""