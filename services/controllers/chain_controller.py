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

from fastapi import APIRouter, Body, HTTPException, Query, Request
from services.blockchain_service import blockchain_service
from typing import Optional

router = APIRouter(tags=["Blockchain Operations"])

@router.get("/balance/{chain_key}/{address}")
async def api_get_balance(request: Request, chain_key: str, address: str, contract: Optional[str] = Query(None)):
    return await blockchain_service.get_account_overview(chain_key, address, contract)

@router.get("/accountResource/{chain_key}/{address}")
async def get_account_resource(request: Request, chain_key: str, address: str, contract: Optional[str] = Query(None)):
    return await blockchain_service.get_account_resource(chain_key, address, contract)

@router.get("/transaction/{chain_key}/{address}")
async def api_get_transactions(request: Request, chain_key: str,  address: str,  contract: Optional[str] = Query(None),  limit: int = Query(10)):
    return await blockchain_service.get_transaction_history(chain_key, address, contract, limit)

@router.get("/utxo/{chain_key}/{address}")
async def api_get_utxo(request: Request, chain_key: str, address: str, total_value: str = Query('0.00000001')):
    return await blockchain_service.get_utxo(chain_key, address, total_value)

@router.get("/block/{chain_key}/{address}")
async def api_get_block(request: Request, chain_key: str, address: str):
    info = await blockchain_service.get_chain_status(chain_key, address)
    if not info: raise HTTPException(status_code=502, detail="Upstream error")
    return info

@router.get("/fee/{chain_key}")
async def api_get_fee(request: Request, chain_key: str):
    return await blockchain_service.get_fee(chain_key)

@router.get("/nonce/{chain_key}/{address}")
async def api_get_nonce(request: Request, chain_key: str, address: str):
    return await blockchain_service.get_nonce(chain_key, address)

@router.get("/estimateGas/{chain_key}/{address}")
async def api_estimate_gas(request: Request, chain_key: str, address: str, contract: Optional[str] = Query(None)):
    return await blockchain_service.get_estimate_gas(chain_key, address, contract)

@router.get("/seqno/{chain_key}/{address}")
async def api_get_seqno(request: Request, chain_key: str, address: str):
    return await blockchain_service.get_seqno(chain_key, address)

@router.get("/tx/{chain_key}/{tx_id}")
async def api_get_tx(request: Request, chain_key: str, tx_id: str):
    tx = await blockchain_service.get_tx_details(chain_key, tx_id)
    if not tx: raise HTTPException(status_code=404, detail="Transaction not found")
    return tx

@router.post("/broadcast/{chain_key}")
async def api_send_tx(request: Request, chain_key: str, tx_hex: str = Body(..., embed=True)):
    result = await blockchain_service.send_tx(chain_key, tx_hex)
    if not result["success"]: raise HTTPException(status_code=400, detail=result["error"])
    return result