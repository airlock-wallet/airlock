<div class="text-caption text-grey-7 q-mb-lg">
    Effective Date: December 08, 2025
</div>

<div class="bg-teal-1 text-teal-9 q-pa-md rounded-borders q-mb-lg" style="border-left: 5px solid #009688;">
    <div class="text-subtitle2 text-weight-bold q-mb-xs">
        <i class="material-icons" style="font-size: 1.2em; vertical-align: text-bottom;">shield</i> 
        Core Commitment
    </div>
    We adhere to the principle that <b>"Private Keys Never Touch the Network."</b> Although the device communicates via Bluetooth, your Private Key remains permanently stored in the Raspberry Pi's secure chip/storage area and will never be sent to the phone or uploaded to the cloud via Bluetooth.
</div>

<div class="text-h6 text-weight-bold text-grey-9 q-mt-md q-mb-sm">1. Data Processing Mechanism</div>

Airlock adopts an **"Offline Signing, Online Broadcasting"** operational mode:

- **Cold Wallet Side (Raspberry Pi)**:
    - <span class="text-weight-bold text-primary">Pure Offline Operation</span>: The device does not connect to Wi-Fi; it only enables Bluetooth Low Energy (BLE) acting as a peripheral.
    - <span class="text-weight-bold text-primary">Data Boundary</span>: The Bluetooth channel is used solely for receiving "unsigned data" and sending "signed data."
    - **Private Key Never Leaves Device**: The signing process is completed entirely inside the Raspberry Pi.

- **Watch-only Side (Mobile App)**:
    - **Gateway Role**: The App acts as a gateway between the blockchain network and the cold wallet.
    - **Transparent Transmission**: The App transmits pending transactions from the blockchain to the cold wallet via Bluetooth and broadcasts them back to the blockchain upon receiving the signature.

---

<div class="text-h6 text-weight-bold text-grey-9 q-mt-md q-mb-sm">2. Key Permissions Explained</div>

To establish a secure Bluetooth channel, the App requires the following system permissions:

1.  **<div class="q-mt-md">Bluetooth & Nearby Devices</div>**
    - <i class="material-icons text-grey-6" style="font-size: 1em; vertical-align: middle;">bluetooth</i> **Purpose**: To scan for and connect to your Airlock Raspberry Pi device.
    - **Privacy**: We only connect to devices matching the Airlock protocol name; we do not scan or record information about other Bluetooth devices.

2.  **<div class="q-mt-md">Camera & Storage</div>**
    - <i class="material-icons text-grey-6" style="font-size: 1em; vertical-align: middle;">qr_code_scanner</i> **Purpose**: To scan recipient address QR codes to initiate transactions, or to select QR code images from the local album for recognition.
    - **Privacy**: QR code parsing is performed entirely locally on the device. We **do not** save or upload any of your photos or video feeds.
    
3.  **<div class="q-mt-md">Location</div>**
    - <i class="material-icons text-grey-6" style="font-size: 1em; vertical-align: middle;">location_on</i> **Purpose**: On Android 11 and lower, the system requires Location permission to be enabled for Bluetooth scanning.
    - **Declaration**: We **do not** record or upload your GPS geographical location tracks.

4.  **<div class="q-mt-md">Internet</div>**
    - <i class="material-icons text-grey-6" style="font-size: 1em; vertical-align: middle;">public</i> **Purpose**: Used solely for syncing on-chain balances and broadcasting transactions.

---

<div class="text-h6 text-weight-bold text-grey-9 q-mt-md q-mb-sm">3. Security Statement</div>

Although a wireless connection is used, we have implemented multiple protective measures:

* **End-to-End Encryption**: Bluetooth transmission between the phone and Raspberry Pi is AES-encrypted to prevent eavesdropping by surrounding devices.
* **Manual Confirmation Mechanism**: Every transaction must undergo **physical manual confirmation** (pressing a physical button) on the Raspberry Pi screen before being signed and sent back to the phone via Bluetooth.
* **No Background Services**: Upon exiting the App, the Bluetooth connection disconnects immediately; there is no silent communication in the background.

---

<div class="bg-grey-2 q-pa-md rounded-borders q-mt-lg text-grey-8">
    <div class="text-subtitle2 text-weight-bold">
        <i class="material-icons" style="font-size: 1.2em; vertical-align: text-bottom;">contact_support</i> 
        Contact & Feedback
    </div>
    <div class="q-mt-sm" style="font-size: 0.9em;">
        If you encounter Bluetooth connection failures or have security concerns, please visit Github Issues to submit a log (please ensure the log does not contain sensitive private key information).
    </div>
</div>