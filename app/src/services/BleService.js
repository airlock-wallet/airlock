/**
 * Copyright (C) 2026 Le Wang
 *
 * This file is part of Airlock.
 *
 * Airlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Airlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Airlock.  If not, see <https://www.gnu.org/licenses/>.
 */

import { ref } from 'vue'
import { Platform } from 'quasar'
import { useDeviceStore } from "stores/deviceStore.js";

// ==========================================
// Constants Definition
// ==========================================
const UUID_CONFIG = {
    ANDROID: {
        SERVICE: '0000beef-0000-1000-8000-00805f9b34fb',
        NOTIFY: '0000bef0-0000-1000-8000-00805f9b34fb',
        WRITE: '0000bef1-0000-1000-8000-00805f9b34fb'
    },
    IOS: {
        SERVICE: 'BEEF',
        NOTIFY: 'BEF0',
        WRITE: 'BEF1'
    }
}

const CONSTANTS = {
    CHUNK_SIZE: 180,
    EOF_MARKER: '###EOF###',
    BOND_TIMEOUT: 30000,
    CHECK_INTERVAL: 1500,
    REQ_TIMEOUT: 1500,
    MAX_TRY_COUNT: 3,
    STORAGE_KEY: 'ble_last_connected_device_id',
}

class Mutex {
    constructor() { this._queue = Promise.resolve() }
    lock(callback) {
        const next = this._queue.then(() => callback().catch(e => { throw e }))
        this._queue = next.then(() => {}, () => {})
        return next
    }
}

class BleService {
    static instance = null

    constructor() {
        if (BleService.instance) return BleService.instance

        // UI State
        this.device = ref(null)
        this.deviceId = ref(null)
        this.isConnectedState = ref(false)

        // Internal Variables
        this.rxBuffer = ''
        this.decoder = new TextDecoder('utf-8')
        this.writeMutex = new Mutex()
        this.pendingRequests = new Map()

        // UI Invocation Hook
        this.connectHandler = null

        // Handshake status flag, used to skip connection check in sendRequest
        this.isHandshaking = false

        BleService.instance = this
    }

    get config() {
        return Platform.is.ios ? UUID_CONFIG.IOS : UUID_CONFIG.ANDROID
    }

    get isConnected() {
        return this.isConnectedState.value
    }

    /**
     * Call this method in App.vue to inject dialog logic
     * @param handler
     */
    setConnectHandler(handler) {
        this.connectHandler = handler
    }

    /**
     * Check if Bluetooth is enabled
     * @returns {Promise<unknown>}
     */
    async checkEnabled() {
        if (typeof ble === 'undefined') return new Promise(() => true)
        return new Promise(r => ble.isEnabled(() => r(true), () => r(false)))
    }

    /**
     * Scan for devices
     * @param timeout
     * @returns {Promise<unknown>}
     */
    async scan(timeout = 5) {
        if (typeof ble === 'undefined') return this._mockScan()

        try {
            await ble.withPromises.stopScan()
        } catch (e) {
        }

        if (Platform.is.ios) {
            return this._scanIOS(timeout)
        } else {
            return this._scanAndroid(timeout)
        }
    }

    /**
     * Stop scanning
     * @returns {Promise<void>}
     */
    async stopScan() {
        if (typeof ble === 'undefined') {
            return;
        }
        try {
            // Use await to wait for result and catch possible exceptions
            await ble.withPromises.stopScan();
            console.log('Scan stopped');
        } catch (e) {
            console.debug('Non-fatal error while stopping scan (possibly not scanning currently):', e);
        }
    }

