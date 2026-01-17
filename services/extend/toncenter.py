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


def _get_ton_sem():
    """Lazy load to fetch SEM_TON semaphore"""
    # Ensure this variable exists in config. If not, add 'SEM_TON = None' in core/config.py
    if getattr(config, 'SEM_TON', None) is None:
        config.SEM_TON = asyncio.Semaphore(5)
    return config.SEM_TON


async def _request(method: str, url: str, json_data: dict = None, params: dict = None) -> Any:
    """
    Initiate Toncenter API request (General wrapper)
    """
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": config.TON_API_KEY_MAINNET
    }
    sem = _get_ton_sem()

    async with sem:
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                # Toncenter API frequently returns 429 or 502;
                # Retries should be handled at the business logic layer.
                resp = await client.request(method, url, headers=headers, json=json_data, params=params)

                if resp.status_code >= 400:
                    print(f"[Toncenter Error] {method} {url} -> {resp.status_code}: {resp.text}")

                # Even with 200 OK, the body might contain {"ok": false}
                resp.raise_for_status()
                data = resp.json()

                if not data.get("ok", False):
                    print(f"[Toncenter Logic Error] {url} -> {data.get('error')}")
                    return None

                return data["result"]

            except Exception as e:
                print(f"[Toncenter Request Exception] {url}: {e}")
                return None


async def get_ton_account(address: str) -> Dict[str, Any]:
    """
    Asynchronously fetch full TON account information (Cleaned data)
    Includes: Balance, Status, Seqno, and Deployment status
    :param address: Wallet address (EQ... or UQ...)
    """
    default_res = {
        "seqno": 0,
        "is_deployed": False,
        "balance": "0",
        "estimated_fee": "0.01"
    }

    # 1. Fetch basic information
    info_url = f"{config.TONCENTER_BASE_URL}/getAddressInformation"
    info_data = await _request("GET", info_url, params={
        "address": address
    })

    if not info_data:
        # If basic info is unreachable, log error and return defaults or raise.
        # Avoid misleading the frontend with silent failures.
        print(f"[TON Error] Failed to fetch info for {address}")
        return default_res

    state = info_data.get("state", "uninitialized")
    balance = info_data.get("balance", "0")

    result = default_res.copy()
    result["balance"] = balance

    # --- Seqno Logic ---
    if state == "active":
        result["is_deployed"] = True

        # Only query Seqno for 'active' accounts
        seqno_url = f"{config.TONCENTER_BASE_URL}/runGetMethod"
        payload = {
            "address": address,
            "method": "seqno",
            "stack": []
        }

        seq_data = await _request("POST", seqno_url, json_data=payload)

        # [Critical] If fetching fails, we cannot default to 0.
        # Must raise exception or retry to prevent invalid transactions.
        if not seq_data or "stack" not in seq_data:
            print(f"[TON Critical] Wallet is active but failed to fetch seqno! Address: {address}")
            raise ValueError("Failed to fetch sequence number for active wallet")

        stack = seq_data["stack"]
        if stack and len(stack) > 0 and stack[0][0] == "num":
            val_str = stack[0][1]
            if val_str.startswith('0x'):
                result["seqno"] = int(val_str, 16)
            else:
                result["seqno"] = int(val_str)
        else:
            # Abnormal case: An Active wallet must have a Seqno
            raise ValueError("Invalid seqno response from node")

    else:
        # Uninitialized or Frozen states
        result["is_deployed"] = False
        result["seqno"] = 0  # Seqno is only 0 in these cases

    return result


async def get_ton_transactions(chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]:
    """
    Fetch transaction history using TonCenter API V2
    """
    # Construct GET parameters
    params = {
        "address": address,
        "limit": limit,
        "archival": "true"  # Ensure queries reach archival nodes for older data
    }

    # Execute GET request
    raw_txs = await _request("GET", f'{config.TONCENTER_BASE_URL}/getTransactions', params=params)

    if not isinstance(raw_txs, list):
        return []

    # Use the input address as the reference point for fund flow
    my_address = address
    formatted = []

    for tx in raw_txs:
        # TonCenter transaction_id contains both hash and lt (logical time)
        tx_hash = tx.get("transaction_id", {}).get("hash")

        in_msg = tx.get("in_msg") or {}
        out_msgs = tx.get("out_msgs") or []

        in_value = int(in_msg.get("value") or 0)
        # Calculate the total amount for all outbound messages
        out_value = sum(int(m.get("value") or 0) for m in out_msgs)

        # --- Core Logic: Determine Fund Flow ---
        if out_msgs:
            # --- Scenario: Sending funds (Outbound) ---
            # Usually triggered by an External Message resulting in OutMsgs
            f_addr = my_address
            # Display the first recipient (TON supports multi-send; simplified here)
            t_addr = out_msgs[0].get("destination") or "Unknown"
            display_value = out_value

        elif in_value > 0:
            # --- Scenario: Receiving funds (Inbound) ---
            f_addr = in_msg.get("source") or "External"  # source is empty for External InMsg
            t_addr = my_address
            display_value = in_value

        else:
            # --- Scenario: Others (Contract deployment, msg-only, or value=0 msgs) ---
            f_addr = in_msg.get("source") or "Unknown"
            t_addr = my_address
            display_value = 0

        # Note: TonCenter getTransactions returns all activities.
        # Jetton transfers require parsing the message payload, which is not
        # handled by simply checking the 'value' field. This logic handles Native TON.

        formatted.append(
            {
                "txid": tx_hash,
                "from": f_addr,
                "to": t_addr,
                # Note: TonCenter returns value in nanoTON (integer string)
                "value": to_standard_amount(display_value, chain_key, contract, True),
                "timestamp": int(tx.get("utime", 0) * 1000),  # utime is in seconds, convert to ms
                "symbol": "TON"
            }
        )

    return formatted


async def broadcast_ton_transaction(signed_boc_base64: str) -> Optional[Dict[str, str]]:
    """
    Asynchronously broadcast a TON transaction
    :param signed_boc_base64: Signed BOC data (Base64 string)
    :return: Returns {"txid": "hash..."} on success, None on failure
    """
    url = f"{config.TONCENTER_BASE_URL}/sendBocReturnHash"
    payload = {
        "boc": signed_boc_base64
    }
    try:
        # _request wrapper strips the outer "result" field from Toncenter
        data = await _request("POST", url, json_data=payload)

        if data and "hash" in data:
            return {
                "txid": data["hash"]
            }

        return None

    except Exception as e:
        print(f"[Ton Broadcast Error] {str(e)}")
        return None