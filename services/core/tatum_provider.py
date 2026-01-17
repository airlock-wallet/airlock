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

import json
import time
import httpx
import asyncio
from typing import Optional, List, Dict, Any
from core import config
from .provider_interface import IBlockchainProvider
from services.registry_service import registry_service
from core.utils import to_standard_amount, pubkey_to_address_with_bch
from extend.trongrid import get_tron_account_resource


class TatumProvider(IBlockchainProvider):
    def __init__(self):
        self._chain_map = {
            "bitcoin": "bitcoin",
            "ethereum": "ethereum",
            "smartchain": "bsc",
            "polygon": "matic",
            "litecoin": "litecoin",
            "doge": "dogecoin",
            "tron": "tron",
            "solana": "solana",
            "ripple": "xrp",
            "stellar": "stellar",
            "algorand": "algorand",
            "base": "base",
            "arbitrum": "arb",
            "optimism": "optimism",
            "avalanchec": "avalanche",
            "zksync": "zksync",
            "eos": "eos",
            "kaia": "kaia",
            "celo": "celo",
            "bitcoincash": "bcash",
            "cardano": "ada",
            "cronos": "cro",
            "near": "near",
            "polkadot": "dot",
            "sui": "sui",
            "ton": "ton",
            "tezos": "tezos",
            "zcash": "zcash",
            "fantom": "fantom",
            "classic": "etc",
            "sonic": "sonic",
            "monad": "monad",
            "cosmos": "cosmos",
            "harmony": "one",
            "vechain": "vechain",
            "zilliqa": "zilliqa",
            "moonbeam": "glmr",
            "ronin": "ronin",
            "aurora": "aurora",
            "oasis": "oasis",
            "rootstock": "rsk",
            "arbitrumnova": "arbitrum-nova",
            "monacoin": "monacoin",
            "fio": "fio",
            "xdai": "xdai",
            "kavaevm": "kava-evm"
        }
        self._error_default = "-0.000000"
        self._last_req_time = 0
        self._max_retry = 3
        self._rate_limit = 1

    @property
    def sem(self):
        if config.SEM_TATUM is None:
            config.SEM_TATUM = asyncio.Semaphore(2)
        return config.SEM_TATUM

    async def _request(self, method: str, url: str, json_data: dict = None, params: dict = None) -> Any:
        """Initiate Tatum API Request"""
        headers = {
            "x-api-key": config.TATUM_API_KEY_MAINNET,
            "accept": "application/json",
            "content-type": "application/json"
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
                            # Get retry time suggested by API, or fallback to exponential backoff
                            retry_after = int(resp.headers.get("Retry-After", 1))
                            sleep_seconds = retry_after + (1.5 ** attempt)

                            print(f"[Tatum Limit] 429 Triggered. Pausing for {sleep_seconds:.2f}s before retry... (Attempt {attempt + 1}/{self._max_retry})")
                            await asyncio.sleep(sleep_seconds)
                            continue  # Retry loop

                        # Handle other errors (4xx, 5xx)
                        if resp.status_code >= 400:
                            print(f"[Tatum Error] {method} {url} -> {resp.status_code}: {resp.text}")

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
                        print(f"[Tatum Request Exception] {url}: {e}")
                        return None
            return None

    async def get_balance(self, chain_key: str, address: str, contract: Optional[str] = None) -> Any:
        """Query Balance"""
        t_chain_path = self._get_tatum_chain(chain_key.lower())
        if not t_chain_path:
            return self._error_default

        # TRON
        if t_chain_path == "tron":
            result = await self._get_trx_balance(t_chain_path, chain_key, address, contract)
            return result

        # BCH
        if t_chain_path == 'bcash':
            result = await self._get_bch_balance(t_chain_path, chain_key, address, contract)
            return result

        # TON
        if t_chain_path == 'ton':
            result = await self._get_ton_balance(t_chain_path, chain_key, address, contract)
            return result

        # Tokens on other chains (ETH, BSC, MATIC, etc.)
        if contract:
            target_chain = self._get_contract_symbol(chain_key.lower())
            url = f"{config.TATUM_BASE_URL}/v3/blockchain/token/balance/{target_chain}/{contract}/{address}"
            res = await self._request("GET", url)
            return to_standard_amount(res.get("balance", 0), chain_key, contract, True)

        # BTC, LTC, etc. UTXO Chain Logic
        if t_chain_path in ["bitcoin", "litecoin", "dogecoin", "dash"]:
            result = await self._get_btc_balance(t_chain_path, chain_key, address, contract)
            return result

        # ETH, BSC, etc. Native Coin Logic
        result = await self._get_eth_balance(t_chain_path, chain_key, address, contract)
        return result

    async def get_account_resource(self, chain_key: str, address: str, contract: str = None) -> Dict:
        """Tron: Get Account Resources"""
        if chain_key != 'tron':
            return {}

        url = f"https://api.tatum.io/v3/tron/account/{address}"
        res = await self._request("GET", url)

        if not res:
            return {}

        # Query Energy via customized extend method
        energy = await get_tron_account_resource(address)

        # 1. Extract generic account resources (Energy/Bandwidth)
        # Note: Tatum often omits energy if value is 0. Manually default to 0 to prevent frontend issues.
        clean_data = {
            "chain": chain_key,
            "address": address,
            "contract": contract,
            "createTime": res.get("createTime"),
            "bandwidth": res.get("bandwidth", 0),
            "freeNetLimit": res.get("freeNetLimit", 0),
            "energy": energy,
            "trc20": [],  # Default empty, populated only if match found
            "trc10": []
        }

        # === Query TRC20 Tokens (e.g. USDT) ===
        if contract:
            target_balance_raw = "0"
            trc20_list = res.get("trc20", [])
            for token_dict in trc20_list:
                if contract in token_dict:
                    target_balance_raw = token_dict[contract]
                    break

            # Format amount
            readable_balance = to_standard_amount(target_balance_raw, chain_key, contract, True)

            if target_balance_raw != "0":
                clean_data["trc20"] = [{
                                           contract: readable_balance
                                       }]

        # === Get Native Balance ===
        else:
            raw_balance = res.get("balance", 0)
            clean_data["balance"] = to_standard_amount(raw_balance, chain_key, None, True)

        return clean_data

    async def get_utxo(self, chain_key: str, address: str, total_value: str) -> List[Dict[str, Any]]:
        """
        Get UTXOs based on Tatum documentation for each coin
        """
        t_chain = self._get_tatum_chain(chain_key)
        if not t_chain:
            return []

        # Document: https://docs.tatum.io/reference/getutxosbyaddressbatchv4
        if t_chain in ["bitcoin", "litecoin", "dogecoin"]:
            url = f"{config.TATUM_BASE_URL}/v4/data/utxos"
            t_chain_map = {
                'dogecoin': 'doge'
            }
            payload = {
                'chain': f'{t_chain_map.get(t_chain, t_chain)}',
                'totalValue': total_value,
                'address': address,
            }
            res = await self._request("GET", url, params=payload)
            return res if isinstance(res, list) else []

        # Document: https://docs.tatum.io/reference/rpc-rostrum-blockchainaddresslistunspent
        elif t_chain == 'bcash':
            url = 'https://bch-mainnet-rostrum.gateway.tatum.io'
            payload = {
                "method": "blockchain.address.listunspent",
                "params": [address],
                "id": 1,
                "jsonrpc": "2.0"
            }
            res = await self._request("POST", url, json_data=payload)
            # Rostrum Format: [{'tx_hash': '...', 'tx_pos': 0, 'value': 1000, 'height': ...}, ...]
            if not res or "result" not in res:
                return []

            # Format to match Tatum BTC structure for unified handling
            formatted_utxos = []
            for item in res["result"]:
                formatted_utxos.append(
                    {
                        "chain": "bch-mainnet",
                        "address": address,
                        "txHash": item.get("tx_hash"),
                        "index": item.get("tx_pos"),
                        "value": to_standard_amount(item.get("value"), chain_key, None, True),
                        "height": item.get("height")
                    }
                )
            return formatted_utxos

        else:
            url = f"{config.TATUM_BASE_URL}/v3/ada/utxo/{address}"
            res = await self._request("GET", url)
            return res if isinstance(res, list) else []

    async def get_transactions(self, chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """
        Multi-chain Transaction History: Supports TRON, EVM (ETH/BSC/Polygon), BTC (UTXO)
        """
        t_chain_path = self._get_tatum_chain(chain_key.lower())
        if not t_chain_path:
            return []

        try:
            # TRON Logic (Native & Tokens)
            if t_chain_path == "tron":
                result = await self._get_trx_transactions(t_chain_path, chain_key, address, contract, limit)
                return result

            # BSC
            elif t_chain_path == 'bsc':
                result = await self._get_bsc_transactions(t_chain_path, chain_key, address, contract, limit)
                return result

            # BCH
            elif t_chain_path == 'bcash':
                result = await self._get_bch_transactions(t_chain_path, chain_key, address, contract, limit)
                return result

            # TON
            elif t_chain_path == 'ton':
                result = await self._get_ton_transactions(t_chain_path, chain_key, address, contract, limit)
                return result

            # SOL
            elif t_chain_path == 'solana':
                result = await self._get_sol_transactions(t_chain_path, chain_key, address, contract, limit)
                return result

            # EVM Architecture (ETH, Polygon)
            elif t_chain_path in ["ethereum", "polygon"]:
                result = await self._get_eth_transactions(t_chain_path, chain_key, address, contract, limit)
                return result

            # BTC / UTXO Architecture (Bitcoin, Litecoin, Doge)
            elif t_chain_path in ["bitcoin", "litecoin", "dogecoin"]:
                result = await self._get_btc_transactions(t_chain_path, chain_key, address, contract, limit)
                return result

        except Exception as e:
            print(f"[Transaction Sync Error] {chain_key}: {str(e)}")

        return []

    async def get_fee(self, chain_key: str) -> Dict:
        """Get Network Fee"""
        if chain_key == 'bitcoin':
            url = f'{config.TATUM_BASE_URL}/v3/blockchain/fee/BTC'
            result = await self._request('GET', url)
            return result
        elif chain_key == 'bitcoincash':
            url = 'https://bch-mainnet-rostrum.gateway.tatum.io'

            # BCH network is rarely congested, 1 sat/byte is standard.
            # But for robustness, call estimatefee (predict next 2 blocks)
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "blockchain.estimatefee",
                "params": [2]
            }
            res = await self._request('POST', url, json_data=payload)

            # Default fee: 1 sat/byte
            default_sats = 1

            if res and "result" in res:
                # Rostrum returns BCH/kB (e.g., 0.00001000)
                val_per_kb = float(res["result"])
                # If returns -1 (cannot estimate) or extremely small value, use default
                if val_per_kb > 0:
                    # Formula: (BCH/kB * 10^8) / 1000 = sat/byte
                    # Simplified: BCH/kB * 100000
                    sats_per_byte = int(val_per_kb * 100000)
                    # Ensure at least 1 (BCH network rejects 0 fee or < 1 sat/byte relay)
                    default_sats = max(1, sats_per_byte)

            fee_str = str(default_sats)
            # BCH rarely congests, three tiers are usually the same
            return {
                "slow": fee_str,
                "medium": fee_str,
                "fast": fee_str
            }
        return {}

    async def get_seqno(self, chain_key: str, address: str) -> Dict:
        """
        [Note] Tatum support for TON is flaky, often returns 429.
        Get TON Transaction Params (seqno)
        """
        url = f"https://ton-mainnet.gateway.tatum.io/getExtendedAddressInformation"

        # 1. Fetch basic info
        raw_data = await self._request("GET", url, params={
            "address": address
        })

        if not raw_data:
            return {}

        # 2. Extract result
        res = raw_data.get("result", {})

        # 3. Core Logic: Parse State
        seqno = 0
        is_deployed = False
        balance = res.get("balance", "0")

        account_state = res.get("account_state", {})
        state_type = account_state.get("@type", "")

        # Determine if uninitialized
        if state_type == "uninited.accountState":
            # Case A: Uninitialized
            # No seqno field on chain, default to 0
            seqno = 0
            is_deployed = False

        elif "wallet" in state_type or state_type == "active.accountState":
            # Case B: Active / Wallet V3, V4
            # Only active accounts have seqno
            seqno = account_state.get("seqno", 0)
            is_deployed = True

        # 4. (Optional) Estimate suggested fee
        # You can hardcode this or calculate based on network load
        estimated_fee = "0.01"  # TON default transfer fee estimation

        # 5. Return sanitized data to frontend
        return {
            "seqno": seqno,  # int: 0 or real sequence
            "is_deployed": is_deployed,  # bool: contract deployed?
            "balance": to_standard_amount(balance, chain_key, None, True),  # str: balance (nanoTON)
            "estimated_fee": estimated_fee  # str: suggested fee
        }

    async def get_nonce(self, chain_key: str, address: str) -> int:
        """
        Get Nonce
        Tatum API: GET /v3/{chain}/transaction/count/{address}
        """
        tatum_chain = self._get_tatum_chain(chain_key)
        if not tatum_chain:
            return 0

        endpoint = f"{config.TATUM_BASE_URL}/v3/{tatum_chain}/transaction/count/{address}"

        # Tatum nonce endpoint returns a raw number (e.g. 5), not a JSON object
        result = await self._request("GET", endpoint)

        try:
            # Force cast to int to prevent string return issues
            return int(result) if result is not None else 0
        except Exception as e:
            print(f"[Tatum Nonce Error] {e}")
            return 0

    async def get_estimate_gas(self, chain_key: str, address: str, contract: str = None) -> Dict[str, Any]:
        """
        Estimate Gas (Price & Limit)
        Tatum API: GET /v3/{chain}/gas
        Format must align: {"gasPrice": "WeiStr", "gasLimit": "Str"}
        """
        tatum_chain = self._get_tatum_chain(chain_key)

        # --- A. Get Gas Price ---
        # Tatum returns Gwei units. Structure: {"slow": "2", "standard": "2.5", "fast": "3", "baseFee": "..."}
        price_endpoint = f"{config.TATUM_BASE_URL}/v3/{tatum_chain}/gas"
        gas_data = await self._request("GET", price_endpoint)

        # Default 20 Gwei (Fallback if API fails)
        price_gwei = 20.0

        if gas_data and "standard" in gas_data:
            try:
                # Tatum sometimes returns string "2.5", sometimes number
                price_gwei = float(gas_data["standard"])
            except:
                pass

        # Convert to Wei (1 Gwei = 10^9 Wei)
        price_wei = int(price_gwei * 10 ** 9)

        # --- B. Determine Gas Limit ---
        # Tatum's generic gas estimate endpoint is complex (requires full tx object).
        # To maintain efficiency and consistency, we use "Rule of Thumb" strategy matching EvmService.

        safe_limit = 21000  # Default ETH Transfer

        if contract:
            safe_limit = 100000  # Token transfer default
        else:
            # L2 Chains (Arbitrum/Optimism) native transfer needs higher limit for L1 data fees
            if chain_key in ["arbitrum", "optimism", "base"]:
                safe_limit = 600000

        # Return standard string format
        return {
            "gasPrice": str(price_wei),
            "gasLimit": str(safe_limit)
        }

    async def get_latest_block(self, chain_key: str, address: str) -> Dict[str, Any]:
        """
        Get "Safe" Latest Block (5 blocks behind to prevent forks, ensuring full BlockHeader)
        Note: address param is unused here, kept for interface compatibility.
        """
        t_chain = self._get_tatum_chain(chain_key)
        if not t_chain:
            return {}

        try:
            if chain_key == 'tron':
                url = 'https://tron-mainnet.gateway.tatum.io/wallet/getnowblock'
                block_data = await self._request('GET', url)
                if not block_data:
                    return {}
                header_raw = block_data["block_header"]["raw_data"]
                curr_hash = block_data['blockID']
                return {
                    'hash': curr_hash,
                    "number": header_raw["number"],
                    "timestamp": header_raw["timestamp"],
                    "parentHash": header_raw["parentHash"],
                    "txTrieRoot": header_raw["txTrieRoot"],
                    "witnessAddress": header_raw["witness_address"],
                    "version": header_raw.get("version", 0)
                }

            elif chain_key == 'solana':
                url = 'https://solana-mainnet.gateway.tatum.io/'
                payload = {
                    "id": 1,
                    "jsonrpc": "2.0",
                    "method": "getLatestBlockhash",  # <--- Use this method
                    "params": [
                        {
                            "commitment": "finalized"
                        }  # Commitment param is recommended
                    ]
                }

                res = await self._request("POST", url, json_data=payload)
                if res and "result" in res:
                    # Extract core data
                    value = res["result"].get("value", {})
                    return {
                        "hash": value.get("blockhash"),
                        "number": res["result"].get("context", {}).get("slot"),  # Current Slot
                        "timestamp": int(time.time())  # API doesn't return timestamp, use current time
                    }
                return {}

            return {}
        except Exception as e:
            print(f"Tatum RPC Error: {e}")
            return {}

    async def broadcast_transaction(self, chain_key: str, tx_hex: str) -> Optional[str]:
        t_chain = self._get_tatum_chain(chain_key)
        if not t_chain:
            return None

        # Define final string data to send to Tatum
        tx_data_str = ""

        # JSON type signature
        if chain_key == 'tron':
            # If dict passed, dump to string
            if isinstance(tx_hex, dict):
                tx_data_str = json.dumps(tx_hex)
            else:
                tx_data_str = tx_hex

        # Hex type signature
        else:
            if isinstance(tx_hex, str) and tx_hex.startswith('0x'):
                tx_data_str = tx_hex[2:]
            else:
                tx_data_str = str(tx_hex)

        # Construct Final Payload
        payload = {
            "txData": tx_data_str
        }

        # Send Request
        if chain_key == 'solana':
            return await self._broadcast_solana_transaction(tx_data_str)

        res = await self._request("POST", f"{config.TATUM_BASE_URL}/v3/{t_chain}/broadcast", json_data=payload)
        if res:
            return res.get("txId") or ""
        return ""

    def _get_tatum_chain(self, key: str) -> Optional[str]:
        if key not in config.ALLOW_COINS:
            return None
        return self._chain_map.get(key.lower(), key.lower())

    def _get_contract_symbol(self, chain_lower: str):
        """Get Contract Short Name"""
        evm_map = {
            "smartchain": "BSC",
            "polygon": "MATIC",
            "ethereum": "ETH"
        }
        return evm_map.get(chain_lower, chain_lower.upper())

    async def _fetch_tron_timestamp(self, tx_id: str) -> int:
        """Query transaction timestamp via Native RPC"""
        try:
            rpc_url = "https://tron-mainnet.gateway.tatum.io/wallet/gettransactioninfobyid"
            # Note: Native Tron RPC usually sends ID via POST
            res = await self._request(
                "POST", rpc_url, {
                    "value": tx_id
                }
            )
            # Get blockTimeStamp (Standard ms timestamp)
            return int(res.get("blockTimeStamp", 0))
        except:
            return 0

    async def _get_bch_tx_detail(self, url: str, tx_hash: str, owner_address: str) -> Optional[Dict]:
        payload = {
            "method": "blockchain.transaction.get",
            "params": [tx_hash, True],
            "id": 1,
            "jsonrpc": "2.0"
        }
        res = await self._request("POST", url, json_data=payload)
        if not res or "result" not in res:
            return None
        tx_data = res["result"]

        # 1. Preprocess Address Match (BCH Specific)
        clean_owner = owner_address.split(":")[-1].lower()

        # 2. Calculate Total [Received]
        my_received = 0.0
        for vout in tx_data.get("vout", []):
            val = float(vout.get("value", 0))
            raw_addrs = vout.get("scriptPubKey", {}).get("addresses", [])
            clean_addrs = [a.split(":")[-1].lower() for a in raw_addrs]
            if clean_owner in clean_addrs:
                my_received += val

        # 3. Calculate Total [Sent]
        my_sent = 0.0
        for vin in tx_data.get("vin", []):
            # Get input value
            val = float(vin.get("value_coin", 0))
            # Derive input address
            asm = vin.get("scriptSig", {}).get("asm", "")
            parts = asm.split(" ")
            current_vin_address = "Unknown"
            if len(parts) >= 2:
                pubkey_candidate = parts[-1]
                if len(pubkey_candidate) == 66:
                    current_vin_address = pubkey_to_address_with_bch(pubkey_candidate)

            if current_vin_address.split(":")[-1].lower() == clean_owner:
                my_sent += val

        # 4. Determine From/To based on Net Value
        net_value = my_received - my_sent
        if net_value >= 0:
            f_addr, t_addr = "", owner_address
        else:
            f_addr, t_addr = owner_address, ""

        return {
            "txid": tx_hash,
            "from": f_addr,
            "to": t_addr,
            "value": abs(net_value),
            "time": tx_data.get("time", 0)
        }

    async def _get_trx_balance(self, t_chain_path: str, chain_key: str, address: str, contract: Optional[str] = None) -> str:
        """Query TRX Balance"""
        # Tron Gateway Base Address
        gateway_base = f"https://api.tatum.io/v3/tron/account/{address}"
        res = await self._request("GET", gateway_base)
        if not res:
            return self._error_default

        if contract:
            all_tokens = res.get('trc10', []) + res.get('trc20', [])
            for token in all_tokens:
                if contract in token:
                    return to_standard_amount(token[contract], chain_key, contract, True)

            return '0.000000'

        return to_standard_amount(res.get('balance', 0), chain_key, contract, True)

    async def _get_bch_balance(self, t_chain_path: str, chain_key: str, address: str, contract: Optional[str] = None) -> str:
        """Get BCH Balance"""
        url = 'https://bch-mainnet-rostrum.gateway.tatum.io'
        payload = {
            "method": "blockchain.address.get_balance",
            "params": [address],
            "id": 1,
            "jsonrpc": "2.0"
        }
        res = await self._request("POST", url, json_data=payload)
        if not res:
            return self._error_default
        confirmed_satoshi = res["result"].get("confirmed", 0)
        return to_standard_amount(confirmed_satoshi, chain_key, contract, True)

    async def _get_btc_balance(self, t_chain_path: str, chain_key: str, address: str, contract: Optional[str] = None) -> str:
        """Get BTC Balance"""
        # Special handling for BCH (bcash): remove bitcoincash: prefix
        clean_address = address
        if t_chain_path == "bcash" and ":" in address:
            clean_address = address.split(":")[-1]

        url = f"{config.TATUM_BASE_URL}/v3/{t_chain_path}/address/balance/{clean_address}"
        res = await self._request("GET", url)

        if not res:
            return self._error_default

        incoming = float(res.get('incoming', 0))
        outgoing = float(res.get('outgoing', 0))
        incoming_pending = float(res.get('incomingPending', 0))
        outgoing_pending = float(res.get('outgoingPending', 0))

        confirmed_balance = incoming - outgoing

        # 1. UX: If pending incoming (someone sent you money) -> Add immediately for better user experience
        current_balance = confirmed_balance + incoming_pending

        # 2. If pending outgoing (you are sending money) ->
        #    In UTXO, outgoing_pending usually equals your total balance (including change).
        #    If subtracted, balance drops to zero.
        #    So: If there is outgoing_pending, we [Temporarily Ignore It] and show confirmed_balance.
        if outgoing_pending > 0:
            # Maintain balance "Before Transfer"
            # Although not strictly accurate, it's friendlier than showing 0.
            # Once block confirms, outgoing increases, pending clears, and balance auto-corrects.
            final_balance = current_balance
        else:
            final_balance = current_balance - outgoing_pending

        # Fallback
        if final_balance < 0:
            final_balance = 0.0

        return to_standard_amount(final_balance, chain_key, contract)

    async def _get_eth_balance(self, t_chain_path: str, chain_key: str, address: str, contract: Optional[str] = None) -> str:
        """Get ETH Balance"""
        url = f"{config.TATUM_BASE_URL}/v3/{t_chain_path}/account/balance/{address}"
        res = await self._request("GET", url)
        if not res:
            return self._error_default
        return to_standard_amount(res.get("balance"), chain_key, contract)

    async def _get_ton_balance(self, t_chain_path: str, chain_key: str, address: str, contract: Optional[str] = None) -> str:
        """Get TON Balance"""
        url = "https://ton-mainnet.gateway.tatum.io/getAddressBalance"
        payload = {
            "address": address
        }
        res = await self._request("GET", url, params=payload)
        if not res:
            return self._error_default
        return to_standard_amount(res.get("result", 0), chain_key, contract, True)

    async def _get_trx_transactions(self, t_chain_path: str, chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """Query TRX Transactions"""
        url = f"{config.TATUM_BASE_URL}/v3/tron/transaction/account/{address}"
        if contract:
            url += "/trc20"

        res = await self._request("GET", url)
        raw_txs = res.get("transactions", []) if isinstance(res, dict) else (res if isinstance(res, list) else [])

        formatted = []
        tasks = []  # Store tasks for timestamp backfilling

        for tx in raw_txs[:limit]:
            tx_id = tx.get("txID")
            if contract:
                # 1. Parse USDT/Tokens
                item = {
                    "txid": tx_id,
                    "from": tx.get("from"),
                    "to": tx.get("to"),
                    "value": to_standard_amount(tx.get("value"), chain_key, contract, True),
                    "timestamp": 0,  # Placeholder
                    "symbol": tx.get("tokenInfo", {}).get("symbol", "USDT")
                }
                formatted.append(item)
                # Add backfill task
                tasks.append(self._fetch_tron_timestamp(tx_id))
            else:
                # ==========================================================
                # 2. Parse Native TRX (Nested rawData structure)
                # ==========================================================
                raw_data = tx.get("rawData", {})
                # Get Contract Content
                contracts = raw_data.get("contract", [])
                if not contracts:
                    continue
                param_value = contracts[0].get("parameter", {}).get("value", {})
                # Check if it's non-native TRX asset
                if 'asset_name' in param_value or 'assetNameUtf8' in param_value:
                    continue
                formatted.append(
                    {
                        "txid": tx_id,  # Prefer Base58 readable address
                        "from": param_value.get("ownerAddressBase58") or param_value.get("owner_address"),
                        "to": param_value.get("toAddressBase58") or param_value.get("to_address"),
                        "value": to_standard_amount(param_value.get("amount"), chain_key, contract, True),
                        "timestamp": int(raw_data.get("timestamp", 0)),
                        "symbol": "TRX"
                    }
                )
        # 3. Concurrent timestamp backfilling (Only for TRC20)
        if tasks:
            timestamps = await asyncio.gather(*tasks)
            # Fill timestamp back to corresponding position
            for i, ts in enumerate(timestamps):
                formatted[i]["timestamp"] = ts

        return formatted

    async def _get_bsc_transactions(self, t_chain_path: str, chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """Query BSC Transactions"""
        # Docs: https://docs.tatum.io/reference/gettransactionhistoryv4
        # Build V4 Query Params
        params = {
            "chain": "bsc-mainnet",
            "addresses": address,
            "pageSize": min(int(limit), 50),
            "sort": "DESC"
        }
        formatted = []

        if contract:
            # If contract exists, force query Token Transactions (ERC-20/BEP-20)
            params["tokenAddress"] = contract
            params["transactionTypes"] = "fungible"
        else:
            # If no contract, force query Native BNB Transactions
            params["transactionTypes"] = "native"

        url = f"{config.TATUM_BASE_URL}/v4/data/transaction/history"

        # Send Request
        res = await self._request("GET", url, params=params)

        if not res or not isinstance(res, dict):
            return []

        raw_txs = res.get("result", [])

        for tx in raw_txs:
            # Double safety: Filter out invalid tokenAddress at code level (prevent redundant API data)
            if contract and tx.get("tokenAddress", "").lower() != contract.lower():
                continue

            # Determine Direction
            is_incoming = tx.get("transactionSubtype") == "incoming"
            formatted.append(
                {
                    "txid": tx.get("hash"),
                    "from": tx.get("counterAddress") if is_incoming else tx.get("address"),
                    "to": tx.get("address") if is_incoming else tx.get("counterAddress"),
                    "value": to_standard_amount(str(tx.get("amount", "0")).lstrip('-'), chain_key, contract),
                    "timestamp": int(tx.get("timestamp") or 0),
                    "symbol": tx.get("asset") or ("BSC" if not contract else "TOKEN")
                }
            )

        return formatted

    async def _get_bch_transactions(self, t_chain_path: str, chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """Query BCH Transactions"""
        url = "https://bch-mainnet-rostrum.gateway.tatum.io"
        payload = {
            "method": "blockchain.address.get_history",
            "params": [address],
            "id": 1,
            "jsonrpc": "2.0"
        }
        formatted = []
        history_res = await self._request("POST", url, json_data=payload)
        if not history_res or "result" not in history_res:
            return []
        # Get latest N txs (Electrum usually returns in block order, reverse for latest)
        raw_history = history_res["result"][-limit:][::-1]

        # 2. Concurrent query for details of each TXID
        tasks = [self._get_bch_tx_detail(url, tx["tx_hash"], address) for tx in raw_history]
        detail_list = await asyncio.gather(*tasks)

        for tx in detail_list:
            if not tx:
                continue

            formatted.append(
                {
                    "txid": tx["txid"],
                    "from": tx["from"],
                    "to": tx["to"],
                    "value": to_standard_amount(tx["value"], chain_key, contract),
                    "timestamp": int((tx["time"] or time.time()) * 1000),
                    "symbol": "BCH"
                }
            )

        return formatted

    async def _get_eth_transactions(self, t_chain_path: str, chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """Query ETH Transactions"""
        if contract:
            target_chain = self._get_contract_symbol(chain_key.lower())
            # ERC20 Token transactions usually use specific Token interface or filter within normal txs
            url = f"{config.TATUM_BASE_URL}/v3/blockchain/token/transaction/{target_chain}/{address}/{contract}?pageSize={limit}"
        else:
            # Native Coin Transactions
            url = f"{config.TATUM_BASE_URL}/v3/{t_chain_path}/account/transaction/{address}?pageSize={limit}"
        formatted = []
        res = await self._request("GET", url)
        raw_txs = res if isinstance(res, list) else []

        for tx in raw_txs:
            formatted.append(
                {
                    "txid": tx.get("hash"),
                    "from": tx.get("from"),
                    "to": tx.get("to"),
                    "value": to_standard_amount(tx.get("amount") or tx.get("value"), chain_key, contract, True),
                    "timestamp": int(tx.get("timestamp", 0) * 1000),  # EVM usually seconds to ms
                    "symbol": tx.get("symbol") or chain_key.upper()
                }
            )
        return formatted

    async def _get_btc_transactions(self, t_chain_path: str, chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """Query BTC Transactions"""
        url = f"{config.TATUM_BASE_URL}/v3/{t_chain_path}/transaction/address/{address}?pageSize={limit}"
        res = await self._request("GET", url)
        raw_txs = res if isinstance(res, list) else []
        formatted = []
        for tx in raw_txs:
            # 1. Calculate [Received] (Outputs)
            outputs = tx.get("outputs", [])
            my_out_val = sum(float(out.get("value", 0)) for out in outputs if address in out.get("address", ""))

            # 2. Calculate [Sent] (Inputs)
            inputs = tx.get("inputs", [])
            my_in_val = sum(float(inp.get("coin", {}).get("value", 0)) for inp in inputs if address in inp.get("coin", {}).get("address", ""))

            # 3. Calculate Net Value and Direction
            net_value = my_out_val - my_in_val

            if net_value >= 0:
                f_addr = ""
                t_addr = address
            else:
                f_addr = address
                t_addr = ""

            if t_chain_path in ['dogecoin', 'litecoin']:
                # Dogecoin returns real balance
                amount = abs(net_value)
            else:
                amount = to_standard_amount(abs(net_value), chain_key, contract, True)

            formatted.append(
                {
                    "txid": tx.get("hash"),
                    "from": f_addr,
                    "to": t_addr,
                    "value": amount,
                    "timestamp": int((tx.get("time") or time.time()) * 1000),
                    "symbol": chain_key.upper()
                }
            )
        return formatted

    async def _get_ton_transactions(self, t_chain_path: str, chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """Query TON Transactions - Corrected Logic"""
        url = f"https://ton-mainnet.gateway.tatum.io/getTransactions"
        payload = {
            "address": address,
            "limit": limit
        }
        res = await self._request("GET", url, params=payload)

        result = res.get("result") if isinstance(res, dict) else []
        raw_txs = result if isinstance(result, list) else []

        # User's address is baseline
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
                # Any out_msg implies send action
                f_addr = my_address
                # Take first recipient
                t_addr = out_msgs[0].get("destination") or "Unknown"
                display_value = out_value
            elif in_value > 0:
                # --- Scenario: I received money (Incoming) ---
                # No outgoing, incoming has value
                f_addr = in_msg.get("source") or "External"
                t_addr = my_address
                display_value = in_value
            else:
                # --- Scenario: Special Action (Contract Call, Zero Value) ---
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

    async def _get_sol_transactions(self, t_chain_path: str, chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """
        Query Solana Transactions (Corrected: Use Native RPC)
        Logic: Get Signatures -> Get Transaction Details
        """
        # Use Tatum Solana RPC Gateway
        rpc_url = f"https://solana-mainnet.gateway.tatum.io"

        # 1. Step 1: Get Transaction Signatures
        payload_sigs = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getSignaturesForAddress",
            "params": [
                address,
                {
                    "limit": limit
                }
            ]
        }

        # Note: Use POST
        res_sigs = await self._request("POST", rpc_url, json_data=payload_sigs)

        # Check response
        if not res_sigs or "result" not in res_sigs:
            return []

        # Get latest N signatures
        sig_list = res_sigs["result"]

        # 2. Step 2: Concurrent Query for Transaction Details
        tasks = []
        for item in sig_list:
            sig = item.get("signature")
            if not sig:
                continue

            # Construct getTransaction request
            # Note: maxSupportedTransactionVersion: 0 is required for V0 transactions
            payload_tx = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getTransaction",
                "params": [
                    sig,
                    {
                        "encoding": "json",
                        "maxSupportedTransactionVersion": 0
                    }
                ]
            }
            tasks.append(self._request("POST", rpc_url, json_data=payload_tx))

        # Concurrent Execution
        raw_txs_details = await asyncio.gather(*tasks)

        formatted = []

        # 3. Step 3: Parse Data
        for i, res_tx in enumerate(raw_txs_details):
            if not res_tx or "result" not in res_tx or not res_tx["result"]:
                continue

            tx_data = res_tx["result"]

            # Basic Info
            # Some nodes return null blockTime, handle fault tolerance
            block_time = tx_data.get("blockTime") or int(time.time())
            signature = sig_list[i].get("signature")  # Retrieve signature from list

            meta = tx_data.get("meta")
            if not meta:
                continue

            transaction = tx_data.get("transaction", {})
            message = transaction.get("message", {})
            account_keys = message.get("accountKeys", [])

            # --- Core Parsing: Calculate Balance Change ---

            # Find my address index in accountKeys
            my_index = -1
            for idx, acc in enumerate(account_keys):
                # accountKeys can be string array or object array
                acc_str = acc if isinstance(acc, str) else acc.get("pubkey", "")
                if acc_str == address:
                    my_index = idx
                    break

            if my_index == -1:
                continue

            # Get balance before/after
            try:
                pre_bal = meta.get("preBalances", [])[my_index]
                post_bal = meta.get("postBalances", [])[my_index]
                diff = post_bal - pre_bal
            except (IndexError, TypeError):
                continue

            # --- Determine Direction ---
            if diff > 0:
                # Receive
                f_addr = ""
                t_addr = address
                amount_sol = to_standard_amount(diff, chain_key, contract, True)
            elif diff < 0:
                # Send
                f_addr = address
                t_addr = ""

                # Try to find recipient (Simple heuristic: find who's balance increased)
                all_pre = meta.get("preBalances", [])
                all_post = meta.get("postBalances", [])
                for idx in range(len(all_pre)):
                    if idx == my_index:
                        continue
                    # Someone else's balance increased, and not system account (simplified)
                    if (all_post[idx] - all_pre[idx]) > 0:
                        acc_key = account_keys[idx]
                        t_addr = acc_key if isinstance(acc_key, str) else acc_key.get("pubkey")
                        break

                amount_sol = to_standard_amount(abs(diff), chain_key, contract, True)
            else:
                # Balance unchanged (Interaction or Failed Tx)
                continue

            formatted.append({
                "txid": signature,
                "from": f_addr,
                "to": t_addr,
                "value": amount_sol,
                "timestamp": int(block_time * 1000),
                "symbol": "SOL",
            })

        return formatted

    async def _broadcast_solana_transaction(self, tx_data: str) -> str:
        """Broadcast Transaction (Solana uses Native RPC)"""
        # Use Tatum RPC Gateway directly
        # This bypasses Tatum REST API bugs and gets real on-chain errors
        rpc_url = "https://solana-mainnet.gateway.tatum.io"

        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "sendTransaction",
            "params": [
                tx_data,
                {
                    "encoding": "base58",
                    "preflightCommitment": "processed"
                }
            ]
        }

        # Send RPC Request
        res = await self._request("POST", rpc_url, json_data=payload)
        return res.get('result', '')