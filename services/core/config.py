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

import os
from dotenv import load_dotenv

load_dotenv()

# Tatum API Keys
TATUM_API_KEY_MAINNET = os.getenv("TATUM_API_KEY_MAINNET", "")
TATUM_API_KEY_TESTNET = os.getenv("TATUM_API_KEY_TESTNET", "")
TATUM_BASE_URL = "https://api.tatum.io"

# Ankr API
ANKR_API_KEY_MAINNET = os.getenv("ANKR_API_KEY_MAINNET", "")
ANKR_BASE_URL = 'https://rpc.ankr.com'

# TronGrid API
TRONGRID_API_KEY_MAINNET = os.getenv("TRONGRID_API_KEY_MAINNET", "")
TRONGRID_BASE_URL = 'https://api.trongrid.io'

# TON API
TON_API_KEY_MAINNET = os.getenv("TON_API_KEY_MAINNET", "")
TONCENTER_BASE_URL = "https://toncenter.com/api/v2"

# Etherscan API
ETHERSCAN_API_KEY_MAINNET = os.getenv("ETHERSCAN_API_KEY_MAINNET", "")
ETHERSCAN_base_url = 'https://api.etherscan.io/v2/api'

# Concurrency Control Beans (Semaphores)
# Initialized in main startup logic to prevent global event loop issues
SEM_BINANCE = None
SEM_OKX = None
SEM_COINGECKO = None
SEM_TATUM = None
SEM_ANKR = None
SEM_TRON = None
SEM_TON = None
SEM_DASH = None
SEM_ETC = None
SEM_SUI = None
SEM_ETHERSCAN = None
SEM_AVAX_RPC = None

# Cache Configuration
CACHE_TTL = 15
PRICE_CACHE = {}

# Path Configuration
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTRY_PATH = os.path.join(BASE_DIR, "registry.json")
DOCS_DIR = os.path.join(BASE_DIR, "docs")

# Reference list of potential coins:
# 'bitcoin', 'ethereum', 'smartchain', 'polygon', 'litecoin', 'doge', 'tron', 'solana', 'ripple', 'stellar', 'algorand', 'celo', 'eos', 'base', 'arbitrum', 'optimism',
# 'avalanchec', 'zksync', 'kaia', 'bitcoincash', 'cardano', 'cronos', 'near', 'polkadot', 'sui', 'ton', 'tezos', 'zcash', 'fantom', 'classic', 'sonic', 'monad',
# 'cosmos', 'vechain', 'monacoin'

# Supported Main Coins
ALLOW_COINS = [
    'bitcoin', 'ethereum', 'smartchain', 'doge', 'tron', 'solana',
    'ripple', 'bitcoincash', 'ton', 'avalanchec', 'classic',
    'litecoin', 'arbitrum', 'polygon', 'sui', 'dash'
]

# Supported Tokens
ALLOW_TOKENS = [
    {
        'coin': 'ethereum',
        'symbol': 'USDT',
        'name': 'USDT-ERC20',
        'contract': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        'decimals': 6,
        'icon': 'usdterc20.svg'
    },
    {
        'coin': 'arbitrum',
        'symbol': 'ARB',
        'name': 'Arbitrum',
        'contract': '0x912CE59144191C1204E64559FE8253a0e49E6548',
        'decimals': 18,
        'icon': 'arbitrum.svg'
    },
    {
        'coin': 'smartchain',
        'symbol': 'USDC',
        'name': 'USDC-BEP20',
        'contract': '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        'decimals': 18,
        'icon': 'usdcbsc.svg'
    },
    {
        'coin': 'smartchain',
        'symbol': 'TWT',
        'name': 'TWT-BEP20',
        'contract': '0x4B0F1812e5Df2A09796481Ff14017e6005508003',
        'decimals': 18,
        'icon': 'twt.svg'
    },
    {
        'coin': 'tron',
        'symbol': 'USDT',
        'name': 'USDT-TRC20',
        'contract': 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        'decimals': 6,
        'icon': 'usdttrc20.svg'
    },
]

# Get the root directory of the current project (Redundant declaration check, ensuring consistency)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Ensure the docs directory exists, otherwise warn on startup
if not os.path.exists(DOCS_DIR):
    os.makedirs(DOCS_DIR, exist_ok=True)
    print(f"Warning: DOCS_DIR created at {DOCS_DIR}. Please put your .md files there.")