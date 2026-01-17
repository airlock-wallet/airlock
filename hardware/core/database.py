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

import sqlite3
import os
import time
from typing import List, Optional
from .models import Wallet, AddressRecord


# ==========================================
# Storage Layer: SQLite Encapsulation
# Responsible for CRUD operations on watch.db
# ==========================================
class WalletDatabase:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initialize database table structure"""
        folder = os.path.dirname(self.db_path)
        if folder: os.makedirs(folder, exist_ok=True)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # 1. XPUB Table (Applicable to Secp256k1 / HD Wallets)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS wallets_xpub (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            coin TEXT,
            symbol TEXT,
            name TEXT,
            address TEXT,
            extended_public_key TEXT,
            path TEXT,
            decimals INTEGER,
            blockchain TEXT,
            curve TEXT,
            is_main INTEGER)''')

        # 2. Direct Address Table (Applicable to Ed25519)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS wallets_address (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            coin TEXT,
            symbol TEXT,
            name TEXT,
            address TEXT,
            path TEXT,
            address_index INTEGER, 
            decimals INTEGER,
            blockchain TEXT,
            curve TEXT,
            is_main INTEGER)''')

        conn.commit()
        conn.close()

    def add_wallet_xpub(self, wallet: Wallet) -> bool:
        """Add a new wallet (receives Wallet object)"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            # Convert bool to int for storage
            is_main_int = 1 if wallet.is_main else 0
            cursor.execute('''
                INSERT INTO wallets_xpub (coin, symbol, name, address, extended_public_key, path, decimals, blockchain, curve, is_main)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (wallet.coin, wallet.symbol, wallet.name, wallet.address, wallet.extended_public_key, wallet.path, wallet.decimals, wallet.blockchain, wallet.curve, is_main_int))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False  # Address duplicate
        except Exception as e:
            print(f"DB Insert Error: {e}")
            return False
        finally:
            conn.close()

    def add_wallet_address(self, wallet: AddressRecord) -> bool:
        """Add a new wallet (receives Wallet object)"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            # Convert bool to int for storage
            is_main_int = 1 if wallet.is_main else 0
            cursor.execute('''
                INSERT INTO wallets_address (coin, symbol, name, address, path, address_index, decimals, blockchain, curve, is_main)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (wallet.coin, wallet.symbol, wallet.name, wallet.address, wallet.path, wallet.address_index, wallet.decimals, wallet.blockchain, wallet.curve, is_main_int))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False  # Address duplicate
        except Exception as e:
            print(f"DB Insert Error: {e}")
            return False
        finally:
            conn.close()

    def get_wallet_xpub(self, coin: str | list = None, is_main: Optional[bool] = None) -> List[Wallet]:
        """
        Query wallets
        :param coin: Coin name (supports single string "bitcoin" or list ["bitcoin", "ethereum"])
        :param is_main: True (query main), False (query sub/24-word), None (query all)
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            # 1. Use "WHERE 1=1" trick to facilitate subsequent dynamic AND statement concatenation
            query = 'SELECT * FROM wallets_xpub WHERE 1=1'
            params = []

            # 2. Dynamically determine is_main
            # Only append SQL condition when is_main is not None
            if is_main is not None:
                query += ' AND is_main = ?'
                params.append(1 if is_main else 0)

            # 3. Dynamically determine coin (Core modification part)
            if coin:
                if isinstance(coin, list):
                    # If it is a list and not empty
                    if len(coin) > 0:
                        # Generate corresponding number of placeholders, e.g.: "?, ?, ?"
                        placeholders = ', '.join(['?'] * len(coin))
                        query += f' AND coin IN ({placeholders})'
                        # Add all elements in the list to params
                        params.extend(coin)
                else:
                    # If it is a single string
                    query += ' AND coin = ?'
                    params.append(coin)

            query += ' ORDER BY id ASC'

            cursor.execute(query, tuple(params))

            rows = cursor.fetchall()
            results = []
            for row in rows:
                results.append(Wallet(id=row['id'], coin=row['coin'], symbol=row['symbol'], name=row['name'],
                                      address=row['address'], extended_public_key=row['extended_public_key'],
                                      path=row['path'], decimals=row['decimals'], blockchain=row['blockchain'],
                                      curve=row['curve'], is_main=bool(row['is_main'])))
            return results
        except Exception as e:
            print(f"DB Query Error: {e}")
            return []
        finally:
            conn.close()

    def get_wallets_address(self, coin: str | list = None, address_index: int = 0, is_main: Optional[bool] = None) -> List[AddressRecord]:
        """
        Query wallets
        :param coin: Coin name (supports single string "bitcoin" or list ["bitcoin", "ethereum"])
        :param address_index: Default index number
        :param is_main: True (query main), False (query sub/24-word), None (query all)
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            params = []

            # 1. Use "WHERE 1=1" trick to facilitate subsequent dynamic AND statement concatenation
            query = 'SELECT * FROM wallets_address WHERE address_index = ?'
            params.append(address_index)

            # 2. Dynamically determine is_main
            # Only append SQL condition when is_main is not None
            if is_main is not None:
                query += ' AND is_main = ?'
                params.append(1 if is_main else 0)

            # 3. Dynamically determine coin (Core modification part)
            if coin:
                if isinstance(coin, list):
                    # If it is a list and not empty
                    if len(coin) > 0:
                        # Generate corresponding number of placeholders, e.g.: "?, ?, ?"
                        placeholders = ', '.join(['?'] * len(coin))
                        query += f' AND coin IN ({placeholders})'
                        # Add all elements in the list to params
                        params.extend(coin)
                else:
                    # If it is a single string
                    query += ' AND coin = ?'
                    params.append(coin)

            query += ' ORDER BY id ASC'

            cursor.execute(query, tuple(params))

            rows = cursor.fetchall()
            results = []
            for row in rows:
                results.append(AddressRecord(id=row['id'], coin=row['coin'], symbol=row['symbol'], name=row['name'],
                                             address=row['address'], path=row['path'], address_index=row['address_index'], curve=row['curve'],
                                             decimals=row['decimals'], blockchain=row['blockchain'], is_main=bool(row['is_main'])))
            return results
        except Exception as e:
            print(f"DB Query Error: {e}")
            return []
        finally:
            conn.close()

    def exists_address_and_path_by_wallets_address(self, address: str, path: str) -> bool:
        """Query if wallet exists in wallets_address"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            query = "SELECT 1 FROM wallets_address WHERE address = ? and path = ? LIMIT 1"
            cursor.execute(query, (address, path))
            result = cursor.fetchone()

            # If result has value (e.g. (1,)), return True; otherwise return False
            return result is not None
        except Exception as e:
            print(f"DB Query Error: {e}")
            return False
        finally:
            conn.close()

    def clear_all(self):
        """Clear all wallet data (used when resetting wallet)"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM wallets_xpub")
            cursor.execute("DELETE FROM wallets_address")
            # Reset auto-increment ID (optional, for aesthetics)
            cursor.execute('DELETE FROM sqlite_sequence WHERE name="wallets_xpub"')
            cursor.execute('DELETE FROM sqlite_sequence WHERE name="wallets_address"')
            conn.commit()
            print(f"[DB] Database cleared: {self.db_path}")
        except Exception as e:
            print(f"[DB] Clear failed: {e}")
        finally:
            conn.close()