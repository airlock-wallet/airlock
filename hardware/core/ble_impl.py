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

import asyncio
import pygame
import config
import time
from typing import Optional
from dbus_fast import DBusError, Message, MessageType
from dbus_fast.service import method
from dbus_fast.signature import Variant

from bluez_peripheral.agent import YesNoAgent
from bluez_peripheral.gatt.service import Service
from bluez_peripheral.gatt.characteristic import characteristic, CharacteristicFlags as CharFlags
from bluez_peripheral.gatt.descriptor import descriptor, DescriptorFlags as DescFlags


# ==========================================
# 1. Signal Listener (BluezSignalHandler)
# ==========================================
class BluezSignalHandler:
    def __init__(self, bus):
        self.bus = bus

    @staticmethod
    def extract_mac_from_path(device_path: str) -> str:
        if 'dev_' in device_path:
            return device_path.split('dev_')[-1].replace('_', ':')
        return device_path

    def process_dbus_message(self, msg: Message):
        if msg.message_type != MessageType.SIGNAL:
            return

        if msg.interface == 'org.freedesktop.DBus.Properties' and msg.member == 'PropertiesChanged':
            if len(msg.body) < 2: return
            interface_name = msg.body[0]
            changed_properties = msg.body[1]

            if interface_name == 'org.bluez.Device1' and 'Connected' in changed_properties:
                mac = self.extract_mac_from_path(msg.path)
                variant = changed_properties['Connected']
                is_connected = variant.value if hasattr(variant, 'value') else variant

                print(f"[BLE Signal] Device {mac} connection status: {is_connected}")
                pygame.event.post(
                    pygame.event.Event(config.EVENT_BLE_STATUS_CHANGE, {'mac': mac, 'connected': is_connected}))

    async def setup_bluez_monitoring(self):
        match_rule = "type='signal',interface='org.freedesktop.DBus.Properties',member='PropertiesChanged',sender='org.bluez'"
        await self.bus.call(
            Message(destination='org.freedesktop.DBus', path='/org/freedesktop/DBus', interface='org.freedesktop.DBus',
                member='AddMatch', message_type=MessageType.METHOD_CALL, signature='s', body=[match_rule]))


# ==========================================
# 2. Custom GATT Service (BleGattService)
# Add buffer limit to prevent memory overflow DoS attacks
# ==========================================
class BleGattService(Service):
    # Max allowed RX buffer 1MB, drop if exceeded
    MAX_BUFFER_SIZE = 1024 * 1024

    def __init__(self):
        super().__init__("0000beef-0000-1000-8000-00805f9b34fb", True)
        self._rx_buffer = bytearray()
        self._eof_marker = b"###EOF###"
        self._current_status = "AirLock Idle"

    @characteristic("0000bef0-0000-1000-8000-00805f9b34fb", CharFlags.READ | CharFlags.NOTIFY | CharFlags.ENCRYPT_READ)
    def status_characteristic(self, options):
        return bytes(self._current_status, "utf-8")

    @descriptor("0000bef2-0000-1000-8000-00805f9b34fb", status_characteristic, DescFlags.READ | DescFlags.ENCRYPT_READ)
    def status_descriptor(self, options):
        return bytes("Wallet Status & Data TX", "utf-8")

    @characteristic("0000bef1-0000-1000-8000-00805f9b34fb", CharFlags.WRITE | CharFlags.ENCRYPT_WRITE)
    def command_characteristic(self, options):
        pass

    @command_characteristic.setter
    def command_characteristic(self, value, options):
        try:
            # [DoS Protection] Check buffer size
            if len(self._rx_buffer) + len(value) > self.MAX_BUFFER_SIZE:
                print("[BLE Security] RX buffer overflow, data dropped!")
                self._rx_buffer = bytearray()
                return

            self._rx_buffer.extend(value)

            # Check for EOF marker
            if self._eof_marker in self._rx_buffer:
                split_index = self._rx_buffer.find(self._eof_marker)
                full_payload_bytes = self._rx_buffer[:split_index]

                # Clear buffer, prepare for next reception
                self._rx_buffer = bytearray()

                full_payload_str = full_payload_bytes.decode('utf-8')
                print(f"[BLE RX] Received full command: {len(full_payload_bytes)} bytes")

                pygame.event.post(pygame.event.Event(config.EVENT_BLE_DATA_RECEIVED, {'data': full_payload_str}))

        except Exception as e:
            print(f"[BLE RX] Data Error: {e}")
            self._rx_buffer = bytearray()

    async def send_data(self, json_str):
        try:
            full_payload = json_str.encode('utf-8') + self._eof_marker
            chunk_size = 180
            offset = 0

            print(f"[BLE TX] Start sending {full_payload}")

            while offset < len(full_payload):
                chunk = full_payload[offset: offset + chunk_size]

                # Assuming characteristic.changed is non-blocking (usually is)
                # If it is blocking, it needs to be wrapped with loop.run_in_executor, but usually not needed
                self.status_characteristic.changed(chunk)

                offset += chunk_size

                # This gives the loop a chance to handle BLE underlying signals instead of blocking
                await asyncio.sleep(0.05)

            print(f"[BLE TX] Data sent successfully: {len(full_payload)} bytes")

        except Exception as e:
            print(f"[BLE TX Error] {e}")
            import traceback
            traceback.print_exc()  # Print stack trace for debugging


