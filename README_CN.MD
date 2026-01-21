<p align="center">
  <img src="./docs/public/images/airlock.jpg" alt="Airlock Wallet Cover" width="100%">
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
  <a href="#security">三维防御</a> •
  <a href="#comparison">硬核对比</a> •
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

<h2 id="why">你的私钥，真的属于你吗？</h2>

FTX 挪用了用户资金，Ledger 固件留下了后门接口，不知名的硬件钱包在运输途中可能被植入芯片。在这个去中心化的黑暗森林里，只要你还在依赖第三方生产的黑盒硬件，你的资产就永远处于“薛定谔的安全”状态。

Airlock 不是一款商品，它是我们对这种不确定性的**反击**。

我们邀请你用**最通用的廉价硬件**（树莓派）、**最透明的开源代码**，亲手铸造一个只属于你的数字金库。

* **成本不到 $20**：比一顿晚餐还便宜。
* **耗时仅 30 分钟**：无需焊接，像搭积木一样简单。
* **零信任架构**：从硬件采购到系统烧录，没有任何中间商可以作恶。

---

<h2 id="security">为什么连“物理攻击”都无法攻破 Airlock？</h2>

传统的硬件钱包只能防御网络攻击，而 Airlock 构建了 **“三维防御体系”**，从数学、物理到人性层面，彻底解决信任问题：

**第一重防御：抗供应链攻击 (针对“内鬼”)**

* **机制**：**强制 BIP39 Passphrase (第 25 词)**
* **场景**：假设你购买的树莓派被预植了后门，或者固件被黑客篡改，导致你的 **24 个助记词**被泄露。
* **结果**：黑客拿到 24 个词后，打开的只是一个默认的**空钱包**。
* **原理**：你的真实资产存储在由“24 词 + Passphrase”生成的**隐藏钱包**中。这个 Passphrase 只存在于你的脑海里，绝不会被明文存储或通过网络传输。没有它，黑客拿到助记词也毫无意义。

**第二重防御：抗物理窃取 (针对“小偷”)**

* **机制**：**AES-256 全盘加密 (支付密码)**
* **场景**：假设你的设备不慎丢失或被小偷偷走，且攻击者试图通过读取 SD 卡来提取数据。
* **结果**：他们只能看到一堆**乱码**。
* **原理**：Airlock 使用你的**支付密码**作为密钥，对设备内的所有敏感数据（包括 24 词助记词和 Passphrase 的哈希）进行高强度 **AES 加密**。没有你脑海中的支付密码，即便拥有世界顶级的算力，也无法暴力破解出私钥文件。

**第三重防御：抗胁迫攻击 (针对“绑匪”)**

* **机制**：**双重 PIN 码分流 (Dual PIN System)**
* **场景**：这是所有持币者最不愿面对的时刻——当你遭到歹徒绑架，或者被强迫解锁手机 App 查看资产时。
* **对策**：Airlock App 在初始化时**强制要求设置两套完全不同的 PIN 码**，分别对应两套平行世界：
    * **输入 PIN A (诱饵)**：App 进入**仅含 24 词的“诱饵钱包”**。界面展示你预存的少量“保命钱”（如 $500），功能完全正常，可查账、可转账。
    * **输入 PIN B (真实)**：App 进入**包含 25 词的“真实金库”**。这里才躺着你的数百万核心资产。
* **结果**：当被胁迫时，你只需从容地输入 **PIN A**。歹徒看到的是一个逻辑自洽、余额真实的钱包，完全无法察觉另一个平行空间的存在。
* **真相**：你的真实财富从未被加载，也根本不存在于当前的 App 界面中。
* **哲学**：**用小钱保命，用大钱养老。** Airlock 赋予你完美的“可否认性 (Plausible Deniability)”。

---

<h2 id="comparison">为什么选择 Airlock？(不服跑个分)</h2>

我们将 Airlock 与市面上主流的 DIY 方案及商业硬件钱包进行了残酷的横向对比。

