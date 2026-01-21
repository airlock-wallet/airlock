<p align="center">
<img src="./docs/public/images/airlock.jpg" alt="Airlock Wallet Cover" width="100%">
</p>

<h1 align="center">Airlock Wallet</h1>

<p align="center">
<a href="./README_CN.md">🇨🇳 Chinese (中文文档)</a>
</p>

<p align="center">
<strong>In an era where you can trust code, don't trust corporations.</strong>
</p>

<p align="center">
<a href="#why">Philosophy</a> •
<a href="#security">Tri-Dimensional Defense</a> •
<a href="#comparison">Comparison</a> •
<a href="#experience">Experience</a> •
<a href="#management">Management</a> •
<a href="#start">Build Now</a> •
<a href="#donations">Donate</a>
</p>

<p align="center">
<img src="https://img.shields.io/badge/License-AGPL%203.0-blue.svg" alt="License">
<img src="https://img.shields.io/badge/Hardware-Raspberry%20Pi-red.svg" alt="Hardware">
<img src="https://img.shields.io/badge/App-Android%20%7C%20iOS-green.svg" alt="App">
</p>

---

## Do you really own your private keys?

FTX misappropriated user funds. Ledger firmware exposed potential backdoor interfaces. Unknown hardware wallets risk chip implantation during shipping. In this decentralized dark forest, as long as you rely on "black box" hardware produced by third parties, your assets remain in a state of "Schrödinger's security."

Airlock is not a product. It is our **counterattack** against this uncertainty.

We invite you to use the **most generic, low-cost hardware** (Raspberry Pi) and the **most transparent open-source code** to mint a digital vault that belongs solely to you.

* **Cost under $20**: Cheaper than a decent dinner.
* **30 Minutes to Build**: No soldering required. As simple as building LEGOs.
* **Zero Trust Architecture**: From hardware procurement to system flashing, no middleman can be evil.

---

<h2 id="security">Why is Airlock immune even to physical attacks?</h2>

Traditional hardware wallets only defend against network attacks. Airlock constructs a **"Tri-Dimensional Defense System"**, solving trust issues across mathematical, physical, and psychological layers:

**1st Dimension: Supply Chain Defense (Anti-Insider)**

* **Mechanism**: **Mandatory BIP39 Passphrase (25th Word)**
* **Scenario**: Suppose the Raspberry Pi you bought was pre-implanted with a backdoor, or the firmware was tampered with by a hacker, leaking your **24-word seed phrase**.
* **Result**: The hacker gets the 24 words but opens only a default **empty wallet**.
* **Principle**: Your real assets are stored in a **Hidden Wallet** derived from "24 Words + Passphrase". This Passphrase exists only in your mind and is never stored in plaintext or transmitted over a network. Without it, the seed phrase is useless to a hacker.

**2nd Dimension: Physical Theft Defense (Anti-Thief)**

* **Mechanism**: **AES-256 Full Disk Encryption**
* **Scenario**: Suppose your device is lost or stolen, and the attacker attempts to extract data by reading the SD card directly.
* **Result**: They will see nothing but **gibberish**.
* **Principle**: Airlock uses your **Payment Password (PIN)** as the key to encrypt all sensitive data (including the hash of your seed phrase and Passphrase) with high-intensity **AES Encryption**. Without the password in your mind, even the world's top computing power cannot brute-force the private key files.

**3rd Dimension: Coercion Defense (Anti-Kidnapping)**

* **Mechanism**: **Dual PIN System (Decoy/Duress Mode)**
* **Scenario**: This is the moment no holder wants to face—being kidnapped or forced at knifepoint to unlock your phone App to show your assets.
* **Countermeasure**: Airlock App forces you to set **two completely different PIN codes** during initialization, corresponding to two parallel worlds:
* **Input PIN A (Decoy)**: The App enters the **Decoy Wallet (24 words only)**. It displays a small amount of "life-saving money" (e.g., $500) you pre-deposited. It functions perfectly for checking balances and transferring funds.
* **Input PIN B (Real)**: The App enters the **Real Vault (25 words)**. This is where your millions in core assets legally reside.


* **Result**: When coerced, you calmly input **PIN A**. The attacker sees a logically consistent wallet with a real balance and cannot detect the existence of another parallel space.
* **Truth**: Your real wealth is never loaded and does not exist in the current App interface.
* **Philosophy**: **Pocket change to save your life, the vault to fund your retirement.** Airlock grants you perfect "Plausible Deniability."

