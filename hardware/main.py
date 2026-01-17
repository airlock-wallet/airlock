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

import warnings
# Ignore specific warning from pygame
warnings.filterwarnings("ignore", category=UserWarning, message=".*pkg_resources.*")

import os
# Set SDL driver (Required for Raspberry Pi headless mode)
os.environ["SDL_VIDEODRIVER"] = "dummy"

import pygame
import gc
import time
import subprocess
import config
from ui.context import AppContext
from ui.states_menu import MenuState
from ui.states_ble import PairingRequestState
from core import APIHandler

def main():
    # 1. Initialize context (Load hardware, database, business services)
    ctx = AppContext()

    # 2. Start Bluetooth background thread
    ctx.ble.start()

    # 3. Set initial state to menu
    ctx.change_state(MenuState(ctx))

    # 4. Create Bluetooth communication API object
    api = APIHandler(ctx)

    print("System Started...")

    try:
        # 3. Start main loop
        while ctx.running:
            # Handle events
            for event in pygame.event.get():
                # System events (Highest priority)
                if event.type == pygame.QUIT:
                    ctx.running = False
                    break  # Exit loop

                # Global business events (Bluetooth/System notifications)
                # These events usually interrupt current operation, force page switch, so prioritize
                elif event.type == config.EVENT_BLE_PAIRING_REQUEST:
                    print(f"UI: Global Intercept - Pairing Request")
                    ctx.change_state(PairingRequestState(ctx, event.dict['passkey'], event.dict['future']))

                elif event.type == config.EVENT_BLE_DATA_RECEIVED:
                    print(f"UI: Global Intercept - Data Received")
                    api.handle_packet(event.dict['data'])

                elif event.type == config.EVENT_BLE_STATUS_CHANGE:
                    # Status change usually only prints log or updates top bar, not necessarily switch page
                    status = "Connected" if event.dict['connected'] else "Disconnected"
                    print(f"UI: Bluetooth Status Update -> {status}")  # If UI icon needed, update global var in ctx here

                    # If current page is "Connection Manager", it can use this event to refresh list
                    if ctx.state:
                        ctx.state.on_event(event)

                elif event.type == config.EVENT_BLE_PAIRING_CANCELLED:
                    # Handle pairing cancellation (e.g. close popup)
                    # If current is pairing popup, return to main menu
                    if isinstance(ctx.state, PairingRequestState):
                        ctx.change_state(MenuState(ctx))

                # Receive worker thread completion signal -> Forward to current State (TransactionSignState)
                elif event.type == config.EVENT_SIGN_WORKER_DONE:
                    if ctx.state:
                        ctx.state.on_event(event)

                # User input events (Dispatch to current State)
                # Only explicit key events passed to State, completely isolating interference
                elif event.type == pygame.KEYDOWN:
                    if ctx.state:
                        ctx.state.on_keydown(event)

            # Draw current state
            if ctx.state:
                ctx.state.draw()

            # Render hardware screen
            ctx.hw.render()

            # Control frame rate
            ctx.clock.tick(30)

    except KeyboardInterrupt:
        # Allow Ctrl+C exit during development
        ctx.running = False

    finally:
        # ==========================================
        # [Graceful Exit] Resource cleanup and system command execution after loop exit
        # ==========================================

        # 1. Force garbage collection (Clean up sensitive objects in memory)
        gc.collect()

        # 2. Hardware resource cleanup (Screen off, release keyboard, close GPIO)
        # This is very important, otherwise keyboard exclusive access might fail next start
        ctx.hw.cleanup()

        # 3. Stop Bluetooth service
        ctx.ble.stop()

        print("Resources released, program exiting.")

        # 3. Execute system command (Shutdown/Reboot)
        if ctx.system_command:
            print(f"Executing system command: {ctx.system_command}")
            # Slight delay to ensure screen is completely black
            time.sleep(0.5)
            # Use subprocess to call system command
            try:
                subprocess.run(ctx.system_command, shell=True, timeout=15)
            except Exception as e:
                print(f"System command execution failed: {e}")


if __name__ == "__main__":
    main()