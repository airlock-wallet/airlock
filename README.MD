<p align="center">
  <img src="https://www.airlock.pub/images/airlock.jpg" alt="Airlock Wallet Cover" width="100%">
</p>

<h1 align="center">Airlock Wallet</h1>

<p align="center">
  <a href="./README_CN.MD">🇨🇳 中文文档 (Chinese)</a>
</p>

<p align="center">
  <strong>In an era where you should trust code, never trust corporations.</strong>
</p>

<p align="center">
  <a href="#why">Philosophy</a> •
  <a href="#security">Ultimate Security</a> •
  <a href="#experience">The Experience</a> •
  <a href="#management">God Mode</a> •
  <a href="#start">Start Building</a> •
  <a href="#donations">Donations</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-AGPL%203.0-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/Hardware-Raspberry%20Pi-red.svg" alt="Hardware">
  <img src="https://img.shields.io/badge/App-Android%20%7C%20iOS-green.svg" alt="App">
</p>

---

## Do your private keys *really* belong to you?

FTX misappropriated user funds. Ledger firmware introduced backdoor interfaces. Unknown hardware wallets risk supply chain interdiction during shipping.

In the dark forest of decentralization, as long as you rely on "black box" hardware manufactured by third-party companies, your assets remain in a state of **"Schrödinger's security."**

**Airlock is not a product. It is our counter-strike against uncertainty.**

We invite you to use the **most generic, cheap hardware** (Raspberry Pi) and the **most transparent open-source code** to forge a digital vault that belongs only to you.

* **Cost < $20**: Cheaper than a decent dinner.
* **Time < 30 Mins**: No soldering required. It's like building Lego.
* **Zero Trust Architecture**: From hardware procurement to OS flashing, no middleman can be evil.

---

<h2 id="security">Why even "Physical Attacks" fail against Airlock</h2>

A common fear: *"Since it uses generic hardware, what if my device is stolen? Or what if I buy a compromised Raspberry Pi from Amazon?"*

Airlock introduces a **Mandatory Passphrase (BIP39 25th Word)** mechanism, solving the hardware trust issue mathematically.

**This is your invisible shield:**
Your private key is not generated solely by the 24 seed words. It is cryptographically superimposed with a **password that exists only in your mind**.

* **Scenario A**: A thief steals your Airlock and dumps the memory chip using advanced lab equipment.
* **Scenario B**: The Raspberry Pi you bought was intercepted and implanted with malware to steal your seed phrase.

**The Result**: All they get is an **EMPTY WALLET**.
Without the "25th word" from your brain, no one—not even a hacker with infinite computing power—can derive your real private key.

**This is Airlock's philosophy: Your assets remain secure, even if the hardware is compromised.**

---

<h2 id="experience">10,000x Safer than Hot Wallets, Just One Click Slower</h2>

Security often implies inconvenience—like typical air-gapped wallets that require you to scan complex QR codes repeatedly like a cashier. Airlock rejects this anti-human design.

We utilize **Bluetooth Low Energy (BLE)** strictly as a **data transport layer**, redefining the cold wallet experience:

1.  **Initiate Transaction on Mobile**: As smooth as using MetaMask or TrustWallet.
2.  **Airlock Wakes Up**: The screen lights up, displaying transaction details (Amount, Address).
3.  **Press Physical Button**: This is the only extra step.

**That's it.**

The moment you press that physical button is the *only* moment the private key signs the transaction.
**Without your physical authorization, no malware, hacker, or Bluetooth vulnerability can move a single cent from your device.**

The fluidity of a hot wallet. The absolute defense of cold storage.

---

<h2 id="management">Asset Management in "God Mode"</h2>

For power users with multiple addresses and diverse portfolios, Airlock offers professional-grade management capabilities.

