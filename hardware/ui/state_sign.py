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
import config
import threading
import time
from .base_state import State
from .states_menu import MenuState
from .components import ScrollableTextState
from core.models import Asset, TxData
from core.utils import Utils

# --- Localized Strings for Transaction Signing ---
SIGN_STRINGS = {
    "en": {
        "title": "Review Transaction",
        "asset_row": "Asset: {} ({})",
        "amount_row": "Amount: {}",
        "to_label": "To Address:",
        "confirm_usb": "[Enter] Confirm",
        "reject_usb": "[Esc] Reject",
        "confirm_gpio": "[#] Confirm",
        "reject_gpio": "[*] Reject",
        "data_error": "Tx Data Error!",
        "error_prefix": "Error: {}...",
        "any_key": "[Any Key] Return",
        "signing_overlay": "Signing...",
        "timeout_msg": "Transaction Timed Out",
        "success_title": "Sign Success!",
        "success_msg": "Broadcast via App",
        "fail_title": "Sign Failed!",
        "unknown_error": "Unknown Error",
        "rejected_msg": "Transaction Rejected"
    },
    "zh": {
        "title": "交易核对",
        "asset_row": "资产: {} ({})",
        "amount_row": "金额: {}",
        "to_label": "接收钱包:",
        "confirm_usb": "[Enter] 确认",
        "reject_usb": "[Esc] 拒绝",
        "confirm_gpio": "[#] 确认",
        "reject_gpio": "[*] 拒绝",
        "data_error": "交易数据显示异常!",
        "error_prefix": "错误: {}...",
        "any_key": "[任意键] 返回主菜单",
        "signing_overlay": "正在签名中...",
        "timeout_msg": "交易确认超时",
        "success_title": "签名成功！",
        "success_msg": "即将由前端广播交易",
        "fail_title": "签名失败！",
        "unknown_error": "未知错误",
        "rejected_msg": "已拒绝交易"
    }
}

class TransactionSignState(ScrollableTextState):
    """
    Transaction signing confirmation popup (with async processing and timeout control)
    """
    def __init__(self, ctx, asset: Asset, tx: TxData, mode: str, password: str, on_success, on_error):
        self.ctx = ctx
        self.asset = asset
        self.tx = tx
        self.mode = mode
        self.password = password
        self.on_success = on_success
        self.on_error = on_error
        self.lang = Utils.get_system_language()

        # --- Control State ---
        self.start_tick = pygame.time.get_ticks()  # Record entry time
        self.timeout_ms = 60000  # 60s timeout
        self.is_signing = False  # Is signing in background

        lines = []
        key_handlers = {}

        try:
            decimals = self.asset.decimals
            raw_amount = self.tx.amount
            readable_amount = self._format_amount(raw_amount, decimals)

            symbol = self.asset.symbol
            chain = self.asset.coin
            to_address = self.tx.toAddress

            if self.ctx.hw.usb_bridge.reconnect():
                yes = self._t("confirm_usb")
                no = self._t("reject_usb")
            else:
                yes = self._t("confirm_gpio")
                no = self._t("reject_gpio")

            # --- Build UI ---
            lines = [
                self._t("asset_row").format(symbol, chain),
                self._t("amount_row").format(readable_amount),
                self._t("to_label"),
                to_address,
                yes,
                no
            ]

            # Normal interaction: Confirm key calls _start_signing_thread
            key_handlers = {
                pygame.K_RETURN: self._start_signing_thread,
                pygame.K_KP_ENTER: self._start_signing_thread,
                pygame.K_ESCAPE: self._reject_tx
            }

        except Exception as e:
            print(f"[UI] Format Error: {e}")
            self.on_error(f"Device UI Error: {str(e)}")
            lines = [self._t("data_error"), self._t("error_prefix").format(str(e)[:20]), self._t("any_key")]

            def error_exit_handler():
                self.ctx.change_state(MenuState(self.ctx))

            key_handlers = {
                pygame.K_RETURN: error_exit_handler,
                pygame.K_KP_ENTER: error_exit_handler,
                pygame.K_ESCAPE: error_exit_handler
            }

        # Initialize parent class
        super().__init__(ctx, lines, title=self._t("title"), display_scroller=False, key_handlers=key_handlers)

    def _t(self, key):
        return SIGN_STRINGS[self.lang].get(key, SIGN_STRINGS["en"][key])

    def draw(self):
        """Called every frame: Handle drawing + timeout check"""
        # 1. If signing, show overlay, stop drawing scrollable text
        if self.is_signing:
            self.fill_screen()
            self.draw_text(self._t("signing_overlay"), 0, 20, center=True)
            return

        # 2. Check timeout (only before operation)
        if pygame.time.get_ticks() - self.start_tick > self.timeout_ms:
            print("[UI] Transaction confirmation timed out")
            self.on_error(self._t("timeout_msg"))
            self.ctx.change_state(MenuState(self.ctx))
            return

        # 3. Normal draw (Call parent ScrollableTextState draw)
        super().draw()

    def _start_signing_thread(self):
        """Start background thread, don't block UI"""
        if self.is_signing:
            return
        self.is_signing = True

        # Start daemon thread
        t = threading.Thread(target=self._signing_worker, daemon=True)
        t.start()

    def _signing_worker(self):
        """Background thread performs time-consuming operations"""
        try:
            # Execute original signing logic (time-consuming)
            result = self.ctx.svc.sign_transaction(self.asset, self.tx, self.mode, self.password)
            # Post completion event to main thread
            pygame.event.post(pygame.event.Event(config.EVENT_SIGN_WORKER_DONE, {
                "result": result
            }))
        except Exception as e:
            # Catch all exceptions
            err = {
                "status": "error",
                "error": str(e)
            }
            pygame.event.post(pygame.event.Event(config.EVENT_SIGN_WORKER_DONE, {
                "result": err
            }))

    def on_event(self, event):
        """Handle events received in main thread"""
        if event.type == config.EVENT_SIGN_WORKER_DONE:
            result = event.dict['result']

            if result.get('status') == 'success':
                self.on_success(result['encoded'])
                # UI Feedback (Sleep allowed here as done)
                self.fill_screen()
                self.draw_text(self._t("success_title"), 0, 8, center=True)
                self.draw_text(self._t("success_msg"), 0, 22, center=True)
                self.ctx.hw.render()
                time.sleep(3.0)
            else:
                self.on_error(result.get('error', 'Unknown Error'))
                # UI Feedback
                self.fill_screen()
                self.draw_text(self._t("fail_title"), 0, 8, center=True)
                error_msg = result.get('error', self._t("unknown_error"))
                self.draw_text(error_msg, 0, 22, center=True)
                self.ctx.hw.render()
                time.sleep(3.0)

            self.ctx.change_state(MenuState(self.ctx))

    def _reject_tx(self):
        self.on_error(self._t("rejected_msg"))
        self.ctx.change_state(MenuState(self.ctx))

    def _format_amount(self, raw_str: str, decimals: int) -> str:
        if decimals <= 0:
            return raw_str
        raw_str = raw_str.zfill(decimals + 1)
        return f"{raw_str[:-decimals]}.{raw_str[-decimals:].rstrip('0')}"