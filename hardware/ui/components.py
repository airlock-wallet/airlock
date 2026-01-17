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
from .base_state import State
from core.utils import Utils

# ==========================================
# General Components
# ==========================================

class ScrollableTextState(State):
    """Pygame style text reader (using Surface movement)"""
    def __init__(self, ctx, lines: list[str], title: str = None, display_scroller: bool = False,
                 key_handlers: dict = None):
        super().__init__(ctx)
        self.title = title
        self.scroll_y = 0
        self.header_height = config.LINE_HEIGHT if self.title else 0
        self.display_scroller = display_scroller

        self.key_handlers = key_handlers or {}

        # 1. Pre-render: Draw all text on an extra-long Surface
        wrapped_lines = []
        for line in lines:
            temp_line = Utils.auto_wrap_pixel_perfect(line, self.hw.font, self.hw.width)
            wrapped_lines.extend(temp_line)

        total_h = max(len(wrapped_lines) * config.LINE_HEIGHT, 48)
        self.content_surf = pygame.Surface((128, total_h))
        self.content_surf.fill((0, 0, 0))

        for i, line in enumerate(wrapped_lines):
            txt = self.hw.font.render(line, False, (255, 255, 255))
            self.content_surf.blit(txt, (2, i * config.LINE_HEIGHT))

        self.max_scroll = max(0, total_h - (64 - self.header_height))

    def on_keydown(self, event):
        if event.key in self.key_handlers:
            self.key_handlers[event.key]()
            return

        if event.key == pygame.K_UP:
            self.scroll_y = max(0, self.scroll_y - config.LINE_HEIGHT)
        elif event.key == pygame.K_DOWN:
            self.scroll_y = min(self.max_scroll, self.scroll_y + config.LINE_HEIGHT)
        elif event.key in [pygame.K_RETURN, pygame.K_KP_ENTER, pygame.K_ESCAPE]:
            # [Resolve circular reference]
            from .states_menu import MenuState
            self.ctx.change_state(MenuState(self.ctx))

    def draw(self):
        self.fill_screen()
        y = 0
        if self.title:
            self.draw_rect(0, 0, 128, 16, color=(255, 255, 255))
            self.draw_text(self.title, 0, 0, color=(0, 0, 0), center=True)
            y = config.LINE_HEIGHT

        clip_rect = pygame.Rect(0, y, 128, 64 - y)
        self.hw.surface.set_clip(clip_rect)
        self.hw.surface.blit(self.content_surf, (0, y - self.scroll_y))
        self.hw.surface.set_clip(None)

        if self.display_scroller and self.max_scroll > 0:
            if self.scroll_y < self.max_scroll:
                self.draw_text("↓", 120, 50, center=False)
            if self.scroll_y > 0:
                self.draw_text("↑", 120, 18, center=False)


class InputState(State):
    def __init__(self, ctx, prompt, callback, is_pwd=False):
        super().__init__(ctx)
        self.prompt = prompt
        self.callback = callback
        self.is_pwd = is_pwd
        self.text = ""
        self.max_width = 128

    def on_keydown(self, event):
        if event.key in [pygame.K_RETURN, pygame.K_KP_ENTER]:
            next_state = self.callback(self.text)
            # [Security fix]
            self.text = ""
            if next_state is not None:
                self.ctx.change_state(next_state)
        elif event.key == pygame.K_BACKSPACE:
            self.text = self.text[:-1]
        elif event.key == pygame.K_ESCAPE:
            self.text = ""
            from .states_menu import MenuState
            self.ctx.change_state(MenuState(self.ctx))
        else:
            self.text += event.unicode

    def _wrap_text(self, text):
        lines, current_line = [], ""
        display_text = "*" * len(text) if self.is_pwd else text
        for char in display_text + "_":
            w, h = self.hw.font.size(current_line + char)
            if w < self.max_width:
                current_line += char
            else:
                lines.append(current_line)
                current_line = char
        if current_line: lines.append(current_line)
        return lines

    def draw(self):
        self.fill_screen()
        self.draw_text(self.prompt, 0, 2, color=(255, 255, 255), center=True)
        lines = self._wrap_text(self.text)
        visible = lines[-3:]
        for i, line in enumerate(visible):
            self.draw_text(line, 4, 20 + i * 14)