# ==========================================
# 3. Secure Pairing Agent (BleAgent)
# [Fix] Inherit from YesNoAgent to fix ImportError
# ==========================================
class BleAgent(YesNoAgent):
    def __init__(self, bus):
        self._bus = bus
        self._pending_future = None

        # [Critical Fix] Define empty sync callbacks to meet YesNoAgent's __init__ requirements
        # We will override RequestConfirmation below, so these callbacks won't actually be used
        async def _dummy_confirm(passkey):
            return False  # Default reject to prevent accidents

        async def _dummy_cancel():
            pass

        # Initialize parent class
        super().__init__(_dummy_confirm, _dummy_cancel)

    async def _wait_for_user_confirmation(self, passkey: str) -> bool:
        """Suspend and wait for UI thread result"""
        loop = asyncio.get_running_loop()
        self._pending_future = loop.create_future()

        print(f"[BLE Agent] Intercepted pairing request (Passkey: {passkey}), waiting for user confirmation...")

        # Send event to notify UI popup
        event = pygame.event.Event(config.EVENT_BLE_PAIRING_REQUEST,
                                   {'passkey': passkey, 'future': self._pending_future})
        pygame.event.post(event)

        try:
            # Wait for UI to set future result (Timeout 60s)
            result = await asyncio.wait_for(self._pending_future, timeout=60.0)
            return result
        except asyncio.TimeoutError:
            print("[BLE Agent] User confirmation timed out.")
            pygame.event.post(pygame.event.Event(config.EVENT_BLE_PAIRING_CANCELLED))
            return False
        except Exception as e:
            print(f"[BLE Agent] Error waiting: {e}")
            return False
        finally:
            self._pending_future = None

    async def _set_trusted(self, device_path: str):
        try:
            msg = Message(destination='org.bluez', path=device_path, interface='org.freedesktop.DBus.Properties',
                          member='Set', message_type=MessageType.METHOD_CALL, signature='ssv',
                          body=['org.bluez.Device1', 'Trusted', Variant('b', True)])
            await self._bus.call(msg)
            print(f"[BLE Agent] Device {device_path} set to trusted.")
        except Exception as e:
            print(f"[BLE Agent] Failed to set trusted: {e}")

    # Handle pairing confirmation
    @method()
    async def RequestConfirmation(self, device: "o", passkey: "u"):
        # Wait for UI result
        confirmed = await self._wait_for_user_confirmation(passkey)

        if not confirmed:
            print("[BLE Agent] User rejected pairing.")
            raise DBusError("org.bluez.Error.Rejected", "User rejected pairing")

        print("[BLE Agent] User allowed pairing, authorizing...")
        await self._set_trusted(device)

    # Handle Just Works pairing
    @method()
    async def RequestAuthorization(self, device: "o"):
        print("[BLE Agent] Received authorization request (Just Works)")
        # Force popup even without passkey
        confirmed = await self._wait_for_user_confirmation(0)

        if not confirmed:
            raise DBusError("org.bluez.Error.Rejected", "User rejected authorization")

        await self._set_trusted(device)

    @method()
    async def Cancel(self):
        print("[BLE Agent] Pairing cancelled by system")
        if self._pending_future and not self._pending_future.done():
            self._pending_future.cancel()
        pygame.event.post(pygame.event.Event(config.EVENT_BLE_PAIRING_CANCELLED))


# ==========================================
# 4. Device Manager (DeviceManager)
# ==========================================
class DeviceManager:
    def __init__(self, bus):
        self.bus = bus

    def _unwrap(self, val):
        if hasattr(val, 'value'): return self._unwrap(val.value)
        return val

    async def get_trusted_devices(self):
        devices = []
        try:
            msg = Message(destination='org.bluez', path='/', interface='org.freedesktop.DBus.ObjectManager',
                          member='GetManagedObjects')
            reply = await self.bus.call(msg)
            if not reply or not reply.body: return []

            managed_objects = reply.body[0]
            for path, interfaces in managed_objects.items():
                if 'org.bluez.Device1' in interfaces:
                    props = interfaces['org.bluez.Device1']
                    if self._unwrap(props.get('Trusted', False)):
                        devices.append({'path': path, 'name': self._unwrap(props.get('Name', 'Unknown')),
                            'mac': self._unwrap(props.get('Address', '??:??:??')), 'connected': self._unwrap(props.get('Connected', False))})
        except Exception as e:
            print(f"[DeviceManager] Get devices error: {e}")
        return devices

    async def remove_device(self, device_path):
        print(f"[DeviceManager] Removing device: {device_path}")
        try:
            adapter_path = "/org/bluez/hci0"
            # Key: Call Adapter's RemoveDevice, this will clear the Link Key
            msg = Message(destination='org.bluez', path=adapter_path, interface='org.bluez.Adapter1',
                          member='RemoveDevice', signature='o', body=[device_path])

            reply = await self.bus.call(msg)
            if reply.message_type == MessageType.ERROR:
                print(f"[DeviceManager] Remove failed: {reply.error_name}")
                return False

            return True
        except Exception as e:
            print(f"[DeviceManager] Remove exception: {e}")
            return False