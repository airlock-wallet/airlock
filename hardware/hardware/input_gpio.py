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
from gpiozero import Button

# ==========================================
# GPIO Bridge
# ==========================================
class GPIOBridge:
    def __init__(self):
        self.buttons = []
        # Pin mapping: 21=UP, 20=DOWN, 16=ENTER, 3=ESC
        mappings = [(21, pygame.K_UP), (20, pygame.K_DOWN), (16, pygame.K_RETURN), (3, pygame.K_ESCAPE)]
        print("[GPIO] Initializing buttons...")
        for pin, key_code in mappings:
            try:
                btn = Button(pin, pull_up=True, bounce_time=0.1)
                btn.when_pressed = lambda k=key_code: self._post_key_event(k)
                self.buttons.append(btn)
            except Exception as e:
                print(f"GPIO {pin} Init Error: {e}")

    def _post_key_event(self, key_code):
        event = pygame.event.Event(pygame.KEYDOWN, key=key_code, unicode="", mod=0)
        pygame.event.post(event)