---

<h2 id="comparison">Why Choose Airlock? (The Hardcore Benchmark)</h2>

We pitted Airlock against mainstream DIY solutions and commercial hardware wallets in a brutal head-to-head comparison.

| Core Features | Airlock | SeedSigner | Ledger Nano X | Hot Wallets (Mobile/Ext) |
| --- | --- | --- | --- | --- |
| **Assets** | **All-Rounder (BTC + ETH + SOL)** | Bitcoin Only | All-Rounder | All-Rounder |
| **Input Exp** | **Physical Keyboard (Fast)** | Joystick (Painful) | Two Buttons (Tedious) | Touch/Mouse |
| **Connectivity** | **Bluetooth (Offline Sign)** | Camera Scan (Slow) | Bluetooth/USB | **Always Online (High Risk)** |
| **Anti-Coercion** | **Perfect (Dual PIN System)** | None | Limited | None |
| **Supply Chain** | **Mandatory Passphrase** | Optional | Cannot Verify HW | N/A |
| **Open Source** | **100% (Soft + Hard)** | 100% | Firmware Open / HW Closed | Software Open |
| **Cost** | **< $20** | ~ $50 | $149 | Free (Cost is your principal) |

> **Summary**: Airlock is currently the only multi-chain hardware wallet that combines **"DIY Transparency"**, **"Hot Wallet Bluetooth Convenience"**, and **"Physical Keyboard Efficiency"**.

---

<h2 id="experience">10,000x Safer than Hot Wallets, just one extra click.</h2>

Security often implies inconvenience—air-gapped wallets typically require scanning complex QR codes like a cashier. Airlock rejects this anti-human design.

We utilize Bluetooth Low Energy (BLE) as a **pure data transmission tunnel**, reshaping the cold wallet experience:

1. **Initiate on Phone**: Just as smooth as using MetaMask or TrustWallet.
2. **Auto Wake-up**: The Raspberry Pi screen lights up, displaying transaction details (Amount, Address).
3. **App Authorization**: Enter your Payment Password in the App to decrypt the core hardware data.
4. **Physical Confirmation**: Press the physical button on the keyboard.

**That's it.**

The moment you press the physical button is the singular moment of private key signing.
**Without your physical authorization, no trojan, hacker, or Bluetooth vulnerability can move a single cent from the device.**

The silkiness of a hot wallet, with the absolute defense of a cold wallet.

---

<h2 id="management">Command Center Asset Management</h2>

For power users managing multiple wallet addresses and diverse assets, Airlock offers professional-grade management capabilities.

* **Infinite Derivation, One-Screen Control**: No more switching back and forth between different wallets. Airlock's interface is designed for multi-account management, allowing you to view balances of all derived wallets in a single list.
* **Millisecond Search & Filter**: Even with 100 addresses, powerful search and filter functions allow you to instantly locate the account you need.
* **Full Asset Support**:
* **Major Chains**: Bitcoin, Ethereum, Solana, Tron, BSC, TON, Dogecoin, XRP, BCH, Avalanche, Polygon, Arbitrum, Sui, Litecoin, Dash, ETC...
* **Custom Tokens**: Perfect support for USDT, USDC, DAI, and any ERC20/TRC20/SPL tokens.



---

<h2 id="start">Take Action</h2>

Don't wait until you lose your assets to think about security. Start now and reclaim your digital sovereignty.

