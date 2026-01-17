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

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class IBlockchainProvider(ABC):
    @abstractmethod
    async def get_balance(self, chain_key: str, address: str, contract: Optional[str] = None) -> Any: pass

    @abstractmethod
    async def get_account_resource(self, chain_key: str, address: str, contract: str = None) -> Dict: pass

    @abstractmethod
    async def get_utxo(self, chain_key: str, address: str, totalValue: str) -> List[Dict[str, Any]]: pass

    @abstractmethod
    async def get_latest_block(self, chain_key: str, address: str) -> Dict[str, Any]: pass

    @abstractmethod
    async def get_fee(self, chain_key: str) -> Dict: pass

    @abstractmethod
    async def get_nonce(self, chain_key: str, address: str) -> int: pass

    @abstractmethod
    async def get_estimate_gas(self, chain_key: str, address: str, contract: str = None) -> Dict[str, Any]: pass

    @abstractmethod
    async def get_seqno(self, chain_key: str, address: str) -> Dict: pass

    @abstractmethod
    async def get_transactions(self, chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]: pass

    @abstractmethod
    async def broadcast_transaction(self, chain_key: str, tx_hex: str) -> str: pass