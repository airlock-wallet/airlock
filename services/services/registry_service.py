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

import json
from core.config import REGISTRY_PATH


class RegistryService:
    def __init__(self):
        try:
            with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
                self.list = json.load(f)
                self.dict = {coin["id"]: coin for coin in self.list}
        except Exception as e:
            print(f"FATAL: Could not load registry.json: {e}")
            self.list = []
            self.dict = {}

    def get_coin_info(self, coin_id: str):
        return self.dict.get(coin_id)


# --- Singleton Instance ---
registry_service = RegistryService()