    /**
     * Start connection process
     * @param deviceId
     * @returns {Promise<any>}
     */
    async connect(deviceId) {
        console.log(`[BLE] Starting connection: ${deviceId}`)

        try { await ble.withPromises.stopScan() } catch (e) {}
        await new Promise(r => setTimeout(r, 600))
        try { await ble.withPromises.disconnect(deviceId) } catch (e) {}

        try {
            // ------------------------------------------
            // Physical Connection
            // ------------------------------------------
            await new Promise((resolve, reject) => {
                ble.connect(deviceId,
                    (p) => resolve(p),
                    (e) => {
                        if (this.isConnectedState.value) this._handlePassiveDisconnect()
                        else reject(new Error(e.errorMessage || "Connect Failed"))
                    }
                )
            })
            console.log('[BLE] Physical connection successful ')

            // ================== Set MTU ==================
            if (Platform.is.android) {
                try {
                    // Request 512 bytes (Android typically supports up to 512)
                    // This allows ~500 bytes per packet, reducing packet count from 750 to 30!
                    // Speed increased by 10-20 times
                    await ble.withPromises.requestMtu(deviceId, 512);
                    console.log('[BLE] MTU request successful: 512');
                } catch (e) {
                    console.warn('[BLE] MTU request failed, using default rate', e);
                }
            }

            // ------------------------------------------
            // Force Pairing and State Check (Android)
            // ------------------------------------------
            if (Platform.is.android) {
                console.log('[BLE] Entering pairing process (Force Bond)...')
                await this._checkBondStateLoopByAndroid(deviceId)
            } else {
                // iOS: Just a delay, waiting for system service discovery completion
                // iOS real pairing will be triggered at next step startNotification or sendRequest
                console.log('[BLE iOS] Waiting for service discovery...')
                await new Promise(r => setTimeout(r, 1000))
            }

            // ------------------------------------------
            // Inject Notify
            // ------------------------------------------
            console.log('[BLE] Injecting Notify...')
            await this._startNotification(deviceId)

            // Complete
            this.deviceId.value = deviceId
            this.device.value = {id: deviceId}
            this.isConnectedState.value = true

            // iOS Pairing
            await this._iosPair()

            // After successful connection, save DeviceID to DeviceStore
            const deviceStore = useDeviceStore();
            await deviceStore.setDevice({ deviceId: deviceId });

            console.log('[BLE] Business connection ready')
            return this.device.value

        } catch (err) {
            console.error('[BLE] Connection interrupted:', err.message)
            this._resetState()
            try {
                await ble.withPromises.disconnect(deviceId)
            } catch (e) {
            }
            throw err
        }
    }

    /**
     * IOS Pairing
     * @returns {Promise<void>}
     * @private
     */
    async _iosPair() {
        if (!Platform.is.ios) {
            return;
        }

        console.log('[BLE] Performing business handshake (IOS Ping)...')

        // Enable handshake mode, sendRequest will not check physical connection state
        this.isHandshaking = true

        try {
            // Backend must reply {"status": "success", "data": "pong"}, otherwise it will timeout here
            await this.sendRequest('ping', {}, CONSTANTS.BOND_TIMEOUT)
            console.log('[BLE] Handshake successful (Pairing confirmed)')
        } catch (e) {
            throw new Error(`Pairing refused or timed out`)
        } finally {
            // Must reset flag regardless of success or failure
            this.isHandshaking = false
        }
    }

    /**
     * Android Pairing
     * Actively call ble.bond when 'none' state is detected
     * @param deviceId
     * @returns {Promise<boolean>}
     * @private
     */
    async _checkBondStateLoopByAndroid(deviceId) {
        const startTime = Date.now()
        let hasTriggeredBond = false // Flag if pairing has been manually triggered

        while (Date.now() - startTime < CONSTANTS.BOND_TIMEOUT) {
            try {
                // 1. Fallback connection check
                const isConnected = await ble.withPromises.isConnected(deviceId).catch(() => false)
                if (!isConnected) throw new Error('Device disconnected')

                // 2. Read bond state
                const state = await ble.withPromises.readBondState(deviceId)
                console.log(`[BLE Bond] Current state: ${state}`)

                // --- State Branching ---
                if (state === 'bonded') {
                    return true // Success
                }

                if (state === 'bonding') {
                    // Pairing in progress, continue waiting
                    console.log('[BLE] Pairing in progress (Bonding)...')
                } else if (state === 'none' || state === 'unbonded') {
                    // Key logic: If not paired and not triggered yet, force trigger
                    if (!hasTriggeredBond) {
                        console.log('[BLE] State is none, actively calling ble.bond() to trigger popup!')
                        ble.bond(deviceId, () => console.log('Bond request sent successfully'), (e) => console.warn('Bond request failed', e))
                        hasTriggeredBond = true
                    } else {
                        console.log('[BLE] Waiting for user confirmation on popup...')
                    }
                }

            } catch (e) {
                console.warn('[BLE Bond] Check error:', e.message)
                if (e.message === 'Device disconnected') throw e
            }

            // Wait for next check
            await new Promise(r => setTimeout(r, CONSTANTS.CHECK_INTERVAL))
        }

        throw new Error('Pairing timed out (User did not confirm)')
    }

    /**
     * Inject Notify
     * @param deviceId
     * @returns {Promise<unknown>}
     * @private
     */
    async _startNotification(deviceId) {
        return new Promise((resolve, reject) => {
            ble.startNotification(deviceId, this.config.SERVICE, this.config.NOTIFY,
                (buffer) => this._onDataReceived(buffer),
                (err) => {
                    console.error('[BLE] Notify Error:', err)
                    reject(err)
                }
            )
            setTimeout(resolve, 500)
        })
    }

