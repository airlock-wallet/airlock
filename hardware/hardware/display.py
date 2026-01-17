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
import os
import config
from .input_gpio import GPIOBridge
from .input_usb import USBKeyboardBridge
from core.utils import Utils

# ==========================================
# 4. Hardware Layer Controller
# ==========================================
class Hardware:
    def __init__(self):
        pygame.init()
        self.width, self.height = 128, 64
        self.surface = pygame.Surface((self.width, self.height))
        self.gpio_bridge = GPIOBridge()
        self.usb_bridge = USBKeyboardBridge()

        try:
            self.font = pygame.font.Font(config.FONT_PATH, config.FONT_SIZE)
        except:
            print("Warning: Default font")
            self.font = pygame.font.Font(None, config.FONT_SIZE)

        self.oled = None
        try:
            from luma.core.interface.serial import i2c
            from luma.oled.device import ssd1306
            serial = i2c(port=3, address=0x3C)
            self.oled = ssd1306(serial, width=128, height=64)
        except Exception as e:
            print(f"OLED Error: {e}")

    def render(self):
        """Render Pygame Surface to OLED"""
        from PIL import Image
        raw_data = pygame.image.tostring(self.surface, "RGB")
        img = Image.frombytes("RGB", (128, 64), raw_data)
        self.oled.display(img.convert("1", dither=0))

    # Hardware resource cleanup method
    def cleanup(self):
        print("Cleaning up hardware resources...")

        # 1. Release USB keyboard
        if self.usb_bridge:
            self.usb_bridge.cleanup()

        # 2. GPIO cleanup (gpiozero usually handles this automatically, but explicit close is better)
        for btn in self.gpio_bridge.buttons:
            btn.close()

        # 3. OLED display off (clear memory)
        if self.oled:
            try:
                self.oled.clear()  # Clear screen
                self.oled.hide()  # Enter low power/sleep mode
            except Exception as e:
                print(f"OLED cleanup error: {e}")

        # 4. Quit Pygame
        pygame.quit()