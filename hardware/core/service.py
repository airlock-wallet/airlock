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
import time
import json
import subprocess
import base64
import gc
import threading
import asyncio
import config  # Import global config
from typing import Dict, Any, Optional, List
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

from bluez_peripheral.advert import Advertisement
from bluez_peripheral.util import Adapter, get_message_bus

from .models import Wallet, Asset, TxData, AddressRecord
from .database import WalletDatabase

from core.ble_impl import BleGattService, BleAgent, BluezSignalHandler, DeviceManager
from dataclasses import asdict
from core.utils import Utils

# --- Localized Strings for UI Display ---
SERVICE_STRINGS = {
    "en": {
        "unsupported_contract": "Unsupported smart contract",
        "wrong_password": "Payment password incorrect"
    },
    "zh": {
        "unsupported_contract": "不支持的智能合约",
        "wrong_password": "支付密码错误"
    }
}

# ==========================================
# Service Layer
# Responsible for invoking JS scripts, managing encrypted files, coordinating database
# ==========================================
class WalletService:
    def __init__(self, ctx):
        self.db = WalletDatabase(config.WALLET_DB)
        self.ctx = ctx

    @property
    def lang(self):
        return self.ctx.language

    def _t(self, key):
        """Translate string based on system language"""
        return SERVICE_STRINGS[self.lang].get(key, SERVICE_STRINGS["en"].get(key, key))

    def generate_mnemonic(self, passphrase: str, password: str) -> list[str] | None:
        """Create wallet mnemonic"""
        # Clear all old data before starting process!
        self._reset_environment()

        # [Security Fix] Initialize variables for finally cleanup
        payload = None
        data = None
        real_wallet_data = None
        decoy_wallet_data = None
        mnemonic_str = None

        try:
            # Generate random entropy
            sys_entropy = os.urandom(config.STRENGTH // 8)
            # [Note] String copies are created here, unavoidable in Python
            # We rely on finally block to dereference quickly
            user_mix = f"{passphrase}-{password}-{time.monotonic_ns()}".encode()
            user_entropy = hashes.Hash(hashes.SHA256())
            user_entropy.update(user_mix)
            final_hasher = hashes.Hash(hashes.SHA256())
            final_hasher.update(sys_entropy + user_entropy.finalize())
            entropy_hex = final_hasher.finalize().hex()[:(config.STRENGTH // 4)]

            payload = json.dumps({
                "command": "generate_mnemonic",
                "entropy": entropy_hex,
                "passphrase": passphrase
            })

            res = subprocess.run(['node', config.SCRIPT_PATH], input=payload, capture_output=True, text=True,
                encoding='utf-8', timeout=15)

            if res.returncode != 0:
                print(f"Node Error: {res.stderr}")
                return None

            data = json.loads(res.stdout)
            if data['status'] != 'success':
                return None

            mnemonic_str = data['mnemonic']

            # 3. Save real wallet
            real_wallet_data = {
                "mnemonic": mnemonic_str,
                "passphrase": passphrase,
                "isImported": False
            }

            # Save to main file
            if not self.save_keystore(real_wallet_data, password, config.WALLET_FILE):
                return None

            # 4. Save 24-word wallet (Mnemonic + Empty Passphrase) -> keystore_24.json
            # The 24-word wallet uses the exact same mnemonic, but without a Passphrase
            decoy_wallet_data = {
                "mnemonic": mnemonic_str,
                "passphrase": "",
                "isImported": False
            }

            # Save to 24-word file
            if not self.save_keystore(decoy_wallet_data, password, config.WALLET_FILE_24):
                return None

            # Verify
            verify_data = self.load_keystore(payment_password=password)
            if not verify_data or 'mnemonic' not in verify_data:
                print("Error reading file")
                return

            words = verify_data['mnemonic'].strip().split()

            # Clean up verify_data here too
            del verify_data

            # 3. Double check length (Double insurance)
            if len(words) != config.MNEMONIC_LEN:
                print(f"FATAL: Mnemonic length mismatch! Got {len(words)}")
                return None

            # Generate default coin addresses (DB insert)
            self.create_default_wallets(mnemonic_str, passphrase, is_main=True)
            self.create_default_wallets(mnemonic_str, "", is_main=False)

            return words
        except Exception as e:
            print(f"Error occurred: {e}")
            return None
        finally:
            # [Security Fix] Explicitly clean intermediate variables
            if payload:
                del payload
            if data:
                del data
            if real_wallet_data:
                del real_wallet_data
            if decoy_wallet_data:
                del decoy_wallet_data
            if mnemonic_str:
                del mnemonic_str
            gc.collect()  # [Security Fix] Force GC

    def save_keystore(self, wallet_data: Dict[str, Any], payment_password: str, filepath: str) -> bool:
        plaintext = None
        password_bytes = None
        try:
            folder_path = os.path.dirname(filepath)
            if folder_path:
                os.makedirs(folder_path, exist_ok=True)

            # 1. Prepare plaintext
            plaintext = json.dumps(wallet_data).encode('utf-8')
            password_bytes = payment_password.encode('utf-8')

            # 2. Generate random Salt - 16 bytes for KDF
            salt = os.urandom(16)

            # 3. Key Derivation (PBKDF2-HMAC-SHA256)
            # Convert user weak password to 32 byte strong key
            kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=100000,  # Iterate 100k times to increase cracking cost
            )
            key = kdf.derive(password_bytes)

            # 4. AES-GCM Encryption
            nonce = os.urandom(12)  # Recommend 12 byte Nonce
            aesgcm = AESGCM(key)
            ciphertext = aesgcm.encrypt(nonce, plaintext, None)  # GCM mode doesn't need padding, has built-in MAC check

            # 5. Construct storage structure (Convert all to Base64 strings for JSON storage)
            keystore = {
                "version": 1,
                "cipher": "aes-256-gcm",
                "kdf": "pbkdf2-sha256",
                "salt": base64.b64encode(salt).decode('utf-8'),
                "nonce": base64.b64encode(nonce).decode('utf-8'),
                "ciphertext": base64.b64encode(ciphertext).decode('utf-8')
            }

            # 6. Write to file
            with open(filepath, 'w') as f:
                json.dump(keystore, f, indent=2)

            print(f"Keystore saved encrypted to: {filepath}")
            return True
        except Exception as e:
            print(f"Save Error: {e}")
            return False
        finally:
            # [Security Fix] Ensure plaintext and password bytes are deleted
            if plaintext:
                del plaintext
            if password_bytes:
                del password_bytes
            # key, kdf objects handled by GC, but we can manually hint
            gc.collect()

    def load_keystore(self, payment_password: str, wallet_file: str = None) -> Optional[Dict[str, Any]]:
        """
        Utility method to test decryption and verify if password is correct.
        """
        if wallet_file is None:
            wallet_file = config.WALLET_FILE

        try:
            if not os.path.exists(wallet_file):
                print("Keystore file not found")
                return None

            with open(wallet_file, 'r') as f:
                keystore = json.load(f)

            # 1. Decode Base64
            salt = base64.b64decode(keystore['salt'])
            nonce = base64.b64decode(keystore['nonce'])
            ciphertext = base64.b64decode(keystore['ciphertext'])

            # 2. Regenerate key
            kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=100000, )
            try:
                key = kdf.derive(payment_password.encode('utf-8'))
            except Exception as err:
                # Theoretically derive won't fail, verify will, but here we generate key
                print(f"Decryption error: {err}")
                return

            # 3. Decrypt (If key is wrong or data tampered, this will raise exception)
            aesgcm = AESGCM(key)
            plaintext = aesgcm.decrypt(nonce, ciphertext, None)

            return json.loads(plaintext.decode('utf-8'))

        except Exception as e:
            print(f"Decryption failed (probably wrong password): {e}")
            return None

    def import_wallet(self, mnemonic_list: list[str], passphrase: str, password: str) -> bool:
        """Import wallet"""
        # Clear all old data before starting process!
        self._reset_environment()

        # Define variables for cleanup
        mnemonic_str = None
        payload = None
        wallet_data = None
        decoy_data = None

        try:
            mnemonic_str = " ".join(mnemonic_list)

            # 1. Call Node.js to verify mnemonic (Check Checksum) and get wallet info
            # Assuming JS script supports 'recover_wallet' command
            payload = json.dumps({
                "command": "validate_mnemonic",
                "mnemonic": mnemonic_str
            })

            res = subprocess.run(['node', config.SCRIPT_PATH], input=payload, capture_output=True, text=True,
                encoding='utf-8', timeout=15)

            if res.returncode != 0:
                print(f"Node Verify Error: {res.stderr}")
                return False

            data = json.loads(res.stdout)
            if data.get('status') != 'success' or data.get('isValid') is False:
                print("Mnemonic invalid or verification failed")
                return False

            # 2. Prepare data to save
            wallet_data = {
                "mnemonic": mnemonic_str,
                "passphrase": passphrase,
                "isImported": True
            }

            # 3. Save real wallet
            if not self.save_keystore(wallet_data, password, config.WALLET_FILE):
                return False

            # 4. Save 24-word wallet (Same mnemonic, but without Passphrase)
            # If user imports without Passphrase, 24-word and real wallet are the same
            decoy_data = {
                "mnemonic": mnemonic_str,
                "passphrase": "",  # Force empty
                "isImported": True
            }
            if not self.save_keystore(decoy_data, password, config.WALLET_FILE_24):
                return False

            # 5. Generate default coin addresses (DB insert)
            self.create_default_wallets(mnemonic_str, passphrase, is_main=True)
            self.create_default_wallets(mnemonic_str, "", is_main=False)

            return True

        except Exception as e:
            print(f"Import Exception: {e}")
            return False
        finally:
            # [Security Fix] Clean up large strings
            if mnemonic_str:
                del mnemonic_str
            if payload:
                del payload
            if wallet_data:
                del wallet_data
            if decoy_data:
                del decoy_data
            gc.collect()  # [Security Fix] Force GC

    def create_default_wallets(self, mnemonic_str: str, passphrase: str, is_main: bool):
        word = '25-word' if is_main else '24-word'
        print(f"Generating {word} wallet addresses...")

        results = self.get_coin_keys(mnemonic_str, passphrase, is_main)
        if not results:
            print("Batch generation returned empty, check logs")
            return

        # DB Insert
        for result in results:
            if result.get('status') != 'success':
                print(f"Error generating {result.get('coin')}: {result.get('message')}")
                continue

            try:
                extendedPublicKey = result.get('extendedPublicKey')
                coin = result.get('coin')
                symbol = result.get('symbol')
                name = result.get('name')
                path = result.get('path')
                address = result.get('address')
                decimals = result.get('decimals')
                blockchain = result.get('blockchain')
                curve = result.get('curve')
                if extendedPublicKey:
                    wallet = Wallet(coin=coin, path=path, address=address, extended_public_key=extendedPublicKey, symbol=symbol, name=name, decimals=decimals,
                        blockchain=blockchain, curve=curve, is_main=is_main)
                    self.db.add_wallet_xpub(wallet)
                else:
                    address_index = int(path.rsplit('/', 1)[-1].rstrip("'"))
                    addressRecord = AddressRecord(coin=coin, path=path, address=address, symbol=symbol, name=name, address_index=address_index, decimals=decimals,
                        blockchain=blockchain, curve=curve, is_main=is_main)
                    self.db.add_wallet_address(addressRecord)

            except Exception as e:
                print(f"DB insert exception {res['coin']}: {e}")

    def wallet_exists(self, wallet_file: str = None) -> bool:
        if wallet_file is None:
            wallet_file = config.WALLET_FILE
        return os.path.exists(wallet_file)

    def get_device_info(self, params):
        """Get basic device status"""
        from core import Utils
        return {
            "name": config.BLE_DEVICE_NAME,
            "version": "1.0",
            "is_initialized": self.wallet_exists(),
            "hardware": "RaspberryPI Zero 2 W",
            "screen": "SSD1306",
            "CPU": Utils.get_cpu_temp()
        }

    def get_all_xpubs(self):
        """Get extended public keys for all main wallets (for frontend sync)"""
        # Query wallets where is_main=True
        wallets = self.db.get_wallet_xpub()

        result = []
        for w in wallets:
            result.append({
                "coin": w.coin,
                "symbol": w.symbol,
                "address": w.address,
                "xpub": w.extended_public_key,
                "path": w.path,
                "name": w.name
            })
        return result

    def get_xpub_by_coin(self, coin):
        """Get xpub for specific coin"""
        wallets = self.db.get_wallet_xpub(coin=coin)
        if not wallets:
            return None
        w = wallets[0]
        return {
            "coin": w.coin,
            "symbol": w.symbol,
            "xpub": w.extended_public_key,
            "address": w.address,
            "path": w.path
        }

    def get_coin_keys(self, mnemonic: str, passphrase: str, is_main: bool) -> List | None:
        payload = None
        try:
            num = config.WALLET_TOTAL_ED25519_HIDDEN if is_main else config.WALLET_TOTAL_ED25519_STANDARD
            payload = json.dumps({
                "command": "get_keys_batch",
                "mnemonic": mnemonic,
                "passphrase": passphrase,
                "num": num
            })
            res = subprocess.run(['node', config.SCRIPT_PATH], input=payload, capture_output=True, text=True, encoding='utf-8', timeout=120)
            if res.returncode != 0:
                print(f"Node Batch Error: {res.stderr}")
                return None

            data = json.loads(res.stdout)
            if data['status'] != 'success':
                print(f"Node Logic Error: {data.get('message')}")
                return None
            return data['results']
        except Exception as e:
            print(f"Get Keys Error: {e}")
            return None
        finally:
            if payload:
                del payload

    def sign_transaction(self, asset: Asset, tx: TxData, mode: str, password: str) -> dict:
        """
        Core signing logic (Refactored)
        Logic:
        1. Receive password from frontend
        2. Attempt to decrypt keystore (return error if fails)
        3. Extract mnemonic -> Send to Node.js for signing
        """
        payload = None
        mnemonic = None
        wallet_data = None

        # Method name to call
        if asset.contract:
            if asset.blockchain == 'Tron':
                method = 'signTrc20Transfer'
            elif asset.blockchain == 'Ethereum':
                method = 'signErc20Transfer'
            else:
                return {
                    "status": "error",
                    "error": self._t("unsupported_contract")
                }
        else:
            method = 'signTransfer'

        try:
            # Select wallet file
            wallet_file = config.WALLET_FILE_24
            if mode == 'HIDDEN':
                wallet_file = config.WALLET_FILE
            wallet_data = self.load_keystore(payment_password=password, wallet_file=wallet_file)

            if not wallet_data:
                print("[Service] Keystore decryption failed, password incorrect")
                return {
                    "status": "error",
                    "error": self._t("wrong_password")
                }

            mnemonic = wallet_data.get('mnemonic')
            passphrase = wallet_data.get('passphrase', "")

            params = {
                "command": "sign_transaction",
                "method": method,
                "mnemonic": mnemonic,
                "passphrase": passphrase,
                "asset": asdict(asset),
                "txData": asdict(tx)
            }

            # Call Node.js to sign
            payload = json.dumps(params)
            print(f"[Service] Calling Worker to sign: {asset.coin}...")

            # Start subprocess
            res = subprocess.run(['node', config.SCRIPT_PATH], input=payload, capture_output=True, text=True, encoding='utf-8', timeout=45)

            if res.returncode != 0:
                print(f"[Service] Node process error: {res.stderr}")
                return {
                    "status": "error",
                    "error": f"Node Internal Error"
                }

            # 4. Parse result
            # Expected: {"status": "success", "output": "0x..."}
            result = json.loads(res.stdout)
            print(f'Signing result:{result}')
            return result

        except Exception as e:
            print(f"[Service] Signing exception: {e}")
            return {
                "status": "error",
                "error": str(e)
            }

        finally:
            # ===============================================
            # [Security Critical] Destroy sensitive references immediately
            # ===============================================
            if payload:
                del payload
            if mnemonic:
                del mnemonic
            if wallet_data:
                del wallet_data
            # Force GC, shorten private key lifetime in memory
            gc.collect()

    def check_address_and_path_exists(self, address: str, path: str) -> bool:
        return self.db.exists_address_and_path_by_wallets_address(address, path)

    # --- Helper: Reset Environment ---
    def _reset_environment(self):
        """Completely clear old data before creating/importing new wallet"""
        print("Resetting wallet environment...")
        # 1. Clear DB table content (keep file structure)
        self.db.clear_all()

        # 2. Delete old Keystore file (Double insurance, save_keystore overwrites, but deleting is safer)
        if os.path.exists(config.WALLET_FILE):
            try:
                os.remove(config.WALLET_FILE)
            except:
                pass

        if os.path.exists(config.WALLET_FILE_24):
            try:
                os.remove(config.WALLET_FILE_24)
            except:
                pass


# ==========================================
# Bluetooth Communication Service (Background Thread)
# ==========================================
class BLEService(threading.Thread):
    def __init__(self):
        super().__init__()
        self.daemon = True  # Set as daemon thread, exit with main program
        self.loop = None
        self.bus = None
        self.service = None
        self.agent = None
        self.adapter = None
        self.advert = None
        self.device_manager = None

    def run(self):
        """Thread entry: Start asyncio event loop"""
        try:
            # Create new event loop
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)

            # Start BLE task
            self.loop.run_until_complete(self._start_ble())

            # Run loop
            print("[BLE Service] Event loop started...")
            self.loop.run_forever()

        except Exception as e:
            print(f"[BLE Service] Thread exception exit: {e}")
        finally:
            if self.loop:
                self.loop.close()

    async def _start_ble(self):
        print("[BLE Service] Initializing D-Bus...")
        self.bus = await get_message_bus()

        # 1. Register GATT service
        self.service = BleGattService()
        await self.service.register(self.bus)

        # 2. Get and configure adapter
        self.adapter = await Adapter.get_first(self.bus)
        await self.adapter.set_alias(config.BLE_DEVICE_NAME)
        await self.adapter.set_powered(True)
        # Ensure adapter is discoverable and pairable
        await self.adapter.set_discoverable(True)
        await self.adapter.set_pairable(True)

        # 3. Initialize components
        print("[BLE Service] Initializing DeviceManager and SignalHandler...")
        self.device_manager = DeviceManager(self.bus)

        handler = BluezSignalHandler(self.bus)
        self.bus.add_message_handler(handler.process_dbus_message)
        await handler.setup_bluez_monitoring()

        # 4. Register pairing agent (No longer passing dummy_cb)
        print("[BLE Service] Registering secure pairing agent...")
        self.agent = BleAgent(self.bus)
        # Capability="DisplayOnly" means telling phone: I have screen to show passkey, but no keyboard input
        # This triggers Numeric Comparison (Phone popup, Pi popup, user compares)
        await self.agent.register(self.bus, default=True)

        # 5. Start advertising
        self.advert = Advertisement(config.BLE_DEVICE_NAME, ["0000beef-0000-1000-8000-00805f9b34fb"], 0, 0)
        await self.advert.register(self.bus, self.adapter)

        print(f"[BLE Service] Bluetooth service ready, advertising: {config.BLE_DEVICE_NAME}")

    def send_notify(self, data):
        """ UI thread calls this method """
        print(f"Preparing to send async data {len(data)} bytes...")
        if self.loop and self.loop.is_running() and self.service:
            # [Fix] Use run_coroutine_threadsafe to submit coroutine object
            # self.service.send_data(data) call returns a coroutine object immediately, non-blocking
            future = asyncio.run_coroutine_threadsafe(self.service.send_data(data), self.loop)

            # Optional: Add callback to monitor if executed (for debug)
            future.add_done_callback(lambda f: print(f"Task finish status: {f.done()}"))
        else:
            print("[BLE Error] Cannot send: Service not ready or Loop not running")

    def get_trusted_devices_sync(self):
        """UI calls this method to get device list (blocking until return)"""
        print("[BLE Service] UI requesting device list (SYNC Call)...")

        if self.device_manager is None:
            print("[FATAL] DeviceManager is None!")
            return []

        if not self.loop:
            print("[FATAL] Event Loop not running!")
            return []

        future = asyncio.run_coroutine_threadsafe(self.device_manager.get_trusted_devices(), self.loop)
        try:
            res = future.result(timeout=5.0)
            print(f"[BLE Service] Sync call returned: {len(res)} devices")
            return res
        except Exception as e:
            print(f"[BLE Service] Sync error: {e}")
            return []

    def remove_device_sync(self, device_path):
        """UI calls this method to remove device"""
        if not self.loop or not self.device_manager:
            return False

        future = asyncio.run_coroutine_threadsafe(self.device_manager.remove_device(device_path), self.loop)
        try:
            return future.result(timeout=5.0)
        except Exception as e:
            print(f"Sync remove error: {e}")
            return False

    def stop(self):
        """Stop service"""
        if self.loop:
            print("Bluetooth thread stopped")
            self.loop.call_soon_threadsafe(self.loop.stop)