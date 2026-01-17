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

import locale

class Utils:

    @staticmethod
    def get_cpu_temp():
        """Obtain CPU temperature"""
        try:
            with open("/sys/class/thermal/thermal_zone0/temp") as f:
                return f"{float(f.read()) / 1000:.1f}C"
        except:
            return "N/A"


    @staticmethod
    def get_system_language():
        try:
            # Returns something like 'zh_CN' or 'en_US'
            lang, _ = locale.getdefaultlocale()
            if lang and lang.startswith('zh'):
                return 'zh'
        except Exception:
            pass
        return 'en'  # Default

    @staticmethod
    def auto_wrap_pixel_perfect(text, font, max_width):
        """
        Pixel-perfect word wrap for proportional fonts:
        1. Measures exact pixel width using font.size().
        2. If a word overflows, backtracks to the last space to keep the word intact.
        3. If no space exists (e.g., a long Bitcoin address), breaks at the last safe character.
        """
        lines = []
        curr_line = ""

        # Track the pixel position of the last space in the current line
        last_space_idx = -1

        i = 0
        while i < len(text):
            char = text[i]
            test_line = curr_line + char

            # Measure exact pixel width of the line including the new character
            width = font.size(test_line)[0]

            if char == ' ':
                # Record the string index where the last space occurred
                last_space_idx = len(curr_line)

            if width > max_width:
                # --- OVERFLOW DETECTED ---
                if last_space_idx == -1:
                    # Case A: No space found yet (a very long word or address)
                    # We must force a break at the current character to prevent overflow
                    lines.append(curr_line)
                    curr_line = ""
                    # Do not increment 'i' so the current char is handled in the next line
                else:
                    # Case B: Overflowed inside a word, but we have a space to backtrack to
                    # Cut the line at the last space
                    lines.append(curr_line[:last_space_idx])

                    # Move the rest of the word to the beginning of the next line
                    # We start 'curr_line' from the character after that space
                    remaining_word = curr_line[last_space_idx:].lstrip()
                    curr_line = remaining_word
                    last_space_idx = -1
                    # Note: We still have the current character 'char' to add
                    # But we must check if adding IT to the new line also overflows
                    if font.size(curr_line + char)[0] > max_width:
                        lines.append(curr_line)
                        curr_line = ""

            # Standard character addition
            curr_line += char
            i += 1

        if curr_line:
            lines.append(curr_line.strip())

        return lines