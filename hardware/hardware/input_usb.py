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
import threading
import glob
from evdev import InputDevice, categorize, ecodes

# ==========================================
# 1. Core Fix: USB Keyboard Bridge (Full symbol support)
# ==========================================
class USBKeyboardBridge:
    def __init__(self):
        if InputDevice is None:
            print("[USB] Error: evdev not installed")
            return

        self.device = None
        self.thread = None
        self.stop_event = threading.Event()  # Control thread stop

        # --- 1. Define character mapping table (US QWERTY layout) ---
        self.layout = {  # Number row
            pygame.K_BACKQUOTE: ('`', '~'), pygame.K_1: ('1', '!'), pygame.K_2: ('2', '@'), pygame.K_3: ('3', '#'),
            pygame.K_4: ('4', '$'), pygame.K_5: ('5', '%'), pygame.K_6: ('6', '^'), pygame.K_7: ('7', '&'),
            pygame.K_8: ('8', '*'), pygame.K_9: ('9', '('), pygame.K_0: ('0', ')'), pygame.K_MINUS: ('-', '_'),
            pygame.K_EQUALS: ('=', '+'),
            # Letter row symbols
            pygame.K_LEFTBRACKET: ('[', '{'), pygame.K_RIGHTBRACKET: (']', '}'), pygame.K_BACKSLASH: ('\\', '|'),
            pygame.K_SEMICOLON: (';', ':'), pygame.K_QUOTE: ("'", '"'), pygame.K_COMMA: (',', '<'),
            pygame.K_PERIOD: ('.', '>'), pygame.K_SLASH: ('/', '?'), pygame.K_SPACE: (' ', ' '),
            # Keypad
            pygame.K_KP_DIVIDE: ('/', '/'), pygame.K_KP_MULTIPLY: ('*', '*'), pygame.K_KP_MINUS: ('-', '-'),
            pygame.K_KP_PLUS: ('+', '+'), pygame.K_KP_PERIOD: ('.', '.'), pygame.K_KP0: ('0', '0'),
            pygame.K_KP1: ('1', '1'), pygame.K_KP2: ('2', '2'), pygame.K_KP3: ('3', '3'), pygame.K_KP4: ('4', '4'),
            pygame.K_KP5: ('5', '5'), pygame.K_KP6: ('6', '6'), pygame.K_KP7: ('7', '7'), pygame.K_KP8: ('8', '8'),
            pygame.K_KP9: ('9', '9'), }
        # Auto-generate letters
        for char in 'abcdefghijklmnopqrstuvwxyz':
            self.layout[getattr(pygame, f'K_{char}')] = (char, char.upper())

        # --- 2. evdev to Pygame mapping ---
        self.evdev_map = {  # Control keys
            ecodes.KEY_UP: pygame.K_UP, ecodes.KEY_DOWN: pygame.K_DOWN, ecodes.KEY_LEFT: pygame.K_LEFT,
            ecodes.KEY_RIGHT: pygame.K_RIGHT, ecodes.KEY_ENTER: pygame.K_RETURN, ecodes.KEY_KPENTER: pygame.K_KP_ENTER,
            ecodes.KEY_ESC: pygame.K_ESCAPE, ecodes.KEY_BACKSPACE: pygame.K_BACKSPACE, ecodes.KEY_TAB: pygame.K_TAB,
            ecodes.KEY_DELETE: pygame.K_DELETE,
            # Symbol keys
            ecodes.KEY_GRAVE: pygame.K_BACKQUOTE, ecodes.KEY_MINUS: pygame.K_MINUS, ecodes.KEY_EQUAL: pygame.K_EQUALS,
            ecodes.KEY_LEFTBRACE: pygame.K_LEFTBRACKET, ecodes.KEY_RIGHTBRACE: pygame.K_RIGHTBRACKET,
            ecodes.KEY_BACKSLASH: pygame.K_BACKSLASH, ecodes.KEY_SEMICOLON: pygame.K_SEMICOLON,
            ecodes.KEY_APOSTROPHE: pygame.K_QUOTE, ecodes.KEY_COMMA: pygame.K_COMMA, ecodes.KEY_DOT: pygame.K_PERIOD,
            ecodes.KEY_SLASH: pygame.K_SLASH, ecodes.KEY_SPACE: pygame.K_SPACE,
            # Keypad
            ecodes.KEY_KPSLASH: pygame.K_KP_DIVIDE, ecodes.KEY_KPASTERISK: pygame.K_KP_MULTIPLY,
            ecodes.KEY_KPMINUS: pygame.K_KP_MINUS, ecodes.KEY_KPPLUS: pygame.K_KP_PLUS,
            ecodes.KEY_KPDOT: pygame.K_KP_PERIOD,
            # Letters and numbers (Dynamically generated)
            **{getattr(ecodes, f'KEY_{c.upper()}'): getattr(pygame, f'K_{c}') for c in 'abcdefghijklmnopqrstuvwxyz'},
            **{getattr(ecodes, f'KEY_{d}'): getattr(pygame, f'K_{d}') for d in '0123456789'},
            **{getattr(ecodes, f'KEY_KP{d}'): getattr(pygame, f'K_KP{d}') for d in '0123456789'}}

        self.reconnect()

    def reconnect(self) -> bool:
        """Attempt to reconnect keyboard and start thread"""
        if self.device:
            return True  # Already connected

        self.device = self._find_keyboard()
        if self.device:
            print(f"[USB] Keyboard connected: {self.device.name}")
            # Start listener thread
            self.stop_event.clear()
            self.thread = threading.Thread(target=self._monitor, daemon=True)
            self.thread.start()
            return True
        else:
            print("[USB] Keyboard not detected")
            return False

    # Resource cleanup method
    def cleanup(self):
        self.stop_event.set()  # Stop thread loop
        if self.device:
            try:
                print("[USB] Releasing keyboard grab...")
                self.device.ungrab()  # Key: Release exclusive grab, otherwise console keyboard won't work
            except Exception as e:
                print(f"[USB] Release failed (possibly disconnected): {e}")

    def _find_keyboard(self):
        available = glob.glob('/dev/input/event*')
        for p in available:
            try:
                d = InputDevice(p)
                caps = d.capabilities()
                if ecodes.EV_KEY in caps:
                    if ecodes.KEY_A in caps[ecodes.EV_KEY]: return d
            except:
                continue
        return None

    def _monitor(self):
        shift_l, shift_r = False, False
        caps_lock = False

        try:
            self.device.grab()
            # read_loop is blocking, we need a way to exit safely (though this is a daemon thread)
            for event in self.device.read_loop():
                if self.stop_event.is_set(): break  # Allow external stop

                if event.type != ecodes.EV_KEY: continue
                data = categorize(event)
                is_press = (data.keystate == 1)

                if data.keycode == 'KEY_LEFTSHIFT': shift_l = (data.keystate != 0); continue
                if data.keycode == 'KEY_RIGHTSHIFT': shift_r = (data.keystate != 0); continue
                if data.keycode == 'KEY_CAPSLOCK' and data.keystate == 1: caps_lock = not caps_lock; continue

                if is_press:
                    if event.code in self.evdev_map:
                        py_key = self.evdev_map[event.code]
                        unicode_char = ""
                        is_shifted = shift_l or shift_r

                        # Letter handling (Shift XOR CapsLock)
                        if pygame.K_a <= py_key <= pygame.K_z:
                            is_letter_shift = is_shifted != caps_lock
                            unicode_char = self.layout[py_key][1] if is_letter_shift else self.layout[py_key][0]
                        # Other symbol handling
                        elif py_key in self.layout:
                            unicode_char = self.layout[py_key][1] if is_shifted else self.layout[py_key][0]

                        pygame.event.post(pygame.event.Event(pygame.KEYDOWN, key=py_key, unicode=unicode_char,
                                                             mod=(pygame.KMOD_SHIFT if is_shifted else 0)))
        except Exception as e:
            print(f"[USB] Monitor disconnected: {e}")
            self.device = None  # Mark as disconnected, allow reconnect
        finally:
            try:
                if self.device: self.device.ungrab()
            except:
                pass