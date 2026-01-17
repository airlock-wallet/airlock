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

import time
import httpx
import asyncio
from typing import List, Dict
from core import config
from services.registry_service import registry_service

async def fetch_binance_batch(symbols: List[str]) -> Dict[str, float]:
    results = {}
    if not symbols: return results

    BLACKLIST = {'TRX', 'XRP'}
    # Build a matching mapping table
    # e.g., for input 'USDT', we look for 'USDTUSD' or 'USDTUSDT'
    target_map = {}
    for s in symbols:
        if s in BLACKLIST: continue
        target_map[f"{s}USD"] = s
        target_map[f"{s}USDT"] = s

    if config.SEM_BINANCE is None:
        config.SEM_BINANCE = asyncio.Semaphore(2)

    async with config.SEM_BINANCE:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                # Use Binance price ticker endpoint
                url = "https://api.binance.us/api/v3/ticker/price"
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data:
                        sym_in_api = item['symbol']
                        # Check if the symbol from API exists in our target mapping
                        if sym_in_api in target_map:
                            original_symbol = target_map[sym_in_api]
                            # Avoid duplicate entries (e.g., if USDTUSD exists,
                            # don't overwrite with USDTUSDT unless the latter is preferred)
                            if original_symbol not in results:
                                results[original_symbol] = float(item['price'])
            except Exception as e:
                print(f"Binance Error: {e}")
    return results

async def fetch_okx_batch(symbols: List[str]) -> Dict[str, float]:
    results = {}
    if not symbols: return results

    # OKX naming convention is typically SYMBOL-USDT or SYMBOL-USD
    target_instIds = set()
    for s in symbols:
        target_instIds.add(f"{s}-USDT")
        target_instIds.add(f"{s}-USD")

    if config.SEM_OKX is None:
        config.SEM_OKX = asyncio.Semaphore(2)

    async with config.SEM_OKX:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                url = "https://www.okx.com/api/v5/market/tickers"
                resp = await client.get(url, params={"instType": "SPOT"})
                if resp.status_code == 200:
                    data_json = resp.json()
                    if data_json.get('code') == '0':
                        for item in data_json['data']:
                            instId = item['instId']
                            if instId in target_instIds:
                                raw_sym = instId.split("-")[0]
                                if raw_sym not in results:
                                    results[raw_sym] = float(item['last'])
            except Exception as e:
                print(f"OKX Error: {e}")
    return results

async def fetch_coingecko_batch(symbols: List[str]) -> Dict[str, float]:
    results = {}
    if not symbols: return results

    # 1. Establish mapping from symbol to cg_id (process as uppercase to handle inconsistencies)
    # Ensure mapping includes: USDT -> tether, USDC -> usd-coin, etc.
    cg_map = {coin['symbol'].upper(): coin['id'] for coin in registry_service.list if 'symbol' in coin}

    ids_to_query = []
    id_to_original_sym = {}

    for s in symbols:
        s_upper = s.upper()
        if s_upper in cg_map:
            cg_id = cg_map[s_upper]
            ids_to_query.append(cg_id)
            # If not found in registry, it's difficult to query Coingecko by symbol directly;
            # this maintains logical consistency.
            id_to_original_sym[cg_id] = s

    if not ids_to_query: return results

    if config.SEM_COINGECKO is None:
        config.SEM_COINGECKO = asyncio.Semaphore(2)

    async with config.SEM_COINGECKO:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                # 2. Call Coingecko Simple Price endpoint
                # Returns the real market price relative to vs_currencies (usd)
                url = "https://api.coingecko.com/api/v3/simple/price"
                params = {
                    "ids": ",".join(ids_to_query), "vs_currencies": "usd"
                }
                resp = await client.get(url, params=params)

                if resp.status_code == 200:
                    data = resp.json()
                    for cg_id, price_info in data.items():
                        if 'usd' in price_info:
                            original_sym = id_to_original_sym[cg_id]
                            results[original_sym] = float(price_info['usd'])

            except Exception as e:
                print(f"CoinGecko Error: {e}")

    return results