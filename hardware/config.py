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
import random
import string
from core.models import Rules
import pygame

# ==========================================
# Global Configuration Center
# Centralized management of paths, constants, and business rules
# ==========================================

# Base Directory (Dynamic based on current file location)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Official Website
WEBSITE = "www.airlock.pub"

# Font Path
FONT_PATH = os.path.join(BASE_DIR, "ui/font/font.ttc")

# [Architecture Change] Node.js script path points to js directory
SCRIPT_PATH = os.path.join(BASE_DIR, "js/crypto_worker.js")

# [Architecture Change] Wallet data storage directory
WALLET_DIR = os.path.join(BASE_DIR, "wallets")
# Ensure directory exists
if not os.path.exists(WALLET_DIR):
    try:
        os.makedirs(WALLET_DIR)
    except OSError:
        pass

# Specific paths for data files
WALLET_FILE = os.path.join(WALLET_DIR, "keystore.json")        # Main wallet file
WALLET_FILE_24 = os.path.join(WALLET_DIR, "keystore_24.json")  # 24-word decoy wallet
WALLET_DB = os.path.join(WALLET_DIR, "wallet.db")                # SQLite Database
# Number of ed25519 25-word wallets to generate
WALLET_TOTAL_ED25519_HIDDEN = 100
# Number of ed25519 24-word wallets to generate
WALLET_TOTAL_ED25519_STANDARD = 10

# Config file for Language
LANG_CONFIG_FILE = os.path.join(BASE_DIR, ".LANGUAGE")

# Supported languages
SUPPORTED_LANGUAGES = {
    "en": "English",
    "zh": "简体中文"
}

# UI Display Configuration
FONT_SIZE = 12  # Font Size
LINE_HEIGHT = 16  # Line Height

# ------------------------ Security Rules Configuration ------------------------

# Passphrase (25th word) Rules
PASSPHRASE_RULES = Rules(
    min_len=16,
    require_lower=True,
    require_upper=True,
    require_digit=True,
    require_special=True
)

# Payment Password Rules
PASSWORD_RULES = Rules(
    min_len=12,
    require_lower=True,
    require_upper=True,
    require_digit=True,
    require_special=True
)

# Entropy Strength Settings
# [Suggestion] Set to 256 for 24 words default; set to 128 for 12 words.
# Original logic: 256 // 2 = 128 (12 words)
STRENGTH = 256

# BIP39 Formula: Total bits = Entropy + Checksum (Entropy/32)
# Each mnemonic word represents 11 bits
# So: Word count = (Strength + Strength // 32) // 11
MNEMONIC_LEN = (STRENGTH + (STRENGTH // 32)) // 11


# Config file path (You can change the filename as needed)
BLE_NAME_CONFIG_FILE = os.path.join(BASE_DIR, ".BLE_NAME")

def get_or_create_device_name():
    """Read Bluetooth Name"""
    # 1. Attempt to read file
    if os.path.exists(BLE_NAME_CONFIG_FILE):
        try:
            with open(BLE_NAME_CONFIG_FILE, 'r', encoding='utf-8') as f:
                name = f.read().strip()
                # Simple validation: Must start with AirLock and not be empty
                if name and name.startswith("AirLock"):
                    print(f"Loaded existing config: {name}")
                    return name
        except Exception as e:
            print(f"Error reading config file, regenerating: {e}")

    # 2. Generate new name (4-digit alphanumeric)
    # string.ascii_letters contains a-z and A-Z
    # string.digits contains 0-9
    # chars = string.ascii_letters + string.digits
    random_suffix = ''.join(random.choices(string.digits, k=6))
    new_name = f"AirLock-{random_suffix}"

    # 3. Write newly generated name to file (Persistent save)
    try:
        with open(BLE_NAME_CONFIG_FILE, 'w', encoding='utf-8') as f:
            f.write(new_name)
        print(f"Generated and saved new config: {new_name}")
    except Exception as e:
        print(f"Warning: Could not save config file: {e}")

    return new_name


# ------------------------ Bluetooth & Event Configuration ------------------------
# Must start with AirLock, otherwise device cannot be recognized
BLE_DEVICE_NAME = get_or_create_device_name()
# Custom Event IDs (For inter-thread communication)
EVENT_BLE_PAIRING_REQUEST = pygame.USEREVENT + 1
EVENT_BLE_DATA_RECEIVED = pygame.USEREVENT + 2
EVENT_BLE_STATUS_CHANGE = pygame.USEREVENT + 3
EVENT_BLE_PAIRING_CANCELLED = pygame.USEREVENT + 4
EVENT_SIGN_WORKER_DONE = pygame.USEREVENT + 5