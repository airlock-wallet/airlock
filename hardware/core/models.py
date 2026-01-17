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

from dataclasses import dataclass, field
from typing import Optional, List
from enum import Enum

# ==========================================
# Data Model Layer
# Defines data structures used in the system
# ==========================================

@dataclass
class Rules:
    """Password strength rules definition"""
    min_len: int = 12
    require_upper: bool = True
    require_lower: bool = True
    require_digit: bool = True
    require_special: bool = True


@dataclass
class Wallet:
    """Wallet data object, corresponds to a row in the database"""
    coin: str # registry.json -> id
    symbol: str
    name: str
    address: str
    extended_public_key: str  # Extended public key
    path: str  # Derivation path
    decimals: int
    blockchain: str
    curve: str
    is_main: bool = True
    id: Optional[int] = None


@dataclass
class AddressRecord:
    """Direct address model (Ed25519)"""
    coin: str # registry.json -> id
    symbol: str
    name: str
    address: str
    path: str
    address_index: int
    decimals: int
    blockchain: str
    curve: str
    is_main: bool = True
    id: Optional[int] = None

@dataclass
class Asset:
    """
    Asset model (Corresponds to frontend database 'assets' table)
    """
    coin: str
    symbol: str
    name: str
    blockchain: str
    contract: str
    decimals: int
    curve: str
    balance: str
    icon: str
    address: str
    derivation_path: str
    derivation_index: int

    # Ignore extra fields from frontend (Similar to Java's @JsonIgnoreProperties(ignoreUnknown = true))
    @classmethod
    def from_dict(cls, data: dict):
        # 1. Filter extra fields (Prevent TypeError: unexpected keyword argument)
        valid_keys = cls.__dataclass_fields__.keys()
        filtered = {k: v for k, v in data.items() if k in valid_keys}

        # 2. Construct object (If required fields like 'coin' are missing, TypeError will be raised)
        obj = cls(**filtered)

        # 3. Type coercion and business validation (Raise ValueError)
        try:
            obj.decimals = int(obj.decimals)
        except (ValueError, TypeError):
            raise ValueError(f"Asset decimals must be an integer, got {obj.decimals}")

        if not obj.symbol:
            raise ValueError("Asset symbol cannot be empty")

        if not obj.coin:
            raise ValueError("Asset chain cannot be empty")

        return obj


@dataclass
class TxData:
    """
    Transaction intent data model
    """
    amount: str
    toAddress: str

    # General optional fields
    memo: Optional[str] = None
    timestamp: Optional[int] = None

    # EVM / Account model fields
    nonce: Optional[str] = None
    gasLimit: Optional[str] = None
    gasPrice: Optional[str] = None
    chainId: Optional[str] = None
    data: Optional[str] = None

    # UTXO model fields
    byteFee: Optional[str] = None
    utxos: List[dict] = field(default_factory=list)  # Keep list[dict] structure to pass to worker
    changeAddress: Optional[str] = None
    useMax: Optional[bool] = False

    # XRP / Cosmos specific
    destinationTag: Optional[str] = None
    sequence: Optional[str] = None
    accountNumber: Optional[str] = None

    # TRON model fields
    blockHeader: Optional[dict] = field(default_factory=dict)
    contractAddress: Optional[str] = None

    # TON model fields
    sequenceNumber: Optional[int] = None
    sendMode: Optional[int] = None
    isDeployed: Optional[bool] = None
    attachedGas: Optional[str] = None

    # SOL model fields
    recentBlockhash: Optional[str] = None

    # XRP model fields
    lastLedgerSequence: Optional[int] = None

    @classmethod
    def from_dict(cls, data: dict):
        valid_keys = cls.__dataclass_fields__.keys()
        filtered = {k: v for k, v in data.items() if k in valid_keys}

        obj = cls(**filtered)

        # Business validation
        if not obj.amount or not str(obj.amount).isdigit():
            raise ValueError(f"Tx amount must be a digit string, got {obj.amount}")

        if not obj.toAddress:
            raise ValueError("Tx to_address cannot be empty")

        return obj