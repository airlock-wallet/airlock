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

import asyncio
from typing import cast, Type
from contextlib import asynccontextmanager
from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from core import config
from controllers import chain_controller, app_controller


# --- Define Lifespan Manager ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[System] Initializing semaphores...")
    config.SEM_BINANCE = asyncio.Semaphore(2)
    config.SEM_OKX = asyncio.Semaphore(2)
    config.SEM_COINGECKO = asyncio.Semaphore(2)
    config.SEM_TATUM = asyncio.Semaphore(2)
    config.SEM_ANKR = asyncio.Semaphore(2)

    yield  # Separation point: Application is now running

    # Resource cleanup (e.g., closing database connection pools)
    print("[System] Shutting down...")


# --- Initialize FastAPI Application ---
# Pass the lifespan function into the FastAPI instance
app = FastAPI(title="Airlock Backend Enterprise", lifespan=lifespan)

# --- Middleware and Routing ---
app.add_middleware(cast(Type[BaseHTTPMiddleware], GZipMiddleware), minimum_size=1000)
app.include_router(chain_controller.router)
app.include_router(app_controller.router)

if __name__ == "__main__":
    import uvicorn

    # Use string format for startup to support hot-reloading
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)