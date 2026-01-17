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

from typing import Optional, List, Dict, Any
from .provider_interface import IBlockchainProvider
from .tatum_provider import TatumProvider
from .ankr_provider import AnkrProvider
from extend import toncenter, dash, etc, sui, etherscan, bsc_rpc, avax_rpc

class BlockchainManager(IBlockchainProvider):
    def __init__(self):
        self.tatum = TatumProvider()
        self.ankr = AnkrProvider()

    async def get_balance(self, chain_key: str, address: str, contract: Optional[str] = None) -> Any:
        if chain_key == 'ton':
            return await self.ankr.get_balance(chain_key, address, contract)
        elif chain_key == 'ripple':
            return await self.ankr.get_balance(chain_key, address, contract)
        elif chain_key == 'dash':
            return await dash.get_balance(chain_key, address)
        elif chain_key == 'classic':
            return await etc.get_balance(chain_key, address)
        elif chain_key == 'sui':
            return await sui.get_balance(chain_key, address)
        elif chain_key == 'smartchain':
            return await bsc_rpc.get_balance(chain_key, address, contract)
        elif chain_key == 'avalanchec':
            return await avax_rpc.get_balance(chain_key, address, contract)
        elif etherscan.is_support(chain_key):
            return await etherscan.get_balance(chain_key, address, contract)
        else:
            return await self.tatum.get_balance(chain_key, address, contract)

    async def get_account_resource(self, chain_key: str, address: str, contract: str = None) -> Dict:
        return await self.tatum.get_account_resource(chain_key, address, contract)

    async def get_transactions(self, chain_key: str, address: str, contract: Optional[str] = None, limit: int = 10) -> List[Dict]:
        if chain_key == 'ton':
            return await toncenter.get_ton_transactions(chain_key, address, contract, limit)
        elif chain_key == 'ripple':
            return await self.ankr.get_transactions(chain_key, address, contract, limit)
        elif chain_key == 'dash':
            return await dash.get_dash_transactions(chain_key, address, contract, limit)
        elif chain_key == 'classic':
            return await etc.get_etc_transactions(chain_key, address, contract, limit)
        elif chain_key == 'sui':
            return await sui.get_sui_transactions(chain_key, address, contract, limit)
        elif chain_key == 'smartchain':
            return await self.tatum.get_transactions(chain_key, address, contract, limit)
        elif chain_key == 'avalanchec':
            return await avax_rpc.get_transactions(chain_key, address, contract, limit)
        elif etherscan.is_support(chain_key):
            return await etherscan.get_transactions(chain_key, address, contract, limit)
        return await self.tatum.get_transactions(chain_key, address, contract, limit)

    async def get_fee(self, chain_key: str) -> Dict:
        if chain_key == 'ripple':
            return await self.ankr.get_fee(chain_key)
        elif chain_key == 'classic':
            return await etc.get_etc_estimate_fee()
        elif chain_key == 'sui':
            return await sui.get_sui_estimate_fee()
        return await self.tatum.get_fee(chain_key)

    async def get_seqno(self, chain_key: str, address: str) -> Dict:
        """Ton 查询 Seqno"""
        return await toncenter.get_ton_account(address)

    async def get_nonce(self, chain_key: str, address: str) -> int:
        if chain_key == 'classic':
            return await etc.get_nonce(chain_key, address)
        elif chain_key == 'smartchain':
            return await bsc_rpc.get_nonce(chain_key, address)
        elif chain_key == 'avalanchec':
            return await avax_rpc.get_nonce(chain_key, address)
        elif etherscan.is_support(chain_key):
            return await etherscan.get_nonce(chain_key, address)
        return await self.tatum.get_nonce(chain_key, address)

    async def get_estimate_gas(self, chain_key: str, address: str, contract: str = None) -> Dict[str, Any]:
        if chain_key == 'classic':
            return await etc.get_estimate_gas(chain_key, address, contract)
        elif chain_key == 'smartchain':
            return await bsc_rpc.get_estimate_gas(chain_key, address, contract)
        elif chain_key == 'avalanchec':
            return await avax_rpc.get_estimate_gas(chain_key, address, contract)
        elif etherscan.is_support(chain_key):
            return await etherscan.get_estimate_gas(chain_key, address, contract)
        return await self.tatum.get_estimate_gas(chain_key, address, contract)

    async def get_utxo(self, chain_key, addr, total_value) -> List[Dict[str, Any]]:
        if chain_key == 'dash':
            return await dash.get_dash_utxos(chain_key, addr)
        elif chain_key == 'sui':
            return await sui.get_sui_utxos(chain_key, addr)
        return await self.tatum.get_utxo(chain_key, addr, total_value)

    async def get_latest_block(self, chain_key, addr) -> Dict[str, Any]:
        return await self.tatum.get_latest_block(chain_key, addr)

    async def broadcast_transaction(self, chain_key, hex_str):
        if chain_key == 'ton':
            return await toncenter.broadcast_ton_transaction(hex_str)
        elif chain_key == 'ripple':
            return await self.ankr.broadcast_transaction(chain_key, hex_str)
        elif chain_key == 'dash':
            return await dash.broadcast_dash_transaction(hex_str)
        elif chain_key == 'classic':
            return await etc.broadcast_etc_transaction(hex_str)
        elif chain_key == 'sui':
            return await sui.broadcast_sui_transaction(hex_str)
        elif chain_key == 'smartchain':
            return await bsc_rpc.broadcast_transaction(chain_key, hex_str)
        elif chain_key == 'avalanchec':
            return await avax_rpc.broadcast_transaction(chain_key, hex_str)
        elif etherscan.is_support(chain_key):
            return await etherscan.broadcast_transaction(chain_key, hex_str)
        return await self.tatum.broadcast_transaction(chain_key, hex_str)