All detailed documentation, image downloads, and video tutorials can be found on our **[Official Website](https://www.airlock.pub)**.

## Quick Start

We provide a **minimalist** onboarding experience for everyone, while retaining the right to **build from scratch** for geeks. Follow these steps:

### Step 1: Build the Cold Wallet

Assemble the Raspberry Pi and flash the system to turn it into an offline signing device.

**[Read: Hardware Assembly & System Flashing Guide](https://www.google.com/search?q=./docs/en/hardware.md)**

* **Includes**: Bill of Materials (BOM), Assembly Steps, Image Flashing.
* **Difficulty**: Easy (No coding required, like building LEGOs).
* **Geek Mode**: View [Hardware Source](https://www.google.com/search?q=./hardware/) or build the system image yourself.

### Step 2: Install Mobile App

The mobile app acts as a "Watch-only Wallet," responsible for checking balances online and broadcasting transactions.

**[Read: App Installation & Usage Guide](https://www.google.com/search?q=./docs/en/app.md)**

* **Fast Track**: Download [APK Installer](https://github.com/airlock-wallet/airlock/releases/download/v1.0.0/airlock-v1.0.0.apk) directly (Suitable for most).
* **Geek Mode**: Compile from [Source Code](https://www.google.com/search?q=./app/) (Android/iOS) and verify every line.

### Step 3: (Optional) Self-Hosting

Airlock provides public nodes by default, ready out of the box. If you demand ultimate privacy and don't want to rely on our servers:

**[Read: Backend Service Deployment Guide](https://www.google.com/search?q=./docs/en/service.md)**

* **Includes**: Deploy private APIs from [Source](https://www.google.com/search?q=./services/) and configure multi-chain nodes.

---

<h2 id="donations">Donations</h2>

Airlock is a non-profit individual open-source project and a gift to the crypto world.

If you are moved by this **"Do It Yourself"** geek spirit, or if Airlock helps you sleep better at night, feel free to buy me a coffee. Your support will be used for server maintenance and new chain adaptation.

<div align="center">
<table>
<tr>
<td align="center" width="33%" valign="top">
<img src="./docs/public/donations/btc.png" width="100" alt="BTC">




<b>Bitcoin (BTC)</b>




<small><code>bc1qqarhdg398lakxz2pvmllnsdgyx9ssj6j0fvyfw</code></small>
</td>
<td align="center" width="33%" valign="top">
<img src="./docs/public/donations/eth.png" width="100" alt="ETH">




<b>Ethereum / EVM</b>




<small><code>0x78084a5d65c1f355512f0347495BB226B3A1ba74</code></small>
</td>
<td align="center" width="33%" valign="top">
<img src="./docs/public/donations/sol.png" width="100" alt="SOL">




<b>Solana (SOL)</b>




<small><code>9LKeCD3FpUrAvzEaGWXGGAyQE96K6K3B9s5krhmhNSBW</code></small>
</td>
</tr>
</table>
</div>

<details>
<summary><b>Click for more options (USDT, TRX, DOGE, etc.)</b></summary>





<ul>
<li><b>USDT (TRC20)</b>: <code>TQ5v2oTzvuRnGVGfehJMmimQxCmqDZF5P6</code></li>
<li><b>Tron (TRX)</b>: <code>TQ5v2oTzvuRnGVGfehJMmimQxCmqDZF5P6</code></li>
<li><b>Dogecoin (DOGE)</b>: <code>DD2MkyJNZ21TmEaeykLYwMUASxR7VDmWdu</code></li>
<li><b>Litecoin (LTC)</b>: <code>ltc1q3mrda7wqmxwerddjean35g4ng2ysh5a6ggx39d</code></li>
<li><b>XRP</b>: <code>r9Xv4mPW4WbpvhzhBF4q2LZbRixCmRC4a9</code></li>
<li><b>Bitcoin Cash (BCH)</b>: <code>bitcoincash:qqykek7athjd3l4n0enlzxd44nrllkk8jvuuzwuea2</code></li>
<li><b>TON (TON)</b>: <code>UQAUZvWz9Dnx5pf7Ukw40zzRczVtnpzr9CyuqTqzSi3ijN2Z</code></li>
<li><b>Sui (SUI)</b>: <code>0xe39490f7f918eee0f25d7a3068a44af86836e1558d17b18879511ca804952011</code></li>
<li><b>Dash (DASH)</b>: <code>XihpbtJc7sFyDJm6k8wvWzM5MPioW6RPM1</code></li>
</ul>
</details>

---

## Community & Support

* **Bug Reports**: [GitHub Issues](https://github.com/airlock-wallet/airlock/issues)
* **Business/Private Deployment**: `support@airlock.pub`
* **Official Website**: [www.airlock.pub](https://www.airlock.pub)

---

## Disclaimer

* **AS IS**: This software is provided "as is", without warranty of any kind, express or implied.
* **Use at Your Own Risk**: Users assume all risks associated with the use of this software. The developer is not liable for any financial loss caused by hardware failure, software bugs, loss of private keys, or force majeure.
* **Compliance**: Please ensure that your use of this software complies with local laws and regulations.

**Build it. Verify it. Trust it.**