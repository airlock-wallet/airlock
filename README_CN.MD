<p align="center">
  <img src="https://www.airlock.pub/images/airlock.jpg" alt="Airlock Wallet Cover" width="100%">
</p>

<h1 align="center">Airlock Wallet</h1>

<p align="center">
  <a href="./README.MD">🇺🇸 English (英文文档)</a>
</p>

<p align="center">
  <strong>在该信任代码的时代，不要去信任公司。</strong>
</p>

<p align="center">
  <a href="#why">核心哲学</a> •
  <a href="#security">终极安全</a> •
  <a href="#experience">极致体验</a> •
  <a href="#management">资产管理</a> •
  <a href="#start">立即构建</a> •
  <a href="#donations">捐赠支持</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-AGPL%203.0-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/Hardware-Raspberry%20Pi-red.svg" alt="Hardware">
  <img src="https://img.shields.io/badge/App-Android%20%7C%20iOS-green.svg" alt="App">
</p>

---

## 你的私钥，真的属于你吗？

FTX 挪用了用户资金，Ledger 固件留下了后门接口，不知名的硬件钱包在运输途中可能被植入芯片。在这个去中心化的黑暗森林里，只要你还在依赖第三方生产的黑盒硬件，你的资产就永远处于“薛定谔的安全”状态。

Airlock 不是一款商品，它是我们对这种不确定性的**反击**。

我们邀请你用**最通用的廉价硬件**（树莓派）、**最透明的开源代码**，亲手铸造一个只属于你的数字金库。

* **成本不到 $20**：比一顿晚餐还便宜。
* **耗时仅 30 分钟**：无需焊接，像搭积木一样简单。
* **零信任架构**：从硬件采购到系统烧录，没有任何中间商可以作恶。

---

<h2 id="security">为什么连“物理攻击”都无法攻破 Airlock？</h2>

很多用户担心：“既然是通用硬件，如果我的树莓派被偷了，或者我在淘宝买到了被植入后门的树莓派怎么办？”

Airlock 引入了**强制性 Passphrase（BIP39 第 25 词）机制**，从数学层面彻底解决了硬件信任问题。

**这是你的隐形护盾：**
你的私钥不仅仅由 24 个助记词生成，还必须叠加一个**只存在于你脑海中的密码（Passphrase）**。
* **假设场景 A**：小偷偷走了你的 Airlock 设备，并通过高科技手段读取了内存芯片。
* **假设场景 B**：你在网上买的树莓派被黑客植入了恶意代码，窃取了你的 24 个助记词。

**结果**：他们得到的只是一个**空钱包**。
没有你脑海中的“第 25 词”，任何人都无法计算出真正的私钥。哪怕黑客拥有全世界最强的算力，拿到物理设备也仅仅是一块废铁。

**这就是 Airlock 的安全哲学：即使硬件不可信，资产依然安全。**

---

<h2 id="experience">比热钱包安全一万倍，操作只多按一次键</h2>

安全往往意味着麻烦——比如全气隙钱包通常需要像收银员一样反复扫描复杂的二维码。Airlock 拒绝这种反人类的设计。

我们利用低功耗蓝牙 (BLE) 作为**纯粹的数据传输通道**，重塑了冷钱包的交互体验：

1.  **在手机上发起转账**：就像使用 MetaMask 或 TrustWallet 一样流畅。
2.  **Airlock 自动唤醒**：树莓派屏幕亮起，显示交易详情（金额、地址）。
3.  **按下物理按钮**：这是唯一的额外步骤。

**仅此而已。**

当你按下物理按钮的那一刻，才是私钥签名的唯一瞬间。
**没有你的物理授权，任何木马、黑客、或者蓝牙漏洞都无法从设备中转走一分钱。**

既拥有热钱包的丝滑，又拥有冷钱包的绝对防御。

---

<h2 id="management">上帝视角的资产管理</h2>

对于拥有多个钱包地址、需要管理多种资产的资深用户，Airlock 提供了专业级的管理能力。

* **无限派生，一屏掌控**：不再需要在不同的钱包之间反复切换。Airlock 的界面专为多账户设计，你可以在一个列表中查看所有派生钱包的余额。
* **毫秒级搜索与过滤**：即使你有 100 个地址，通过强大的搜索和过滤功能，也能瞬间定位到你需要操作的那个账户。
* **全资产支持**：
    * **主流公链**：Bitcoin, Ethereum, Solana, Tron, BSC, TON, Dogecoin, XRP, BCH, Avalanche, Polygon, Arbitrum, Sui, Litecoin, Dash, ETC...
    * **自定义代币**：完美支持 USDT, USDC, DAI 以及任何 ERC20/TRC20/SPL 代币。

---

<h2 id="start">立即行动</h2>

不要等到资产丢失的那一天才想起安全。现在就开始，夺回你的数字主权。

所有详细文档、镜像下载和视频教程均可在我们的 [**官方网站**](https://www.airlock.pub) 找到。

### 1. 准备硬件
[**硬件组装指南**](https://github.com/airlock-wallet/airlock/tree/main/hardware)
*(仅需：Raspberry Pi Zero 2 W + SSD1306 OLED 屏幕 + SD卡)*

### 2. 软件准备
* **硬件端**：下载我们就绪的系统镜像，烧录进 SD 卡，插卡即用。
* **手机端**：[**下载 Android App (APK)**](https://github.com/airlock-wallet/airlock/releases) 或自行编译 iOS 版本。

### 3. 私有化 (可选)
[**服务端部署指南**](https://github.com/airlock-wallet/airlock/tree/main/services)
*(Airlock 默认提供公共节点服务，开箱即用。但如果你追求极致隐私，可以轻松部署自己的后端)*

---

<h2 id="donations">捐赠支持</h2>

Airlock 是一个非盈利的个人开源项目，也是一份送给加密世界的礼物。

如果你被这种**“自己动手，丰衣足食”**的极客精神打动，或者 Airlock 让你在夜晚睡得更安稳，欢迎请我喝一杯咖啡。您的支持将用于服务器维护和新链适配。

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
<summary><b>点击查看更多支持的币种 (Click for more options)</b></summary>
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

## 社区与支持

* **Bug 反馈**: [GitHub Issues](https://github.com/airlock-wallet/airlock/issues)
* **商业定制/私有化**: `support@airlock.pub`
* **官方网站**: [www.airlock.pub](https://www.airlock.pub)

---

## 免责声明

* **软件按“原样”提供**：本软件是开源实验性项目，没有任何形式的明示或暗示担保。
* **风险自负**：用户需自行承担使用本软件的所有风险。对于因硬件故障、软件错误、私钥丢失或不可抗力导致的资金损失，开发者不承担任何法律责任。
* **合规性**：请用户自行确保使用本软件符合当地法律法规。

**Build it. Verify it. Trust it.**