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
# Assuming Utils is available
from core.utils import Utils
from .base_state import State
from .components import ScrollableTextState

# --- Localized Strings ---
UI_STRINGS = {
    "en": {
        "menu_items": [
            "Read Me", "Connections", "New Wallet", "Import Wallet",
            "System Info", "Official Site", "Shutdown", "Reboot"
        ],

        "usb_check_title": "Hardware Check",
        "usb_missing": ["USB Keyboard Missing", "", "Please insert keyboard", "", "[#] Retry", "[*] Menu"],
        "usb_retry": "Checking Keyboard...",
        "usb_fail": ["Keyboard Not Found", "", "Ensure plug is tight", "", "[#] Retry", "[*] Menu"],

        "readme_title": "Important Notice",
        "readme_content": [
            "For asset safety, please read carefully:",
            "1. Seed phrase is the ONLY key to your funds;",
            "2. Ensure no cameras/people are watching;",
            "3. AirLock is offline, NEVER connect to internet;",
            "4. Verify device authenticity before use;",
            "5. Double-check address/amount before signing;",
            "6. Keep device fire/waterproof;",
            "7. Lost device? Recover via seed on new wallet;",
            "8. Obey local laws, no illegal activities.",
            "Visit website for help. Stay Safe!"
        ],

        "info_title": "System Info",
        "info_name": "Name: ",
        "info_hw": "HW: Pi Zero 2",
        "info_screen": "Screen: SSD1306",
        "info_os": "OS: Linux",
        "info_ver": "Version: 1.0",

        "site_title": "Official Website",
        "site_hint": "Beware of phishing sites",

        "power_title": "Power Options",
        "shutdown_conf": "Shutdown System?",
        "reboot_conf": "Reboot System?",

        "confirm_usb": "[Enter] Confirm",
        "cancel_usb": "[Esc] Cancel",
        "back_usb": "[Esc] Back",
        "confirm_gpio": "[#] Confirm",
        "cancel_gpio": "[*] Cancel",
        "back_gpio": "[*] Back"
    },
    "zh": {
        "menu_items": [
            "使用必读", "连接管理", "新建钱包", "导入钱包",
            "系统信息", "官方网站", "安全关机", "重启系统"
        ],

        "usb_check_title": "硬件检查",
        "usb_missing": ["未检测到 USB 键盘", "", "请插入键盘后重试", "", "[#] 重新检测", "[*] 返回菜单"],
        "usb_retry": "正在检测键盘...",
        "usb_fail": ["仍未检测到键盘", "", "请确保插头插紧", "", "[#] 再次检测", "[*] 返回菜单"],

        "readme_title": "使用必读",
        "readme_content": [
            "为确保您的数字资产安全，请仔细阅读以下注意事项",
            "1.重要提示：助记词是恢复钱包的唯一钥匙，务必书写存储;",
            "2.环境安全：在操作助记词时，确保周围无监控设备、无人窥视;",
            "3.避免联网：AirLock 是离线设备，切勿连接互联网;",
            "4.验证设备：首次使用前，检查设备是否为官方正品;",
            "5.双重验证：签名交易前，仔细核对屏幕显示的地址、金额和费用;",
            "6.物理保护：将设备存放在防火、防水的安全位置;",
            "7.紧急恢复：如果设备丢失，可使用助记词在新钱包上恢复;",
            "8.法律合规：遵守当地法律法规，请勿使用钱包进行非法活动;",
            "如果您有疑问，请访问官方网站获取更多帮助。安全第一，祝使用愉快！"
        ],

        "info_title": "系统信息",
        "info_name": "名称: ",
        "info_hw": "硬件: Pi Zero 2",
        "info_screen": "屏幕: SSD1306",
        "info_os": "系统: Linux",
        "info_ver": "版本: 1.0",

        "site_title": "官方网站",
        "site_hint": "认准官网，谨防钓鱼",

        "power_title": "电源选项",
        "shutdown_conf": "是否需要安全关机?",
        "reboot_conf": "是否需要重启系统?",

        "confirm_usb": "[Enter] 确定",
        "cancel_usb": "[Esc] 取消",
        "back_usb": "[Esc] 返回",
        "confirm_gpio": "[#] 确定",
        "cancel_gpio": "[*] 取消",
        "back_gpio": "[*] 返回"
    }
}


# --- USB Keyboard Check Middleware ---
class CheckUSBState(State):
    def __init__(self, ctx, next_state_cb):
        super().__init__(ctx)
        self.next_state_cb = next_state_cb
        self.lang = Utils.get_system_language()
        self.msg = self._t("usb_missing")

    def _t(self, key):
        return UI_STRINGS[self.lang].get(key, UI_STRINGS["en"][key])

    def on_enter(self):
        if self.ctx.hw.usb_bridge.reconnect():
            self.ctx.change_state(self.next_state_cb())
        else:
            self._show_prompt()

    def _show_prompt(self):
        handlers = {
            pygame.K_RETURN: self._retry_detect,
            pygame.K_KP_ENTER: self._retry_detect,
            pygame.K_ESCAPE: lambda: self.ctx.change_state(MenuState(self.ctx))
        }
        self.ctx.change_state(ScrollableTextState(self.ctx, self.msg, title=self._t("usb_check_title"), key_handlers=handlers))

    def _retry_detect(self):
        self.fill_screen()
        self.draw_text(self._t("usb_retry"), 0, 25, center=True)
        self.hw.render()
        pygame.time.delay(200)

        if self.ctx.hw.usb_bridge.reconnect():
            self.ctx.change_state(self.next_state_cb())
        else:
            self.msg = self._t("usb_fail")
            self._show_prompt()