* **Unlimited Derivation, One-Screen Control**: Stop switching back and forth between wallets. Airlock's interface allows you to view balances of all derived accounts in a single list.
* **Instant Search & Filter**: Even if you manage 100 addresses, locate the exact account you need in milliseconds.
* **Full Asset Support**:
    * **Major Chains**: Bitcoin, Ethereum, Solana, Tron, BSC, TON, Dogecoin, XRP, BCH, Avalanche, Polygon, Arbitrum, Sui, Litecoin, Dash, ETC...
    * **Custom Tokens**: Full support for USDT, USDC, DAI, and any ERC20/TRC20/SPL tokens.

---

<h2 id="start">Act Now</h2>

Don't wait until you lose your assets to think about security. Start today. Reclaim your digital sovereignty.

Detailed guides, OS images, and video tutorials are available on our [**Official Website**](https://www.airlock.pub).


## Getting Started

We provide a **minimalist** onboarding experience for everyone, while retaining the right for geeks to **build from scratch**. Please proceed in the following order:

### Step 1: Build the Cold Wallet
In this step, you need to assemble the Raspberry Pi and flash the system to turn it into an offline signing device.

[**Read: Hardware Assembly & System Flashing Guide**](./docs/en/hardware.md)
* **Includes**: Hardware Bill of Materials (BOM), assembly steps, and system image flashing.
* **Difficulty**: Easy (No programming knowledge required, similar to assembling building blocks)
* **Geek Mode**: View [Hardware Source Code](./hardware/) or build the system image yourself.

### Step 2: Install Mobile App
The mobile app serves as a "watch-only wallet," responsible for querying balances online and broadcasting transactions.

[**Read: App Installation & User Guide**](./docs/en/app.md)
* **Fast Track**: Download the [APK Installer](https://github.com/airlock-wallet/airlock/releases/download/v1.0.0/airlock-v1.0.0.apk) directly (Recommended for most users).
* **Geek Mode**: Build from [Source Code](./app/) (Android/iOS) to verify every line.

### Step 3: (Optional) Self-Hosting
Airlock provides public nodes by default, ready to use out of the box. If you prioritize ultimate privacy and do not wish to rely on our servers:

[**Read: Backend Service Deployment Guide**](./docs/en/service.md)
* **Includes**: Deploy private API from [Source Code](./services/) and configure multi-chain nodes.

---

<h2 id="donations">Support Development</h2>

Airlock is a non-profit personal project and a gift to the crypto world.

If you resonate with this **"Do It Yourself"** geek spirit, or if Airlock helps you sleep better at night, consider buying me a coffee. Your support funds server maintenance and new chain integrations.

<div align="center">
  <table>
    <tr>
      <td align="center" width="33%" valign="top">
        <img src="https://www.airlock.pub/images/donations/btc.png" width="100" alt="BTC"><br>
        <b>Bitcoin (BTC)</b><br>
        <small><code>bc1qqarhdg398lakxz2pvmllnsdgyx9ssj6j0fvyfw</code></small>
      </td>
      <td align="center" width="33%" valign="top">
        <img src="https://www.airlock.pub/images/donations/eth.png" width="100" alt="ETH"><br>
        <b>Ethereum / EVM</b><br>
        <small><code>0x78084a5d65c1f355512f0347495BB226B3A1ba74</code></small>
      </td>
      <td align="center" width="33%" valign="top">
        <img src="https://www.airlock.pub/images/donations/sol.png" width="100" alt="SOL"><br>
        <b>Solana (SOL)</b><br>
        <small><code>9LKeCD3FpUrAvzEaGWXGGAyQE96K6K3B9s5krhmhNSBW</code></small>
      </td>
    </tr>
  </table>
</div>

<br>

<details>
<summary><b>Click to see more supported assets</b></summary>
<br>
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
* **Commercial/Custom**: `support@airlock.pub`
* **Official Site**: [www.airlock.pub](https://www.airlock.pub)

---

## Disclaimer

* **"AS IS"**: This software is an open-source experimental project provided without any warranty, express or implied.
* **Use at Your Own Risk**: The user assumes all risks associated with the use of this software. The developer is not liable for any financial losses caused by hardware failure, software bugs, lost private keys, or force majeure.
* **Compliance**: Please ensure your use of this software complies with local laws and regulations.

**Build it. Verify it. Trust it.**