# 硬件组装与烧录指南

[English](../en/hardware.md)

**Airlock** 是基于 Raspberry Pi Zero 2 W 打造的开源、安全冷钱包。它运行在完全断网的环境中，通过蓝牙与手机 App 进行离线通信，确保您的私钥永不触网。

本指南将带领你从零开始，组装并运行一台 Airlock 硬件钱包。

<p align="center">
  <img src="../public/images/hardware-done.jpg" alt="Airlock BOM" width="100%">
</p>

---

## 视频教程 (Coming Soon)

> 组装视频正在制作中...

---

## 第一步：硬件清单 (BOM)

在开始之前，请确保你已拥有以下组件。总成本约为 $20 - $25 USD。

| 组件名称 | 规格建议 | 说明 |
| :--- | :--- | :--- |
| **计算核心** | **Raspberry Pi Zero 2 W** | 追求便捷请选带排针版 (WH)；**追求极致体积请选无排针版**。 |
| **显示模组** | **SSD1306 OLED (0.96寸)** | 必须是 **I2C 接口** (4个引脚: VCC, GND, SDA, SCL)。 |
| **存储介质** | **MicroSD 卡** | 8GB 或以上，推荐 SanDisk 或 Samsung Class 10。 |
| **控制按键** | 4个轻触开关 | 或使用现成的 OLED 扩展板 (需确认引脚定义)。 |
| **输入设备** | USB 物理键盘 | **仅首次初始化必须**，日常使用可移除。 |
| **电源** | 5V MicroUSB 线 | 普通手机充电器或移动电源即可。 |
| **连接线** | 杜邦线或细导线 | 用于连接屏幕和按键。 |

<p align="center">
  <img src="../public/images/bom.jpg" alt="Airlock BOM" width="100%">
</p>

**如图所示，所需组件非常精简。模块化的设计让准备工作一目了然，无需复杂的电子元件知识。**

---

## 第二步：硬件组装

请严格按照下表连接线路。错误的连接可能导致无法开机或屏幕不亮。

### GPIO 接线定义表

| 硬件模块 | 引脚名称 | 树莓派 GPIO (BCM) | 物理引脚号 (Physical) |
| :--- | :--- | :--- | :--- |
| **OLED 屏幕** | VCC | 3.3V | Pin 1 |
| | GND | GND | Pin 6 |
| | **SDA** | **GPIO 19** | Pin 35 |
| | **SCL** | **GPIO 13** | Pin 33 |
| **控制按键** | **UP** (上) | **GPIO 21** | Pin 40 |
| | **DOWN** (下) | **GPIO 20** | Pin 38 |
| | **ENTER** (确认) | **GPIO 16** | Pin 36 |
| | **ESC** (返回) | **GPIO 3** | Pin 5 |

<p align="center">
  <img src="../public/images/hardware.jpg" alt="Airlock Hardware" width="100%">
</p>

**仅需连接几根核心线路即可完成构建。简洁的连线为您后续设计超薄 3D 打印外壳留出了充足空间。**

> **体积优化建议**：如果您希望将成品体积做到极致（例如名片大小），**强烈建议购买不带排针的树莓派**，并直接将线材焊接在焊盘上。直接焊接相比使用杜邦线插拔，可以显著降低整机厚度。

---

## 第三步：系统安装

为了满足不同用户的需求，我们提供两种安装方式。**请二选一：**

### 方案 A：刷入预编译镜像 (推荐)
适合大多数用户，无需编写代码，下载即用。

