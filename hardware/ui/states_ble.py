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

import time
import pygame
import config
from .base_state import State
from .states_menu import MenuState
from core.utils import Utils

# --- Localized Strings for BLE Management ---
BLE_STRINGS = {
    "en": {
        "pair_title": "Bluetooth Pairing",
        "passkey": "Passkey: {}",
        "confirm_usb": "[Enter] Confirm",
        "reject_usb": "[Esc] Reject",
        "confirm_gpio": "[#] Confirm",
        "reject_gpio": "[*] Reject",
        "remove_title": "Untrust this device?",
        "device_row": "Device: {}",
        "processing": "Processing...",
        "loading": "Reading devices...",
        "manage_title": "Connection Manager",
        "no_devices": "No trusted devices",
        "back_hint": "[Esc] Back"
    },
    "zh": {
        "pair_title": "蓝牙配对请求",
        "passkey": "配对码: {}",
        "confirm_usb": "[Enter] 确认",
        "reject_usb": "[Esc] 拒绝",
        "confirm_gpio": "[#] 确认",
        "reject_gpio": "[*] 拒绝",
        "remove_title": "取消对以下设备的信任?",
        "device_row": "设备: {}",
        "processing": "正在处理...",
        "loading": "正在读取设备...",
        "manage_title": "蓝牙连接管理",
        "no_devices": "无已信任设备",
        "back_hint": "[Esc] 返回"
    }
}

# Bluetooth Pairing Confirmation Popup
class PairingRequestState(State):
    def __init__(self, ctx, passkey, future):
        super().__init__(ctx)
        self.passkey = passkey
        self.future = future
        self.lang = self.ctx.language

        if self.ctx.hw.usb_bridge.reconnect():
            yes = self._t("confirm_usb")
            no = self._t("reject_usb")
        else:
            yes = self._t("confirm_gpio")
            no = self._t("reject_gpio")

        self.lines = [self._t("pair_title"), self._t("passkey").format(self.passkey), yes, no]

    def _t(self, key):
        return BLE_STRINGS[self.lang].get(key, BLE_STRINGS["en"][key])

    def on_keydown(self, event):
        # [Listen for cancel event]
        if event.type == config.EVENT_BLE_PAIRING_CANCELLED:
            print("UI: Cancel signal received, closing popup")
            self.ctx.change_state(MenuState(self.ctx))
            return

        if event.key in [pygame.K_RETURN, pygame.K_KP_ENTER]:
            self._respond(True)
        elif event.key == pygame.K_ESCAPE:
            self._respond(False)

    def _respond(self, result):
        if self.future and not self.future.done():
            try:
                # Must set result in the loop thread
                self.future.get_loop().call_soon_threadsafe(self.future.set_result, result)
            except Exception as e:
                print(f"UI Set Result Error: {e}")
        else:
            print("UI: Request expired or handled, ignoring keypress")

        self.ctx.change_state(MenuState(self.ctx))

    def draw(self):
        self.fill_screen()
        y = 0
        for line in self.lines:
            self.draw_text(line, 2, y, color=(255, 255, 255))
            y += config.LINE_HEIGHT


# Bluetooth Management Popup
class ConfirmRemoveState(State):
    def __init__(self, ctx, device_name, device_path, callback):
        super().__init__(ctx)
        self.device_name = device_name
        self.device_path = device_path
        self.callback = callback  # Callback function, called after deletion completion
        self.lang = self.ctx.language

        yes_str = self._t("confirm_usb") if self.ctx.hw.usb_bridge.reconnect() else self._t("confirm_gpio")
        no_str = self._t("reject_usb") if self.ctx.hw.usb_bridge.reconnect() else self._t("reject_gpio")

        self.msg = [self._t("remove_title"), self._t("device_row").format(self.device_name), yes_str, no_str]

    def _t(self, key):
        return BLE_STRINGS[self.lang].get(key, BLE_STRINGS["en"][key])

    def draw(self):
        self.fill_screen()
        y = 0
        for line in self.msg:
            self.draw_text(line, 2, y)
            y += config.LINE_HEIGHT

    def on_keydown(self, event):
        if event.key in [pygame.K_RETURN, pygame.K_KP_ENTER]:
            self.fill_screen()

            # Call Service to execute deletion
            self.draw_text(self._t("processing"), 5, 24, center=True)
            self.hw.render()

            # Assuming ctx has ble instance (usually injected into ctx in main.py)
            if hasattr(self.ctx, 'ble'):
                self.ctx.ble.remove_device_sync(self.device_path)

            self.callback()  # Return to list page

        elif event.key == pygame.K_ESCAPE:
            self.callback()