| 核心特性 | **Airlock** | SeedSigner | Ledger Nano X | 手机/插件热钱包 |
| :--- | :---: | :---: | :---: | :---: |
| **支持资产** | **全能 (TrustWallet 核心)** | 仅 Bitcoin | 全能 | 全能 |
| **输入体验**<br>*(创建/恢复钱包时)* | **物理键盘 (极速)** | 摇杆 (缓慢) | 双按钮 (繁琐) | 触摸屏 |
| **日常交易速度**<br>*(转账/签名时)* | **仅需一键确认** | 繁琐 (多次扫码) | 较慢 (多屏核对) | **极快 (但不安全)** |
| **连接方式** | **蓝牙 (离线签名)** | 摄像头扫码 (慢) | 蓝牙/USB | **实时联网 (高危)** |
| **抗胁迫 (诱饵)** | **完美支持** | 无 | 有限 | 无 |
| **构建成本** | **< $20** | ~ $50 | $149 | 免费 (代价是本金) |

> **一句话总结**：Airlock 是目前唯一结合了 **“DIY 的透明度”**、**“热钱包的蓝牙体验”** 以及 **“物理键盘的输入效率”** 的多链硬件钱包。

---

<h2 id="experience">比热钱包安全一万倍，操作只多按一次键</h2>

安全往往意味着麻烦——比如全气隙钱包通常需要像收银员一样反复扫描复杂的二维码。Airlock 拒绝这种反人类的设计。

我们利用低功耗蓝牙 (BLE) 作为**纯粹的数据传输通道**，重塑了冷钱包的交互体验：

1.  **在手机上发起转账**：就像使用 MetaMask 或 TrustWallet 一样流畅。
2.  **Airlock 自动唤醒**：树莓派屏幕亮起，显示交易详情（金额、地址）。
3.  **App 输入支付密码**：App 端输入密码解密硬件核心数据。
4.  **按下物理按钮**：这是唯一的额外步骤。

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

## 快速开始

我们为所有人提供**极简**的上手体验，同时也为极客保留了**从零构建**的权利。请按顺序操作：

### 第一步：打造冷钱包
这一步你需要组装树莓派并写入系统，使其成为一台离线签名设备。

[**阅读：硬件组装与系统烧录指南**](./docs/zh/hardware.md)
* **包含**：硬件购买清单 (BOM)、组装步骤、系统镜像烧录。
* **难度**：简单 (无需编程知识，像装积木一样)
* **极客模式**：查看 [硬件源码](./hardware/) 或自行构建系统镜像。

### 第二步：安装手机端
手机端作为“观察钱包”，负责联网查询余额和广播交易。

[**阅读：App 安装与使用指南**](./docs/zh/app.md)
* **极速通道**：直接下载 [APK 安装包](https://github.com/airlock-wallet/airlock/releases/download/v1.0.0/airlock-v1.0.0.apk) (适合大多数人)。
* **极客模式**：自行从[源码编译](./app/) (Android/iOS)，验证每一行代码。

### 第三步：(可选) 私有化部署
Airlock 默认提供公共节点，开箱即用。如果你追求极致隐私，不想依赖我们的服务器：

[**阅读：后端服务部署指南**](./docs/zh/service.md)
* **包含**：自行从[源码部署](./services/)私有 API、配置多链节点。


---


<h2 id="donations">捐赠支持</h2>

Airlock 是一个非盈利的个人开源项目，也是一份送给加密世界的礼物。

如果你被这种 **“自己动手，丰衣足食”** 的极客精神打动，或者 Airlock 让你在夜晚睡得更安稳，欢迎请我喝一杯咖啡。您的支持将用于服务器维护和新链适配。

<div align="center">
  <table>
    <tr>
      <td align="center" width="33%" valign="top">
        <img src="./docs/public/donations/btc.png" width="100" alt="BTC"><br>
        <b>Bitcoin (BTC)</b><br>
        <small><code>bc1qqarhdg398lakxz2pvmllnsdgyx9ssj6j0fvyfw</code></small>
      </td>
      <td align="center" width="33%" valign="top">
        <img src="./docs/public/donations/eth.png" width="100" alt="ETH"><br>
        <b>Ethereum / EVM</b><br>
        <small><code>0x78084a5d65c1f355512f0347495BB226B3A1ba74</code></small>
      </td>
      <td align="center" width="33%" valign="top">
        <img src="./docs/public/donations/sol.png" width="100" alt="SOL"><br>
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