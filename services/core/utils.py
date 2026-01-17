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

import base58
import hashlib
from typing import Any
from decimal import Decimal
from core.config import ALLOW_TOKENS
from services.registry_service import registry_service


def pubkey_to_address_with_bch(pubkey_hex: str) -> str:
    """
    Pure Python Implementation: PublicKey -> SHA256 -> RIPEMD160 -> CashAddr Encoding
    No 'cashaddress' library required, resolving potential Import Errors on servers.
    """

    # CashAddr Charset
    CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

    def polymod(values):
        """Internal polynomial modulo function for checksum"""
        generator = [0x98f2bc8e61, 0x79b76d99e2, 0xf33e5fb3c4, 0xae2eabe2a8, 0x1e4f43e470]
        checksum = 1
        for value in values:
            top = checksum >> 35
            checksum = ((checksum & 0x07ffffffff) << 5) ^ value
            for i in range(5):
                if (top >> i) & 1:
                    checksum ^= generator[i]
        return checksum ^ 1

    def convertbits(data, frombits, tobits, pad=True):
        """Bit conversion helper"""
        acc = 0
        bits = 0
        ret = []
        maxv = (1 << tobits) - 1
        for value in data:
            acc = (acc << frombits) | value
            bits += frombits
            while bits >= tobits:
                bits -= tobits
                ret.append((acc >> bits) & maxv)
        if pad:
            if bits:
                ret.append((acc << (tobits - bits)) & maxv)
        return ret

    try:
        # 1. Calculate Hash160 of PublicKey
        pub_bytes = bytes.fromhex(pubkey_hex)
        sha = hashlib.sha256(pub_bytes).digest()
        h = hashlib.new('ripemd160')
        h.update(sha)
        hash160 = h.digest()

        # 2. Construct Payload (Version byte 0 indicates P2PKH)
        payload = [0] + list(hash160)
        payload_5bit = convertbits(payload, 8, 5)

        # 3. Calculate Checksum (Prefix: bitcoincash)
        # "bitcoincash" converted to 5-bit array: b=2, i=9, t=20, etc., followed by 0
        prefix_data = [2, 9, 20, 3, 15, 9, 14, 3, 1, 19, 8, 0]
        checksum = polymod(prefix_data + payload_5bit + [0] * 8)
        checksum_5bit = [(checksum >> (5 * i)) & 31 for i in range(7, -1, -1)]

        # 4. Assemble Final Address
        combined = payload_5bit + checksum_5bit
        addr_body = "".join([CHARSET[d] for d in combined])
        return "bitcoincash:" + addr_body

    except Exception as e:
        # Return fallback string instead of crashing
        print(f"[BCH Encoding Error] {e}")
        return f"Unknown_{pubkey_hex[:8]}"


def address_to_parameter(address: str) -> str:
    """
    Convert Tron Base58 address to 64-character zero-padded parameter for Smart Contract queries.
    Example: TCjAmob... -> 00000000000000000000000021...
    """
    try:
        # 1. Base58 decode to get Hex with Checksum (usually 21 bytes, starting with '41')
        decoded = base58.b58decode_check(address)

        # 2. Convert to Hex string and remove Tron-specific prefix '41'
        # We only need the raw 20-byte address part
        hex_address = decoded.hex()
        if hex_address.startswith('41'):
            hex_address = hex_address[2:]

        # 3. Pad with zeros on the left to align to 64 characters (EVM/TVM standard)
        return hex_address.zfill(64)
    except Exception as e:
        print(f"[Utils Error] Address conversion failed: {e}")
        return "0" * 64


def to_standard_amount(raw_value: Any, chain_key: str, contract: str = None, force_raw: bool = False) -> str:
    """
    Robust amount conversion logic.
    Converts raw smallest units (Wei/Satoshi) to human-readable decimal strings.

    :param raw_value: The raw value from blockchain (int, str, or float)
    :param chain_key: Identifier for the blockchain (e.g., 'ethereum')
    :param contract: Contract address (optional, for tokens)
    :param force_raw: If True, treats input as smallest unit and divides by decimals.
                      If False, treats input as already human-readable (identity transform).
    """
    error_mark = "-0.000000"
    decimals = None

    # 1. Strictly retrieve decimals
    if contract:
        token_info = next((t for t in ALLOW_TOKENS if t['contract'].lower() == contract.lower()), None)
        if token_info:
            decimals = token_info.get('decimals')
    else:
        coin = registry_service.get_coin_info(chain_key)
        if coin:
            decimals = coin.get('decimals')

    # If decimals not found, return error mark to indicate configuration issue
    if decimals is None:
        return error_mark

    # Handle empty or None values safely
    if raw_value is None or str(raw_value).strip() == "":
        return "0.000000"

    try:
        val_str = str(raw_value).strip()
        d_value = Decimal(val_str)

        if force_raw:
            # Perform division: Raw Value / 10^Decimals
            human_value = d_value / (Decimal(10) ** decimals)
        else:
            # Assume value is already readable
            human_value = d_value

        # Format output: Max 8 decimal places for display consistency
        display_precision = min(int(decimals), 8)
        return format(human_value, f'.{display_precision}f')

    except Exception as e:
        print(f"[Utils Error] Conversion failed for {raw_value}: {e}")
        return error_mark