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
import markdown
import os
from fastapi import APIRouter, Query, Request, HTTPException
from typing import Dict, Any
from core.ratelimit import limiter

# Assuming these are imported from your actual project structure
from core.config import ALLOW_COINS, ALLOW_TOKENS, DOCS_DIR, PRICE_CACHE, CACHE_TTL
from services.price_service import fetch_binance_batch, fetch_okx_batch, fetch_coingecko_batch

router = APIRouter(tags=["Business Services"])


@router.get("/config/tokens")
async def get_config(request: Request):
    return {
        'coins': ALLOW_COINS,
        'tokens': ALLOW_TOKENS
    }


@router.get("/prices")
async def get_prices(request: Request, coins: str = Query(..., description="Comma-separated list of symbols (e.g., BTC,ETH)")):
    """
    Fetch cryptocurrency prices with a multi-tiered fallback strategy:
    Cache -> Binance -> OKX -> CoinGecko.
    """
    symbols = [s.strip().upper() for s in coins.split(",") if s.strip()]
    now = time.time()
    final, missing = {}, []

    # 1. Check local memory cache first
    for s in symbols:
        if s in PRICE_CACHE and (now - PRICE_CACHE[s]['timestamp'] < CACHE_TTL):
            final[s] = PRICE_CACHE[s]['price']
        else:
            missing.append(s)

    if missing:
        # 2. Tier 1: Fetch from Binance
        fetched = await fetch_binance_batch(missing)
        missing = [m for m in missing if m not in fetched]

        # 3. Tier 2: Fetch from OKX (if Binance missed)
        if missing:
            okx = await fetch_okx_batch(missing)
            fetched.update(okx)
            missing = [m for m in missing if m not in fetched]

        # 4. Tier 3: Fetch from CoinGecko (Fallback for long-tail tokens)
        if missing:
            cg = await fetch_coingecko_batch(missing)
            fetched.update(cg)
            missing = [m for m in missing if m not in fetched]

        # 5. Update cache with whatever we found
        for s, p in fetched.items():
            PRICE_CACHE[s] = {
                "price": p,
                "timestamp": now
            }
            final[s] = p

    return {
        "code": 200,
        "data": final,
        "failed": missing
    }


@router.get("/version")
async def version(request: Request):
    """
    Check for App updates.
    """
    version_map = {
        "version": "1.0.0",
        "note": "Fixed known bugs and improved security stability.",
        "android_url": "https://www.airlock.pub/release/app-v1.0.1.apk",
        "ios_url": "https://apps.apple.com/app/id123456789"
    }
    return {
        "code": 200,
        "data": version_map
    }


@router.get("/docs/{doc_type}")
async def get_doc(request: Request, doc_type: str, lang: str = Query("zh", description="Language code: zh, en")):
    """
    Retrieve security practices and policy documents.
    Supports doc_type: 'security', 'privacy', 'terms'
    """
    # 1. Title Mapping (Internationalized)
    # Using a nested dictionary to support multiple languages
    type_map = {
        "security": {
            "zh": "Airlock 安全交互规范",
            "en": "Airlock Security Interaction Specs"
        },
        "privacy": {
            "zh": "Airlock 隐私政策",
            "en": "Airlock Privacy Policy"
        },
        "terms": {
            "zh": "Airlock 服务条款",
            "en": "Airlock Terms of Service"
        }
    }

    if doc_type not in type_map:
        raise HTTPException(status_code=404, detail="Document type not found")

    # 2. Try to match the requested language file (e.g., security_en.md)
    filename = f"{doc_type}_{lang}.md"
    filepath = os.path.join(DOCS_DIR, filename)

    # Flag to check if we used fallback
    used_fallback_lang = None

    # 3. Fallback Logic: If specific language not found, default to Chinese (or English if preferred)
    if not os.path.exists(filepath):
        # Try default Chinese filename as per original logic
        fallback_filename = f"{doc_type}_zh.md"
        filepath = os.path.join(DOCS_DIR, fallback_filename)
        used_fallback_lang = "zh"

    # 4. Final check if file exists
    if not os.path.exists(filepath):
        print(f"[Doc Error] File not found at: {filepath}")
        raise HTTPException(status_code=404, detail="Document file not found")

    # 5. Determine the title to display
    # If we fell back to 'zh', show 'zh' title. Otherwise show requested 'lang' title.
    # If requested lang is not in map, default to 'en'.
    display_lang = used_fallback_lang if used_fallback_lang else lang
    title_dict = type_map.get(doc_type, {})
    doc_title = title_dict.get(display_lang, title_dict.get('en', 'Unknown Document'))

    # 6. Read and convert Markdown
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            md_text = f.read()

        # 'nl2br': Newlines to <br>
        # 'fenced_code': Support ``` code blocks
        # 'tables': Support Markdown tables
        html_content = markdown.markdown(md_text, extensions=['nl2br', 'fenced_code', 'tables'])

        return {
            "title": doc_title,
            "data": html_content
        }
    except Exception as e:
        print(f"[Doc Critical Error]: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during doc processing")