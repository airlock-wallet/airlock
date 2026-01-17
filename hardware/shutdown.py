#!/usr/bin/env python3
# -*- coding: utf-8 -*-

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
import RPi.GPIO as GPIO
from luma.core.interface.serial import i2c
from luma.oled.device import ssd1306

# ---------------- OLED Initialization ----------------
I2C_BUS = 3
OLED_ADDRESS = 0x3C
WIDTH = 128
HEIGHT = 64

try:
    serial = i2c(port=I2C_BUS, address=OLED_ADDRESS)
    device = ssd1306(serial, width=WIDTH, height=HEIGHT)

    # Clear screen
    device.clear()
    device.show()

    # Force display OFF
    try:
        device.command(0xAE)  # SSD1306 Display OFF
    except Exception:
        pass

    # Give OLED some time to shut down
    time.sleep(0.1)

    # Fully release resources
    try:
        device.cleanup()
    except Exception:
        pass

except Exception as e:
    print("OLED initialization or shutdown failed:", e)

# ---------------- GPIO Cleanup ----------------
try:
    GPIO.cleanup()
except Exception:
    pass

print("OLED closed, GPIO cleaned up")