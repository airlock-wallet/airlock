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
import asyncio
import threading
import time
import subprocess
from dataclasses import asdict
from ui.states_menu import MenuState
from ui.state_sign import TransactionSignState
from ui.context import AppContext
from core.models import Asset, TxData, Wallet, AddressRecord

# --- Localized Strings for Client Response ---
API_STRINGS = {
    "en": {
        "unsupported_coin": "Unsupported coin",
        "wallet_addr_error": "Wallet address error",
        "change_addr_error": "Change address error",
        "params_error": "Params error!",
        "params_error_idx": "Params error: index must be a number",
        "params_error_coin": "Params error: invalid coin or curve",
        "params_error_miss": "Params error: missing coin or index"
    },
    "zh": {
        "unsupported_coin": "不支持的币种",
        "wallet_addr_error": "钱包地址错误",
        "change_addr_error": "找零地址错误",
        "params_error": "参数错误!",
        "params_error_idx": "参数错误: 索引必须是数字",
        "params_error_coin": "参数错误: 无效的币种或曲线",
        "params_error_miss": "参数错误: 缺少币种或索引"
    }
}

class APIHandler:
    def __init__(self, context: AppContext):
        from core.utils import Utils
        self.ctx = context
        self.lang = Utils.get_system_language()

    def _t(self, key):
        """Translate string based on system language"""
        return API_STRINGS[self.lang].get(key, API_STRINGS["en"].get(key, key))

    def handle_packet(self, raw_data: str):
        """Handle complete data packet received via Bluetooth"""
        try:
            req = json.loads(raw_data)

            # --- Security Log Logic ---
            try:
                # 1. Shallow copy req to avoid modifying raw data needed for business logic
                log_req = req.copy()

                # 2. If params exists and is a dict, perform deep redaction
                if 'params' in log_req and isinstance(log_req['params'], dict):
                    # Shallow copy params again to prevent modifying the object pointed to by req['params']
                    log_req['params'] = log_req['params'].copy()

                    # 3. Redact sensitive fields
                    if 'password' in log_req['params']:
                        log_req['params']['password'] = '******'
                    if 'passphrase' in log_req['params']:
                        log_req['params']['passphrase'] = '******'

                print(f"[API] Raw Request: {json.dumps(log_req)}")
            except Exception as e:
                # If redaction fails (rare case), fallback to printing raw data or error message
                print(f"[API] Raw Request (Log Error): {raw_data}")

        except json.JSONDecodeError:
            print("[API] JSON Parse Error")
            self._send_error(None, "Invalid JSON")
            return

        req_id = req.get("id")
        method = req.get("method")
        params = req.get("params", {})

        print(f"[API] Method: {method}, ID: {req_id}")

        # Sync timestamp
        timestamp = params.get("timestamp")
        if timestamp:
            self._sync_system_time(timestamp)

        # get_device_info (Silent return)
        if method == "get_device_info":
            info = self.ctx.svc.get_device_info(params)
            self._send_success(req_id, info)

        # get_account (Silent return)
        elif method == "get_account":
            self._handle_get_account(req_id, method, params)

        # get_accounts (Silent return)
        elif method == "get_accounts":
            self._handle_get_accounts(req_id, method, params)

        # sign_tx (Requires UI signing)
        elif method == "sign_tx":
            # If current screen is already signing page, refuse new request to prevent UI reset
            if isinstance(self.ctx.state, TransactionSignState):
                print(f"[API] Duplicate request refused {req_id}: Device busy signing")
                self._send_error(req_id, "Device is busy (Signing)")
                return

            # 1. Basic parameter existence validation
            if not all(k in params for k in ("asset", "txData", "mode", "password")):
                self._send_error(req_id, "Protocol Error: Missing asset, txData or password")
                return

            try:
                # 2. Convert to strong typed objects
                # Safely convert using from_dict, ignoring extra fields from frontend (e.g. icon)
                asset_obj = Asset.from_dict(params['asset'])
                tx_obj = TxData.from_dict(params['txData'])
                mode = params['mode']
                password = params['password']

            except (TypeError, ValueError) as e:
                # If missing required fields (e.g. chain/symbol), caught here
                print(f"[API] Model Validation Failed: {e}")
                self._send_error(req_id, f"Model Error: {str(e)}")
                return

            coin = self.ctx.registry_map.get(asset_obj.coin)
            if not coin:
                self._send_error(req_id, self._t("unsupported_coin"))
                return

            # 3.1 Security Check: ed25519 wallet address validation
            if coin.get('curve') == 'ed25519':
                if not self.ctx.svc.check_address_and_path_exists(asset_obj.address, asset_obj.derivation_path):
                    self._send_error(req_id, self._t("wallet_addr_error"))
                    return

            # 3.2 Security Check: UTXO change address tampering check
            if tx_obj.changeAddress:
                if tx_obj.changeAddress.lower() != asset_obj.address.lower():
                    print(f"[Security] Change address tampered! Req: {tx_obj.changeAddress} vs Asset: {asset_obj.address}")
                    self._send_error(req_id, self._t("change_addr_error"))
                    return

            # 4. Define callbacks
            def on_success(data):
                self._send_success(req_id, data)

            def on_error(error_msg):
                self._send_error(req_id, error_msg)

            # 5. Change state (Pass objects)
            self.ctx.change_state(TransactionSignState(self.ctx, asset_obj, tx_obj, mode, password, on_success, on_error))

        # Add account without payment password
        elif method == 'create_account':
            self._create_account(req_id, params)

        # General system action handling
        elif method in ['reboot', 'shutdown']:
            self._schedule_system_action(req_id, method)

        # ping request
        elif method == 'ping':
            self._send_success(req_id=req_id, data="pong")

        else:
            self._send_error(req_id, f"Method '{method}' not found")

    def _create_account(self, req_id, params):
        """Add account"""
        coin = params.get("coin") or None
        if coin is None:
            return self._send_error(req_id, self._t("params_error"))

        # Determine coin type
        coin_obj = self.ctx.registry_map.get(coin) or None
        if coin_obj is None:
            return self._send_error(req_id, self._t("params_error"))

        if coin_obj['curve'] == 'secp256k1':
            # Query DB
            wallets_objs = self.ctx.svc.db.get_wallet_xpub(coin=coin)
            # Serialize (Reuse logic)
            wallets_data = [self._serialize_wallet_xpub(w) for w in wallets_objs]
        elif coin_obj['curve'] == 'ed25519':
            wallets_objs = self.ctx.svc.db.get_wallets_address(coin=coin)
            wallets_data = [self._serialize_wallet_address(w) for w in wallets_objs]
        else:
            return self._send_error(req_id, self._t("params_error"))

        # Send
        self._send_success(req_id, wallets_data)

    def _handle_get_account(self, req_id, method, params):
        """Add ed25519 type account"""
        coin = params.get('coin')
        address_index = params.get('index')
        mode = params.get('mode')


        if coin is None or address_index is None or mode is None:
            return self._send_error(req_id, self._t("params_error_miss"))

        coin_obj = self.ctx.registry_map.get(coin)
        if coin_obj is None or coin_obj.get('curve') != 'ed25519':
            return self._send_error(req_id, self._t("params_error_coin"))

        try:
            # Safe conversion, prevent "abc" string causing crash
            address_index = int(address_index) + 1
        except ValueError:
            return self._send_error(req_id, self._t("params_error_idx"))

        is_main = mode == 'HIDDEN'
        wallets_objs = self.ctx.svc.db.get_wallets_address(coin=coin, address_index=address_index, is_main=is_main)
        wallets_data = [self._serialize_wallet_address(w) for w in wallets_objs]

        # Send
        self._send_success(req_id, wallets_data)

    def _handle_get_accounts(self, req_id, method, params):
        """Handle public key export request"""
        # 1. Safely get params, prevent crash on None
        target_coins = params.get('coins') or []
        if not target_coins:
            # If no coins provided, return empty list without error
            return self._send_success(req_id, [])

        # Classification buckets
        coins_for_xpub = []  # Coins requiring xpub (secp256k1)
        coins_for_addr = []  # Coins requiring address (ed25519 / others)

        # 2. Iterate classification (Memory op, fast)
        for n in target_coins:
            # .get() defaults to None, no need for or None
            # Suggest adding .lower() for fault tolerance
            coin = self.ctx.registry_map.get(n)

            if not coin:
                continue

            # Branch by curve type
            if coin.get('curve') == 'ed25519':
                coins_for_addr.append(n)
            elif coin.get('curve') == 'secp256k1':
                coins_for_xpub.append(n)

        # Results container
        final_data = []

        # 3. Batch query DB (IO op, most time consuming, so batch it)
        if coins_for_xpub:
            objs = self.ctx.svc.db.get_wallet_xpub(coin=coins_for_xpub)
            # Extend results using list comprehension
            final_data.extend([self._serialize_wallet_xpub(w) for w in objs])

        if coins_for_addr:
            objs = self.ctx.svc.db.get_wallets_address(coin=coins_for_addr)
            final_data.extend([self._serialize_wallet_address(w) for w in objs])

        # 4. Send merged data
        self._send_success(req_id, final_data)

    def _serialize_wallet_xpub(self, wallet: Wallet):
        """
        Convert Wallet object to frontend-friendly dict format
        Unify field mapping (e.g. extended_public_key -> xpub) and type conversion
        """
        if not wallet:
            return None

        # Assuming wallet is dataclass, can access attributes directly wallet.coin
        # If not dataclass, use wallet.__dict__.get('coin')
        return {
            "coin": wallet.coin,
            "symbol": wallet.symbol,
            "name": wallet.name,
            "address": wallet.address,
            "xpub": wallet.extended_public_key,
            "path": wallet.path,
            "decimals": wallet.decimals,
            "blockchain": wallet.blockchain,
            "curve": wallet.curve,
            "is_main": 1 if wallet.is_main else 0  # bool to int
        }

    def _serialize_wallet_address(self, wallet: AddressRecord):
        if not wallet:
            return None

        # Assuming wallet is dataclass, can access attributes directly wallet.coin
        # If not dataclass, use wallet.__dict__.get('coin')
        return {
            "coin": wallet.coin,
            "symbol": wallet.symbol,
            "name": wallet.name,
            "address": wallet.address,
            "address_index": wallet.address_index,
            "path": wallet.path,
            "decimals": wallet.decimals,
            "blockchain": wallet.blockchain,
            "curve": wallet.curve,
            "is_main": 1 if wallet.is_main else 0  # bool to int
        }

    def _schedule_system_action(self, req_id, action_type):
        """
        General system action handling (shutdown/reboot)
        :param req_id: Request ID for reply
        :param action_type: 'reboot' or 'shutdown'
        """
        # 1. Safety map: map type to actual shell command
        # Use dict instead of if/else (Whitelist mechanism)
        cmd_map = {'reboot': 'sudo reboot', 'shutdown': 'sudo shutdown -h now'}

        target_cmd = cmd_map.get(action_type)
        if not target_cmd:
            print(f"Illegal system action: {action_type}")
            return

        # 2. Reply OK to frontend first
        self._send_success(req_id=req_id, data="OK")

        # 3. Define generic delayed execution function
        def execute_delayed():
            print(f"Timer triggered: Executing {action_type} ({target_cmd})")
            self.ctx.running = False
            self.ctx.system_command = target_cmd

        # 4. Start timer
        threading.Timer(3.0, execute_delayed).start()

    def _sync_system_time(self, timestamp: float) -> bool:
        """
        [Reserved Function] Sync system time,
        :param timestamp: Unix timestamp (seconds)
        """
        try:
            print(f"[System] Syncing time to: {timestamp}")
            # Safety check: ensure it is a number
            if not isinstance(timestamp, (int, float)):
                print("[System] Time format error")
                return False
            # Use date -s @timestamp to set time
            # Note: Requires sudo. Usually pi user has passwordless sudo, or program runs as root
            cmd = ["sudo", "date", "-s", f"@{timestamp}"]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode == 0:
                print(f"[System] Time sync success: {res.stdout.strip()}")
                return True
            else:
                print(f"[System] Time sync failed: {res.stderr}")
                return False
        except Exception as e:
            print(f"[System] Time setting exception: {e}")
            return False

    def _send_success(self, req_id, data):
        response = {"id": req_id, "status": "success", "data": data}
        self._send_json(response)

    def _send_error(self, req_id, error_msg):
        response = {"id": req_id, "status": "error", "error": error_msg}
        self._send_json(response)

    def _send_json(self, payload):
        json_str = json.dumps(payload)
        if self.ctx.ble:
            self.ctx.ble.send_notify(json_str)
        else:
            print(f"Failed to send data, connection not established")