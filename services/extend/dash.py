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
# DASH Official Insight API Implementation
# Base URL: https://insight.dash.org/insight-api
# ==============================================================================

def _get_dash_sem():
    """Lazy load to fetch SEM_DASH semaphore"""
    if getattr(config, 'SEM_DASH', None) is None:
        # Community-provided official node; setting to 5 to be polite/rate-limited.
        config.SEM_DASH = asyncio.Semaphore(5)
    return config.SEM_DASH


async def _request(method: str, endpoint: str, json_data: dict = None, params: dict = None) -> Any:
    """
    Initiate DASH Insight API Request
    """
    # Standard DASH community API address
    base_url = "https://insight.dash.org/insight-api"
    url = f"{base_url}{endpoint}"

    sem = _get_dash_sem()

    async with sem:
        async with httpx.AsyncClient(timeout=20.0) as client:
            try:
                if method.upper() == "GET":
                    resp = await client.get(url, params=params)
                else:
                    # Insight broadcasting uses POST; data is typically JSON or Form-encoded.
                    resp = await client.post(url, json=json_data)

                if resp.status_code >= 400:
                    print(f"[DASH Official Error] {method} {url} -> {resp.status_code}: {resp.text}")
                    return None

                # Some Insight endpoints return raw strings (e.g., fee rates), others return JSON.
                try:
                    return resp.json()
                except:
                    return resp.text

            except Exception as e:
                print(f"[DASH Request Exception] {url}: {e}")
                return None


# ==============================================================================
# Business Logic Methods
# ==============================================================================

async def get_balance(chain_key: str, address: str) -> Dict[str, Any]:
    """
    Fetch Balance
    Insight Endpoint: /addr/{address}
    """
    data = await _request("GET", f"/addr/{address}")

    if not data:
        return {
            "balance": "0"
        }

    # Insight provides comprehensive fields:
    # balance: DASH amount (float)
    # balanceSat: Satoshi amount (integer)
    # unconfirmedBalance: DASH amount
    # unconfirmedBalanceSat: Satoshi amount

    confirmed_sats = int(data.get("balanceSat", 0))
    unconfirmed_sats = int(data.get("unconfirmedBalanceSat", 0))

    total_sats = confirmed_sats + unconfirmed_sats
    if total_sats < 0:
        total_sats = 0

    return {
        # Reuse utility to convert Satoshis to standard units
        "balance": to_standard_amount(total_sats, "dash", None, True)
    }


async def get_dash_transactions(chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]:
    """
    Fetch Transaction Records
    Insight Endpoint: /txs/?address={address}
    """
    # Insight uses 'pageNum' for pagination; for simplicity, we fetch the first page (usually last 10 txs).
    data = await _request("GET", "/txs", params={
        "address": address
    })

    if not data or "txs" not in data:
        return []

    formatted = []

    for tx in data["txs"]:
        tx_hash = tx.get("txid")
        timestamp = int(tx.get("time", 0)) * 1000  # Seconds -> Milliseconds

        # Insight's valueOut and valueIn are pre-calculated (Unit: DASH).
        # We convert to Satoshis or "atomics" to maintain consistency with to_standard_amount.

        # Determine flow direction
        direction = "incoming"
        actual_amount_dash = 0.0
        other_addr = "Unknown"

        is_sender = False
        input_total = 0.0

        # Check vin (Inputs)
        for vin in tx.get("vin", []):
            if vin.get("addr") == address:
                is_sender = True
                input_total += float(vin.get("value", 0))

        if is_sender:
            direction = "outgoing"
            # Change logic: If the output contains my address, it is a "change" output.
            output_to_me = 0.0
            output_to_other = 0.0
            dest_candidates = []

            for vout in tx.get("vout", []):
                # scriptPubKey.addresses is an array of strings
                addrs = vout.get("scriptPubKey", {}).get("addresses", [])
                val = float(vout.get("value", 0))

                if address in addrs:
                    output_to_me += val
                else:
                    output_to_other += val
                    if addrs:
                        dest_candidates.append(addrs[0])

            # Actual amount sent = money sent to others
            # (Displays net transfer to others, ignoring fee consumption)
            actual_amount_dash = output_to_other
            other_addr = dest_candidates[0] if dest_candidates else "Unknown"

        else:
            direction = "incoming"
            # Money I received
            for vout in tx.get("vout", []):
                addrs = vout.get("scriptPubKey", {}).get("addresses", [])
                if address in addrs:
                    actual_amount_dash += float(vout.get("value", 0))

            # Source address
            if tx.get("vin"):
                other_addr = tx["vin"][0].get("addr", "Unknown")

        # Convert DASH float (e.g., 1.2 DASH) to Satoshis for standard formatting
        actual_sats = int(round(actual_amount_dash * 100000000))

        formatted.append({
            "txid": tx_hash,
            "from": address if direction == "outgoing" else other_addr,
            "to": other_addr if direction == "outgoing" else address,
            "value": to_standard_amount(actual_sats, chain_key, contract, True),
            "timestamp": timestamp,
            "symbol": "DASH",
        })

    return formatted

async def get_dash_utxos(chain_key: str, address: str) -> List[Dict]:
    """
    Fetch UTXOs (Unspent Transaction Outputs)
    Insight Endpoint: /addr/{address}/utxo
    Key feature: Insight returns scriptPubKey directly.
    """
    data = await _request("GET", f"/addr/{address}/utxo")

    if not data or not isinstance(data, list):
        return []

    formatted_utxos = []

    for item in data:
        # Insight fields: address, txid, vout, scriptPubKey, amount (DASH), satoshis

        formatted_utxos.append({
            "txHash": item["txid"],
            "index": item["vout"],
            "value": to_standard_amount(str(item["satoshis"]), chain_key, None, True),
            "script": item["scriptPubKey"]
        })

    return formatted_utxos


async def broadcast_dash_transaction(signed_hex: str) -> str:
    """
    Broadcast Transaction
    Insight Endpoint: POST /tx/send
    Body: { "rawtx": "HEX..." }
    """
    # 1. Double-check to remove the '0x' prefix for Bitcoin-style networks
    if signed_hex.startswith("0x") or signed_hex.startswith("0X"):
        signed_hex = signed_hex[2:]

    # 2. Initiate broadcast
    payload = {
        "rawtx": signed_hex
    }
    data = await _request("POST", "/tx/send", json_data=payload)

    # Success returns: { "txid": "..." }
    if data and isinstance(data, dict) and "txid" in data:
        return data["txid"]

    # Error handling
    # Insight usually returns raw text or a JSON error object on failure.
    print(f"[DASH Broadcast Fail] {data}")
    return ""