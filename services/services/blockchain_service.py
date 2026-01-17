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

from core.blockchain_manager import BlockchainManager
from services.registry_service import registry_service
from typing import List, Dict, Any

class BlockchainService:
    def __init__(self):
        self.provider = BlockchainManager()

    async def get_account_overview(self, chain_key: str, address: str, contract: str = None) -> Dict:
        """Fetch account balance"""
        base_dict = {"chain": chain_key, "address": address, "contract": contract}
        balance = await self.provider.get_balance(chain_key, address, contract)
        if isinstance(balance, Dict):
            return {**base_dict, **balance}
        return {**base_dict, "balance": balance}

    async def get_account_resource(self, chain_key: str, address: str, contract: str = None) -> Dict:
        result = await self.provider.get_account_resource(chain_key, address, contract)
        # Supplement constant configurations:
        # Includes TRX energy price and base consumption for smart contracts
        result['feeBandwidth'] = 0.001
        result['feeEnergy'] = 0.00021
        result['feeActivation'] = 1
        result['feeEnergyNeeded'] = 65000
        return result

    async def get_transaction_history(self, chain_key: str, address: str, contract: str = None, limit: int = 10):
        """Fetch transaction history records"""
        return await self.provider.get_transactions(chain_key, address, contract, limit)

    async def get_utxo(self, chain_key: str, address: str, total_value: str) -> List[Dict[str, Any]]:
        return await self.provider.get_utxo(chain_key, address, total_value)

    async def get_fee(self, chain_key: str) -> Dict:
        return await self.provider.get_fee(chain_key)

    async def get_nonce(self, chain_key: str, address: str) -> int:
        """Fetch EVM Nonce"""
        return await self.provider.get_nonce(chain_key, address)

    async def get_seqno(self, chain_key: str, address: str) -> Dict:
        return await self.provider.get_seqno(chain_key, address)

    async def get_estimate_gas(self, chain_key: str, address: str, contract: str = None) -> Dict[str, Any]:
        """Fetch EVM Gas Estimate"""
        return await self.provider.get_estimate_gas(chain_key, address, contract)

    async def get_chain_status(self, chain_key: str, address: str):
        return await self.provider.get_latest_block(chain_key, address)

    async def get_tx_details(self, chain_key: str, tx_id: str):
        return await self.provider.get_transaction(chain_key, tx_id)

    async def send_tx(self, chain_key: str, tx_hex: str):
        tx_id = await self.provider.broadcast_transaction(chain_key, tx_hex)
        return {"success": True, "txid": tx_id} if tx_id else {"success": False, "error": "Broadcast failed"}


# Singleton instance
blockchain_service = BlockchainService()