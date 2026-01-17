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
import asyncio
import httpx
from typing import Optional, List, Dict, Any
from core import config
from core.utils import to_standard_amount
from .provider_interface import IBlockchainProvider
from services.registry_service import registry_service


class AnkrProvider(IBlockchainProvider):
    def __init__(self):
        self._error_default = "-0.000000"
        self._last_req_time = 0
        self._max_retry = 3
        self._rate_limit = 0.5

        # === XRP Reserve Cache ===
        # Stores network reserve settings to avoid frequent API calls
        # Structure: {"data": {"base_reserve": 1, ...}, "timestamp": 0.0}
        self._xrp_reserve_cache = {
            "data": {},
            "timestamp": 0.0
        }

    @property
    def sem(self):
        if config.SEM_ANKR is None:
            config.SEM_ANKR = asyncio.Semaphore(2)
        return config.SEM_ANKR

    async def _request(self, method: str, url: str, json_data: dict = None, params: dict = None) -> Any:
        """Initiate Ankr/Tatum API Request"""
        headers = {
            "Content-Type": "application/json"
        }

        async with self.sem:
            # --- Active Rate Limiting ---
            # Calculate time elapsed since last request
            now = time.time()
            elapsed = now - self._last_req_time
            if elapsed < self._rate_limit:
                # If requesting too fast, force sleep
                wait_time = self._rate_limit - elapsed
                await asyncio.sleep(wait_time)

            # Update last request time
            self._last_req_time = time.time()

            # --- Retry Logic ---
            async with httpx.AsyncClient(timeout=30.0) as client:
                for attempt in range(self._max_retry):
                    try:
                        resp = await client.request(method, url, headers=headers, json=json_data, params=params)

                        # Handle 429 (Too Many Requests)
                        if resp.status_code == 429:
                            # Get retry time suggested by API, or fallback to exponential backoff (1s, 1.5s, 2.25s...)
                            retry_after = int(resp.headers.get("Retry-After", 1))
                            sleep_seconds = retry_after + (1.5 ** attempt)

                            print(f"[Ankr Limit] 429 Triggered. Pausing for {sleep_seconds:.2f}s before retry... (Attempt {attempt + 1}/{self._max_retry})")
                            await asyncio.sleep(sleep_seconds)
                            continue  # Retry loop

                        # Handle other errors (4xx, 5xx)
                        if resp.status_code >= 400:
                            print(f"[Ankr Error] {method} {url} -> {resp.status_code}: {resp.text}")

                            # 500/502/503/504 Server errors are usually retriable
                            if resp.status_code in [500, 502, 503, 504]:
                                await asyncio.sleep(1)
                                continue

                            # Other errors (400, 401, 403) are usually fatal
                            return None

                        # Success
                        return resp.json()

                    except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as e:
                        # Network level timeouts or connection errors
                        print(f"[Network Error] {url}: {e}. Retrying...")
                        if attempt < self._max_retry - 1:
                            await asyncio.sleep(2)
                        else:
                            return None
                    except Exception as e:
                        print(f"[Ankr Request Exception] {url}: {e}")
                        return None
            return None

    async def _get_url(self, chain_key: str) -> str:
        interface = self.api_map.get(chain_key, chain_key)
        return self._rpc_url.replace('[INTERFACE]', interface)

    async def get_balance(self, chain_key: str, address: str, contract: Optional[str] = None) -> Any:
        if chain_key == 'ton':
            return await self._get_ton_balance(chain_key, address, contract)
        elif chain_key == 'ripple':
            return await self._get_xrp_balance(chain_key, address, contract)
        return self._error_default

    async def get_account_resource(self, chain_key: str, address: str, contract: str = None) -> Dict:
        return {}

    async def get_transactions(self, chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]:
        result = []
        if chain_key == 'ton':
            result = await self._get_ton_transactions(chain_key, address, contract, limit)
        elif chain_key == 'ripple':
            result = await self._get_xrp_transactions(chain_key, address, contract, limit)
        return result

    async def get_utxo(self, chain_key: str, address: str, total_value: str):
        return []

    async def get_latest_block(self, chain_key: str, address: str):
        return {}

    async def get_fee(self, chain_key: str) -> Dict:
        if chain_key == 'ripple':
            return await self._get_xrp_fee(chain_key)
        return {}

    async def get_nonce(self, chain_key: str, address: str) -> int:
        pass

    async def get_estimate_gas(self, chain_key: str, address: str, contract: str = None) -> Dict[str, Any]:
        pass

    async def get_seqno(self, chain_key: str, address: str) -> Dict:
        return {}

    async def broadcast_transaction(self, chain_key: str, tx_hex: str):
        if chain_key == 'ripple':
            return await self._broadcast_xrp_transaction(tx_hex)
        return None

    async def _get_xrp_fee(self, chain_key: str) -> Dict:
        """
        [Ankr RPC] Get current suggested fees for XRP
        Method: fee
        Docs: https://xrpl.org/fee.html
        """
        url = f"https://rpc.ankr.com/xrp_mainnet/{config.ANKR_API_KEY_MAINNET}"
        payload = {
            "method": "fee",
            "params": [{}]
        }
        try:
            res = await self._request("POST", url, json_data=payload)
            # === Parse RPC Response ===
            # Structure: result -> drops -> {base_fee, median_fee, open_ledger_fee, ...}
            # Docs recommend 'open_ledger_fee' or 'minimum_fee' with buffer.
            # 'open_ledger_fee' is generally reliable for immediate inclusion.
            drops_data = res.get('result', {}).get('drops', {})

            # Get suggested rate (Unit: Drops, string)
            # Fallback to 12 Drops (0.000012 XRP) if failed.
            # 10 is baseline, 12 is standard wallet default for safety.
            current_fee_drops = int(drops_data.get('open_ledger_fee', 12))

            # Safety buffer: ensure it never drops below 12 to avoid rejection by strict nodes
            if current_fee_drops < 12:
                current_fee_drops = 12

            # === Convert to XRP Standard Unit ===
            # 1 XRP = 1,000,000 Drops
            fee_xrp = to_standard_amount(current_fee_drops, chain_key, None, True)

            # Return string, e.g., "0.000012"
            return {
                "slow": fee_xrp,
                "medium": fee_xrp,
                "fast": fee_xrp
            }

        except Exception as e:
            print(f"[XRP] Get Fee Error: {e}")
            # Fallback values on error
            return {
                "slow": "0.000012",
                "medium": "0.000012",
                "fast": "0.000012"
            }

    async def _get_ton_balance(self, chain_key: str, address: str, contract: Optional[str] = None) -> str:
        """Query TON Balance"""
        payload = {
            "jsonrpc": "2.0",
            "method": "getAddressBalance",
            "params": {
                "address": address
            },
            "id": "1"
        }
        res = await self._request("POST", f'{config.ANKR_BASE_URL}/ton_api_v2/{config.ANKR_API_KEY_MAINNET}', json_data=payload)
        if not res:
            return self._error_default
        return to_standard_amount(res.get('result'), chain_key, contract, True)

    async def _get_xrp_balance(self, chain_key: str, address: str, contract: Optional[str] = None) -> Dict:
        """
        [Ankr RPC] Get Full XRP Account Info
        Docs: https://www.ankr.com/docs/rpc-service/chains/chains-api/xrp/
        """
        # Ankr XRP Public Node
        url = f"https://rpc.ankr.com/xrp_mainnet/{config.ANKR_API_KEY_MAINNET}"

        # Construct Ripple Native RPC Payload
        # 'account_info' is standard method supported by all nodes
        payload = {
            "method": "account_info",
            "params": [
                {
                    "account": address,
                    "strict": True,
                    "ledger_index": "validated"  # Use 'validated' for confirmed data
                }
            ]
        }

        try:
            res = await self._request("POST", url, json_data=payload)
        except Exception as e:
            print(f"[XRP] Ankr request failed: {e}")
            return {
                "balance": self._error_default,
                "sequence": 0
            }

        if not res or 'result' not in res:
            return {
                "balance": self._error_default,
                "sequence": 0
            }
        result = res['result']

        # Error Handling (e.g., Account not active)
        if result.get('status') != 'success':
            if result.get('error') == 'actNotFound':
                return {
                    "balance": self._error_default,
                    "sequence": 0
                }
            return {
                "balance": self._error_default,
                "sequence": 0
            }

        account_data = result['account_data']

        # 1. Balance (Drops -> XRP)
        balance_drops = float(account_data.get('Balance', 0))
        balance_xrp = to_standard_amount(balance_drops, chain_key, contract, True)

        # 2. Sequence (Critical for transaction signing)
        sequence = int(account_data.get('Sequence', 0))

        # 3. Current Ledger Index
        current_ledger_index = int(result.get('ledger_index', 0))

        # 4. Query Reserve Requirements
        reserve = await self._get_xrp_network_settings()
        return {
            **reserve,
            "balance": balance_xrp,
            "sequence": sequence,
            "ledgerIndex": current_ledger_index
        }

    async def _get_xrp_network_settings(self) -> dict:
        """
        [Ankr RPC] Get current network reserve settings
        Method: server_info
        """
        current_time = time.time()
        cache = self._xrp_reserve_cache

        # === 1. Check Cache Validity ===
        # Use cache if data exists and is less than 1 hour old
        if cache["data"] and (current_time - cache["timestamp"] < 3600):
            return cache["data"]

        url = f"https://rpc.ankr.com/xrp_mainnet/{config.ANKR_API_KEY_MAINNET}"
        payload = {
            "method": "server_info",
            "params": [{}]
        }
        try:
            res = await self._request("POST", url, json_data=payload)
            info = res['result']['info']['validated_ledger']

            # Extract network reserves (Units are usually XRP)
            result_data = {
                "base_reserve": float(info.get('reserve_base_xrp', 10.0)),
                "owner_reserve": float(info.get('reserve_inc_xrp', 2.0))
            }

            # === 3. Update Cache ===
            self._xrp_reserve_cache["data"] = result_data
            self._xrp_reserve_cache["timestamp"] = current_time

            return result_data
        except Exception as e:
            print(f"[XRP] Get Server Info Error: {e}")
            # Fallback defaults
            return {
                "base_reserve": 10.0,
                "owner_reserve": 2.0
            }

    async def _get_ton_transactions(self, chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]:
        payload = {
            "jsonrpc": "2.0",
            "method": "getTransactions",
            "params": {
                "address": address,
                "limit": limit,
                "archival": "true"
            },
            "id": "1"
        }
        res = await self._request("POST", f'{config.ANKR_BASE_URL}/ton_api_v2/{config.ANKR_API_KEY_MAINNET}', json_data=payload)
        result = res.get("result") if isinstance(res, dict) else []
        raw_txs = result if isinstance(result, list) else []

        # User's address is the baseline for calculation
        my_address = address
        formatted = []
        for tx in raw_txs:
            in_msg = tx.get("in_msg") or {}
            out_msgs = tx.get("out_msgs") or []

            in_value = int(in_msg.get("value") or 0)
            out_value = sum(int(m.get("value") or 0) for m in out_msgs)

            # Calculate Net Flow (excluding fees)

            if out_msgs:
                # --- Scenario: I sent money (Outgoing) ---
                # Any out_msg implies a send action from the wallet perspective
                f_addr = my_address
                # Take the first recipient
                t_addr = out_msgs[0].get("destination") or "Unknown"
                display_value = out_value
            elif in_value > 0:
                # --- Scenario: I received money (Incoming) ---
                # No outgoing messages and incoming message has value
                f_addr = in_msg.get("source") or "External"
                t_addr = my_address
                display_value = in_value
            else:
                # --- Scenario: Special Action (Contract call, Zero value tx) ---
                f_addr = my_address
                t_addr = in_msg.get("source") or "Contract"
                display_value = 0

            formatted.append(
                {
                    "txid": tx.get("transaction_id", {}).get("hash"),
                    "from": f_addr,
                    "to": t_addr,
                    "value": to_standard_amount(display_value, chain_key, contract, True),
                    "timestamp": int(tx.get("utime", 0) * 1000),
                    "symbol": "TON"
                }
            )

        return formatted

    async def _get_xrp_transactions(self, chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> list:
        """
        [Ankr RPC] Get recent transactions
        Method: account_tx
        Docs: https://xrpl.org/account_tx.html
        """
        url = f"https://rpc.ankr.com/xrp_mainnet/{config.ANKR_API_KEY_MAINNET}"
        # 1. Construct Request
        # ledger_index_min: -1 means search as far back as possible (depends on node history)
        # binary: False for JSON response
        # forward: False for descending order (newest first)
        payload = {
            "method": "account_tx",
            "params": [{
                "account": address,
                "binary": False,
                "forward": False,
                "ledger_index_min": -1,
                "ledger_index_max": -1,
                "limit": limit
            }]
        }

        try:
            res = await self._request("POST", url, json_data=payload)
        except Exception as e:
            print(f"[XRP] Get Tx Error: {e}")
            return []

        if not res or 'result' not in res:
            return []

        result = res['result']
        if result.get('status') != 'success':
            return []

        # 2. Parse Transaction List
        raw_txs = result.get('transactions', [])
        tx_list = []

        # Offset between Ripple Epoch (2000-01-01) and Unix Epoch (1970-01-01) in seconds
        RIPPLE_EPOCH_OFFSET = 946684800

        for item in raw_txs:
            # Structure: Details in 'tx', Metadata in 'meta'
            tx_data = item.get('tx', {})
            meta = item.get('meta', {})  # Used to check transaction success

            # Filter out failed transactions (tesSUCCESS means success)
            if meta.get('TransactionResult') != 'tesSUCCESS':
                continue
            # Only process Payment type, ignore TrustSet, OfferCreate etc.
            if tx_data.get('TransactionType') != 'Payment':
                continue

            # Time Conversion
            close_time = tx_data.get('date', 0)
            timestamp = close_time + RIPPLE_EPOCH_OFFSET

            # Transaction Hash
            tx_hash = tx_data.get('hash', '')

            # Addresses & Direction
            from_addr = tx_data.get('Account', '')
            to_addr = tx_data.get('Destination', '')

            direction = 'outgoing' if from_addr == address else 'incoming'
            # other_address = to_addr if direction == 'outgoing' else from_addr (Not used in dict, but logic exists)

            # Amount Handling (Pitfall: Can be String or Object)
            raw_amount = tx_data.get('Amount', '0')
            final_amount = "0"

            if isinstance(raw_amount, str):
                # case A: Native XRP (Unit: Drops)
                final_amount = to_standard_amount(raw_amount, chain_key, contract, True)
            elif isinstance(raw_amount, dict):
                # case B: Tokens (USDT, etc.)
                # Skipping tokens for now as per original logic
                # final_amount = raw_amount.get('value')
                # symbol = raw_amount.get('currency')
                continue

                # Fee (Unit: Drops) -> For display only
            fee_drops = float(tx_data.get('Fee', 0))
            # fee_xrp = f"{fee_drops / 1_000_000.0:.6f}"

            # Tag (If any)
            # memo_tag = tx_data.get('DestinationTag', '')

            tx_list.append({
                "txid": tx_hash,
                "timestamp": timestamp * 1000,  # Convert to ms for frontend
                "from": from_addr,
                "to": to_addr,
                "value": final_amount,
                "symbol": "XRP"
            })

        return tx_list

    async def _broadcast_xrp_transaction(self, tx_data: str) -> str:
        """
        XRP Broadcast Method
        """
        # Remove 0x prefix
        if tx_data.startswith("0x") or tx_data.startswith("0X"):
            tx_data = tx_data[2:]

        url = f"https://rpc.ankr.com/xrp_mainnet/{config.ANKR_API_KEY_MAINNET}"
        payload = {
            "method": "submit",
            "params": [
                {
                    "tx_blob": tx_data
                }
            ]
        }
        try:
            res = await self._request("POST", url, json_data=payload)
            # Ankr/XRP Success Response Structure
            # Success: result.status == 'success' AND result.engine_result == 'tesSUCCESS' (or tec...)
            if res and 'result' in res:
                engine_result = res['result'].get('engine_result')
                # engine_msg = res['result'].get('engine_result_message')
                tx_hash = res['result'].get('tx_json', {}).get('hash')

                if engine_result == 'tesSUCCESS' or engine_result.startswith('tes'):
                    return tx_hash
        except Exception as e:
            print(f"[XRP Broadcast Error] {e}")
        return ''