# --- Main Menu ---
class MenuState(State):
    def __init__(self, ctx):
        super().__init__(ctx)
        self.lang = Utils.get_system_language()
        self.items = self._t("menu_items")
        self.idx = 0
        self.visible_rows = 4

    def _t(self, key):
        return UI_STRINGS[self.lang].get(key, UI_STRINGS["en"][key])

    def on_keydown(self, event):
        if event.key == pygame.K_UP:
            self.idx = (self.idx - 1) % len(self.items)
        elif event.key == pygame.K_DOWN:
            self.idx = (self.idx + 1) % len(self.items)
        elif event.key in [pygame.K_RETURN, pygame.K_KP_ENTER]:
            self.select()

    def select(self):
        # [Local Import] Avoid Circular Dependency: Menu -> Wallet -> Menu
        from .states_wallet import CreateWalletState, ImportWalletState
        from ui.states_ble import ConnectionManagerState

        has_kb = self.ctx.hw.usb_bridge.reconnect()
        back_str = self._t("back_usb") if has_kb else self._t("back_gpio")
        confirm_str = self._t("confirm_usb") if has_kb else self._t("confirm_gpio")
        cancel_str = self._t("cancel_usb") if has_kb else self._t("cancel_gpio")

        if self.idx == 0:  # Read Me
            content = self._t("readme_content") + [back_str]
            self.ctx.change_state(ScrollableTextState(self.ctx, content, title=self._t("readme_title")))

        elif self.idx == 1:  # Bluetooth
            self.ctx.change_state(ConnectionManagerState(self.ctx))

        elif self.idx == 2:  # Create Wallet
            self.ctx.change_state(CheckUSBState(self.ctx, next_state_cb=lambda: CreateWalletState(self.ctx)))

        elif self.idx == 3:  # Import Wallet
            self.ctx.change_state(CheckUSBState(self.ctx, next_state_cb=lambda: ImportWalletState(self.ctx)))

        elif self.idx == 4:  # System Info
            from core import Utils
            temp = Utils.get_cpu_temp()
            info_lines = [
                f"{self._t('info_name')}{config.BLE_DEVICE_NAME}",
                self._t("info_hw"),
                self._t("info_screen"),
                self._t("info_os"),
                f"CPU: {temp}",
                self._t("info_ver"),
                back_str
            ]
            self.ctx.change_state(ScrollableTextState(self.ctx, info_lines, title=self._t("info_title")))

        elif self.idx == 5:  # Official Site
            site_url = config.WEBSITE
            lines = ["AirLock Wallet", site_url, self._t("site_hint"), back_str]
            self.ctx.change_state(ScrollableTextState(self.ctx, lines, title=self._t("site_title")))

        elif self.idx == 6:  # Shutdown
            handlers = {
                pygame.K_RETURN: self._shutdown,
                pygame.K_KP_ENTER: self._shutdown,
                pygame.K_ESCAPE: lambda: self.ctx.change_state(MenuState(self.ctx))
            }
            lines = [self._t("shutdown_conf"), confirm_str, cancel_str]
            self.ctx.change_state(ScrollableTextState(self.ctx, lines, title=self._t("power_title"), key_handlers=handlers))

        elif self.idx == 7:  # Reboot
            handlers = {
                pygame.K_RETURN: self._reboot,
                pygame.K_KP_ENTER: self._reboot,
                pygame.K_ESCAPE: lambda: self.ctx.change_state(MenuState(self.ctx))
            }
            lines = [self._t("reboot_conf"), confirm_str, cancel_str]
            self.ctx.change_state(ScrollableTextState(self.ctx, lines, title=self._t("power_title"), key_handlers=handlers))

    def draw(self):
        self.fill_screen()
        start_idx = 0
        if self.idx >= self.visible_rows:
            start_idx = self.idx - (self.visible_rows - 1)

        for i in range(self.visible_rows):
            item_index = start_idx + i
            if item_index >= len(self.items):
                break
            y = i * config.LINE_HEIGHT
            item_text = self.items[item_index]

            if item_index == self.idx:
                self.draw_rect(0, y, self.hw.width, config.LINE_HEIGHT, color=(255, 255, 255))
                self.draw_text(item_text, 2, y, color=(0, 0, 0))
            else:
                self.draw_text(item_text, 2, y, color=(255, 255, 255))

    def _shutdown(self):
        self.ctx.running = False
        self.ctx.system_command = 'sudo shutdown -h now'

    def _reboot(self):
        self.ctx.running = False
        self.ctx.system_command = 'sudo reboot'