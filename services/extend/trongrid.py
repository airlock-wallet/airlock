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
from typing import Dict, Any
from core import config


def _get_tron_sem():
    """Lazy load to get SEM_TRON semaphore"""
    if getattr(config, 'SEM_TRON', None) is None:
        config.SEM_TRON = asyncio.Semaphore(5)
    return config.SEM_TRON


async def _request(method: str, url: str, json_data: dict = None, params: dict = None) -> Any:
    """Initiate Tatum API request"""
    headers = {
        "TRON-PRO-API-KEY": config.TRONGRID_API_KEY_MAINNET,
        "Content-Type": "application/json"
    }
    sem = _get_tron_sem()
    async with sem:
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.request(method, url, headers=headers, json=json_data, params=params)

                if resp.status_code >= 400:
                    print(f"[Tatum Error] {method} {url} -> {resp.status_code}: {resp.text}")

                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                print(f"[Tatum Request Exception] {url}: {e}")
                return None


async def get_tron_account_resource(address: str) -> int:
    """
    Asynchronously fetch Tron account resource details (Energy and Bandwidth)
    :param address: Wallet address (Base58 format)
    """
    url = f"{config.TRONGRID_BASE_URL}/wallet/getaccountresource"

    # visible=True is critical; it allows passing Base58 addresses (starting with 'T')
    # directly, otherwise, a Hex string must be provided.
    payload = {
        "address": address,
        "visible": True
    }

    try:
        data = await _request(method='POST', url=url, json_data=payload)
        if not data:
            return 0
        energy_limit = data.get("EnergyLimit", 0)
        energy_used = data.get("EnergyUsed", 0)
        # Calculate available energy
        return max(0, energy_limit - energy_used)
    except Exception as e:
        print(f"Error fetching Tron resources: {str(e)}")
        return 0