1.  **下载镜像**：前往 [Releases 页面](https://github.com/airlock-wallet/airlock/releases) 下载最新的 `airlock-os-v1.0.0.img.xz`。
2.  **下载工具**：安装 [Raspberry Pi Imager (树莓派官方成像器)](https://www.raspberrypi.com/software/)。
3.  **烧录**：
    * 打开 Imager。
    * 点击 "CHOOSE OS" -> 滑到最下方 "Use Custom" -> 选择刚才下载的 `.img.xz` 文件。
    * 点击 "CHOOSE STORAGE" -> 选择你的 SD 卡。
    * 点击 "NEXT" -> **不要编辑任何配置** (No, don't apply settings) -> 开始烧录。
4.  **完成**：烧录完成后将卡插入树莓派，上电即可。

---

### 方案 B：从源码手动构建 (开发者)
适合想要审计代码、定制系统或不信任预编译镜像的用户。

#### 1. 准备基础系统
* 下载官方 **Raspberry Pi OS Lite (64-bit)** 镜像并烧录。
* 配置 SSH 连接以便进行后续操作。

#### 2. 系统环境初始化
SSH 进入树莓派后，执行以下命令：

```bash
# 创建名为 airlock 的用户
sudo useradd -m -s /bin/bash airlock
sudo usermod -aG sudo,video,gpio,i2c airlock
sudo passwd airlock

# 安装系统依赖
sudo apt update
sudo apt install -y vim build-essential bluetooth bluez bluez-tools i2c-tools gpiod \
python3-libgpiod python3-gpiozero python3-pil python3-smbus rng-tools5 \
libdbus-1-dev libglib2.0-dev pkg-config python3-dev nodejs npm swig \
liblgpio-dev pi-bluetooth python3-lgpio git

```

#### 3. 硬件总线配置

修改 `/boot/firmware/config.txt` (旧版为 `/boot/config.txt`)，在 `[all]` 下添加：

```ini
[all]
# 启用软件I2C，指定 SDA=19, SCL=13
dtoverlay=i2c-gpio,i2c_gpio_sda=19,i2c_gpio_scl=13,bus=3

```

#### 4. 部署代码

```bash
su - airlock

# 1. 克隆整个仓库 (Monorepo)
git clone [https://github.com/airlock-wallet/airlock.git](https://github.com/airlock-wallet/airlock.git)

# 2. 进入硬件代码目录 (关键步骤!)
cd airlock/hardware

# 3. 创建虚拟环境 (建议放在当前目录下，方便管理)
python3 -m venv venv
source venv/bin/activate

# 4. 安装 Python 依赖
pip install -r requirements.txt

# 5. 安装 Node.js 依赖 (用于加密签名 Worker)
cd js
npm install

# 退出 airlock 用户
exit

```

#### 5. 配置 Systemd 自启

创建 `/etc/systemd/system/airlock.service`：

```ini
[Unit]
Description=Airlock Hardware Wallet Service
After=multi-user.target network.target bluetooth.target
StartLimitIntervalSec=0

[Service]
Type=simple
# 核心启动命令 (Monorepo 路径)
ExecStart=/home/airlock/airlock/hardware/venv/bin/python /home/airlock/airlock/hardware/main.py

# 关机/停止脚本
ExecStop=/home/airlock/airlock/hardware/venv/bin/python /home/airlock/airlock/hardware/shutdown.py

# 确保 Python 日志不缓存，实时输出到 journalctl
Environment=PYTHONUNBUFFERED=1

# 进程管理策略
KillMode=control-group
Restart=always
RestartSec=5

# 权限设置
User=airlock
Group=airlock
WorkingDirectory=/home/airlock/airlock/hardware

[Install]
WantedBy=multi-user.target

```

启用服务：`sudo systemctl enable airlock`

#### 6. 安全加固 (防火墙)

**这是手动构建最关键的一步**：

```bash
sudo ufw default deny incoming
sudo ufw default deny outgoing  # 禁止所有出站流量 (防私钥泄露)
sudo ufw allow from 192.168.0.0/16 to any port 22 # 仅允许局域网 SSH
sudo ufw enable

```

---

## 核心安全机制

无论是方案 A 还是方案 B，启动后请务必遵守以下安全准则：

1. **强制第 25 短语 (BIP39 Passphrase)**

* **防供应链攻击**：Airlock **强制要求**使用 Passphrase。
* 即使您的 24 位助记词被摄像头偷拍，没有您脑海中的“第 25 个词”，黑客也无法盗取资产。

2. **首次创建需连接键盘**

* **初始化安全**：生成或导入钱包时，**必须连接 USB 物理键盘**。
* 这是为了防止蓝牙传输过程中的任何潜在监听风险。初始化完成后即可拔除键盘。

3. **备份警示**

* 您必须同时物理备份 **[12/24位助记词]** 和 **[Passphrase]**。
* **警告**：如果你忘记了 Passphrase，资产将永久丢失。

---

## 免责声明

* **软件按“原样”提供**：Airlock 是开源实验性项目，无任何明示担保。
* **风险自负**：对于因硬件故障、操作失误（如忘记密码）、或不可抗力导致的资产损失，开发者不承担法律责任。
* **自主验证**：我们信奉 "Don't Trust, Verify"。请尽量自行审查代码。