    /***
     * Send Data
     * @param method
     * @param params
     * @param timeout
     * @param retryAttempt Internal parameter to limit retry attempts
     * @returns {Promise<void>}
     */
    async sendRequest(method, params = {}, timeout = CONSTANTS.REQ_TIMEOUT, retryAttempt = 0) {
        // If not in handshake phase and no deviceId, means not connected
        if (!this.isHandshaking && !this.deviceId.value) {
            await this._invokeAutoConnect()
        }

        // If not in handshake phase, need connection check
        if (!this.isHandshaking) {
            try {
                await ble.withPromises.isConnected(this.deviceId.value)
            } catch (e) {
                // Physical connection lost, attempt auto-reconnect
                await this._invokeAutoConnect()
            }
        }

        const reqId = `req-${Date.now()}`
        const payload = JSON.stringify({id: reqId, method, params}) + CONSTANTS.EOF_MARKER
        return this.writeMutex.lock(async () => {
            const responsePromise = new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    if (this.pendingRequests.has(reqId)) {
                        this.pendingRequests.delete(reqId)
                        reject(new Error('Request timed out'))
                    }
                }, timeout)
                this.pendingRequests.set(reqId, {resolve, reject, timer})
            })

            // iOS write protection try/catch
            try {
                await this._writePayload(payload)
                return await responsePromise
            } catch (e) {
                // Clean up pending requests
                const req = this.pendingRequests.get(reqId)
                if (req) {
                    clearTimeout(req.timer)
                    this.pendingRequests.delete(reqId)
                }

                if (!this.isHandshaking) this._handlePassiveDisconnect()
                throw new Error(e)
            }
        }).catch(async (err) => {
            if (retryAttempt === -1) throw err;
            if (retryAttempt < CONSTANTS.MAX_TRY_COUNT) {
                console.log(`[BLE] Error occurred: ${err} Starting silent reconnect and retry...`);
                const deviceStore = useDeviceStore();
                const lastId = this.deviceId.value || deviceStore.deviceId;
                if (lastId) {
                    try {
                        await this.disconnect(); // Disconnect and reset state
                        await this.connect(lastId); // Silent reconnect (no Notify trigger)
                        // Retry sending (Recursive call, increment retryAttempt)
                        return await this.sendRequest(method, params, timeout, retryAttempt + 1);
                    } catch (reconnectErr) {
                        console.error('[BLE] Silent reconnect failed:', reconnectErr);
                        throw reconnectErr; // Reconnect failed, throw error
                    }
                } else {
                    throw new Error('No available Device ID, cannot reconnect');
                }
            } else {
                // Delete saved device
                const deviceStore = useDeviceStore();
                await deviceStore.resetDevice();
                throw err; // Not timeout or max retries reached, throw original error
            }
        });
    }

    /**
     * Write Payload Data
     * @param data
     * @returns {Promise<void>}
     * @private
     */
    async _writePayload(data) {
        if (typeof ble === 'undefined') return
        const buffer = new TextEncoder().encode(data).buffer
        let offset = 0
        while (offset < buffer.byteLength) {
            const chunk = buffer.slice(offset, offset + CONSTANTS.CHUNK_SIZE)
            await ble.withPromises.write(this.deviceId.value, this.config.SERVICE, this.config.WRITE, chunk)
            offset += CONSTANTS.CHUNK_SIZE
        }
    }

    /**
     * Disconnect
     * @returns {Promise<void>}
     */
    async disconnect() {
        const id = this.deviceId.value
        this._resetState()
        if (id) try {
            await ble.withPromises.disconnect(id)
        } catch (e) {
        }
    }

    /**
     * Data Received Callback
     * @param buffer
     * @private
     */
    _onDataReceived(buffer) {
        try {
            const chunk = this.decoder.decode(buffer, {stream: true})
            this.rxBuffer += chunk
            while (this.rxBuffer.includes(CONSTANTS.EOF_MARKER)) {
                const parts = this.rxBuffer.split(CONSTANTS.EOF_MARKER)
                this.rxBuffer = parts.slice(1).join(CONSTANTS.EOF_MARKER)
                this._dispatchMessage(parts[0])
            }
        } catch (e) {
            console.error('[BLE RX]', e)
        }
    }

    /**
     * Parse Complete Data
     * @param jsonStr
     * @private
     */
    _dispatchMessage(jsonStr) {
        try {
            const resp = JSON.parse(jsonStr)
            if (resp.id && this.pendingRequests.has(resp.id)) {
                const {resolve, timer} = this.pendingRequests.get(resp.id)
                clearTimeout(timer)
                this.pendingRequests.delete(resp.id)
                if (resp.status === 'success') {
                    resolve(resp.data)
                } else if (resp.status === 'error') {
                    resolve({error: resp.error})
                } else {
                    resolve(Promise.reject(new Error(resp.error || 'Unknown Error')))
                }
            }
        } catch (e) {
        }
    }

    /**
     * Bluetooth Passive Disconnect
     * @private
     */
    _handlePassiveDisconnect() {
        console.warn('[BLE] Passively disconnected')
        this._resetState()
    }

    /**
     * Reset Connection State
     * @private
     */
    _resetState() {
        this.isConnectedState.value = false
        this.deviceId.value = null
        this.rxBuffer = ''
        this.pendingRequests.forEach(p => {
            clearTimeout(p.timer);
            p.reject(new Error('Disconnected'))
        })
        this.pendingRequests.clear()
        // Reset handshake state
        this.isHandshaking = false
        console.log('[BLE] Connection has been reset')
    }

    /**
     * IOS Scan
     * @param timeout
     * @returns {Promise<unknown>}
     * @private
     */
    _scanIOS(timeout) {
        return new Promise((resolve, reject) => {
            const devicesMap = new Map()
            const onDiscover = (d) => {
                if (d.name && d.name.startsWith('AirLock-')) devicesMap.set(d.id, d)
            }

            console.log(`[BLE iOS] Scanning for Service: ${this.config.SERVICE}...`)

            ble.startScan([this.config.SERVICE], onDiscover, reject)

            setTimeout(() => {
                ble.stopScan(
                    () => resolve(Array.from(devicesMap.values())),
                    () => resolve(Array.from(devicesMap.values()))
                )
            }, timeout * 1000)
        })
    }

    /**
     * Android Scan
     * @param timeout
     * @returns {Promise<unknown>}
     * @private
     */
    _scanAndroid(timeout) {
        return new Promise((resolve, reject) => {
            const devicesMap = new Map()
            const onDiscover = (d) => {
                if (d.name && d.name.startsWith('AirLock-')) devicesMap.set(d.id, d)
            }

            console.log('[BLE Android] Starting Low Latency Scan...')

            // Check if advanced scan API is supported
            if (typeof ble.startScanWithOptions === 'function') {
                ble.startScanWithOptions(
                    [this.config.SERVICE],
                    {reportDuplicates: true, scanMode: 'lowLatency'},
                    onDiscover,
                    reject
                )
            } else {
                ble.startScan([this.config.SERVICE], onDiscover, reject)
            }

            setTimeout(() => {
                ble.stopScan(
                    () => resolve(Array.from(devicesMap.values())),
                    () => resolve(Array.from(devicesMap.values()))
                )
            }, timeout * 1000)
        })
    }

    /**
     * Mock Scan
     * @returns {Promise<unknown>}
     * @private
     */
    _mockScan() {
        return new Promise(r => setTimeout(() => r([{id: 'MOCK-01', name: 'Mock Wallet'}]), 1000))
    }

    /**
     * Invoke UI Popup and wait for connection result
     * @returns {Promise<void>}
     * @private
     */
    async _invokeAutoConnect() {
        if (!this.connectHandler) {
            this._resetState()
            throw new Error('Device not connected')
        }

        const deviceStore = useDeviceStore();
        if (!deviceStore.deviceId) {
            await deviceStore.loadStoredData();
        }
        const lastId = deviceStore.deviceId;

        if (lastId) {
            console.log(`[BLE] Connection needed, attempting auto-reconnect to last device: ${lastId}`)
            try {
                // Attempt silent connect (no popup)
                await this.connect(lastId)
                if (this.isConnectedState.value) {
                    console.log(`[BLE] Auto-reconnect successful`)
                    return // Reconnect successful, return directly
                }
            } catch (e) {
                console.warn('[BLE] Auto-reconnect failed, switching to manual scan:', e.message)
                // Clear ID on failure to avoid infinite loop next time
                await deviceStore.resetDevice();
            }
        } else {
            console.log('[BLE] Connection needed, attempting to invoke UI...')
        }

        try {
            // Call function registered in App.vue, this will pop up Dialog and wait for user action
            // Promise only resolves on successful connection
            await this.connectHandler()

            // Double check
            if (!this.isConnectedState.value) throw new Error('Reconnect incomplete')

        } catch (e) {
            // User cancelled or connection failed
            this._resetState()
            throw e // Continue throwing up, causing sendRequest to fail
        }
    }

}

export default new BleService()