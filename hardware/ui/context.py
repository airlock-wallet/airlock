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

import pygame
import gc
import os
import json
import config
from hardware import Hardware
from core import WalletService, BLEService
from core.utils import Utils

current_dir = os.path.dirname(__file__)
json_path = os.path.abspath(os.path.join(current_dir, "../registry.json"))
print(f"Loading registry from: {json_path}")

try:
    with open(json_path, "r", encoding="utf-8") as f:
        REGISTRY_LIST = json.load(f)
        # Generate a fast lookup dictionary for id -> object
        REGISTRY_DICT = {coin["id"]: coin for coin in REGISTRY_LIST}
except FileNotFoundError:
    print("FATAL: registry.json not found!")
    exit(0)

# ==========================================
# 5. UI Framework (Context)
# ==========================================
class AppContext:
    def __init__(self):
        self.hw = Hardware()
        self.svc = WalletService()
        self.ble = BLEService()
        self.running = True
        self.clock = pygame.time.Clock()
        self.state = None
        self.system_command = None
        self.registry_list = REGISTRY_LIST
        self.registry_map = REGISTRY_DICT

        # Initialize Language
        # Logic: Config File -> System Locale -> Default (en)
        self.language = self._load_language()

    def _load_language(self):
        """Load language from file. If missing, fallback to system language."""
        if os.path.exists(config.LANG_CONFIG_FILE):
            try:
                with open(config.LANG_CONFIG_FILE, 'r') as f:
                    lang = f.read().strip()
                    if lang in config.SUPPORTED_LANGUAGES:
                        print(f"Loaded language from config: {lang}")
                        return lang
            except Exception as e:
                print(f"Error loading language config: {e}")

        # Fallback
        sys_lang = Utils.get_system_language()
        print(f"Config not found, falling back to system language: {sys_lang}")
        return sys_lang

    def set_language(self, lang_code):
        """Set language, save to file, and refresh UI"""
        if lang_code not in config.SUPPORTED_LANGUAGES:
            return

        self.language = lang_code
        print(f"Language switched to: {self.language}")

        # Persist to file
        try:
            with open(config.LANG_CONFIG_FILE, 'w') as f:
                f.write(lang_code)
        except Exception as e:
            print(f"Error saving language config: {e}")

        # Refresh current state to apply language change
        from ui.states_menu import MenuState
        self.change_state(MenuState(self))

    def change_state(self, new_state):
        # Old state is destroyed on switch, force a GC here,
        # ensuring residual InputState strings in the old state are collected
        self.state = new_state
        gc.collect()
        self.state.on_enter()