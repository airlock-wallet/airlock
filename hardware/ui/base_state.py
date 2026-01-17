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

class State:
    def __init__(self, ctx):
        self.ctx = ctx
        self.hw = ctx.hw

    def on_enter(self):
        """Called when entering the state"""
        pass

    def on_exit(self):
        """Called when exiting the state"""
        pass

    def update(self):
        """Logic update for every frame (optional)"""
        pass

    def draw(self):
        """Draw screen"""
        pass

    def on_keydown(self, event):
        """
        Specifically handles key down events.
        Subclasses only need to override this method, no need to check event.type again.
        :param event: pygame.event (Type guaranteed to be KEYDOWN)
        """
        pass

    def on_event(self, event):
        """Handle non-key system events (e.g. Bluetooth status change)"""
        pass

    def draw_text(self, text, x, y, color=(255, 255, 255), center=False):
        surf = self.hw.font.render(str(text), False, color)
        if center:
            rect = surf.get_rect(center=(self.hw.width // 2, y + surf.get_height() // 2))
            self.hw.surface.blit(surf, rect)
        else:
            self.hw.surface.blit(surf, (x, y))

    def draw_rect(self, x, y, w, h, color=(255, 255, 255)):
        pygame.draw.rect(self.hw.surface, color, (x, y, w, h))

    def fill_screen(self, color=(0, 0, 0)):
        self.hw.surface.fill(color)