# --- Connection Management State ---
class ConnectionManagerState(State):
    def __init__(self, ctx):
        super().__init__(ctx)
        self.devices = []
        self.idx = 0
        self.visible_rows = 4
        self.loading = True
        self.lang = self.ctx.language

    def _t(self, key):
        return BLE_STRINGS[self.lang].get(key, BLE_STRINGS["en"][key])

    def on_enter(self):
        self._refresh_list()

    def on_event(self, event):
        # If bluetooth connect/disconnect signal received, refresh list immediately
        if event.type == config.EVENT_BLE_STATUS_CHANGE:
            print("UI: Bluetooth status change detected, refreshing list...")
            self._refresh_list()

    def _refresh_list(self):
        self.loading = True
        self.draw()  # Show loading
        self.hw.render()

        if hasattr(self.ctx, 'ble'):
            self.devices = self.ctx.ble.get_trusted_devices_sync()
        else:
            self.devices = []

        self.loading = False
        self.idx = 0

    def on_keydown(self, event):
        if self.loading:
            return
        if event.key == pygame.K_UP:
            self.idx = max(0, self.idx - 1)
        elif event.key == pygame.K_DOWN:
            self.idx = min(len(self.devices) - 1, self.idx + 1)
        elif event.key in [pygame.K_RETURN, pygame.K_KP_ENTER]:
            if self.devices:
                target = self.devices[self.idx]
                # Enter confirm remove page, pass callback to refresh this page after deletion
                self.ctx.change_state(ConfirmRemoveState(self.ctx, target['name'], target['path'],
                    callback=lambda: self.ctx.change_state(self)))
        elif event.key == pygame.K_ESCAPE:
            self.ctx.change_state(MenuState(self.ctx))

    def draw(self):
        self.fill_screen()

        if self.loading:
            self.draw_text(self._t("loading"), 0, 30, center=True)
            return

        if not self.devices:
            self.draw_rect(0, 0, 128, config.LINE_HEIGHT, color=(255, 255, 255))
            self.draw_text(self._t("manage_title"), 0, 0, color=(0, 0, 0), center=True)
            self.draw_text(self._t("no_devices"), 0, 24)
            self.draw_text(self._t("back_hint"), 0, 40)
            return

        self.draw_text(self._t("manage_title"), 0, 0, center=True)
        # List rendering logic, refer to MenuState
        start_y = config.LINE_HEIGHT
        start_idx = 0
        if self.idx >= self.visible_rows:
            start_idx = self.idx - (self.visible_rows - 1)

        for i in range(self.visible_rows):
            item_index = start_idx + i
            if item_index >= len(self.devices):
                break

            d = self.devices[item_index]
            is_connected = d.get('connected', False)
            status_prefix = "[Y] " if is_connected else "[N] "

            display_str = f"{status_prefix}{d['name']}"

            y = start_y + (i * config.LINE_HEIGHT)

            if item_index == self.idx:
                self.draw_rect(0, y, self.hw.width, config.LINE_HEIGHT, color=(255, 255, 255))
                self.draw_text(display_str, 2, y, color=(0, 0, 0))
            else:
                self.draw_text(display_str, 2, y, color=(255, 255, 255))