<div class="text-caption text-grey-7 q-mb-lg">
    生效日期：2025年12月08日
</div>

<div class="bg-teal-1 text-teal-9 q-pa-md rounded-borders q-mb-lg" style="border-left: 5px solid #009688;">
    <div class="text-subtitle2 text-weight-bold q-mb-xs">
        <i class="material-icons" style="font-size: 1.2em; vertical-align: text-bottom;">shield</i> 
        核心承诺
    </div>
    我们遵循 <b>“私钥不触网”</b> 原则。虽然设备通过蓝牙通信，但您的私钥（Private Key）永远存储在树莓派的安全芯片/存储区中，绝不会通过蓝牙发送给手机或上传云端。
</div>

<div class="text-h6 text-weight-bold text-grey-9 q-mt-md q-mb-sm">1. 数据处理机制</div>

Airlock 采用 **“离线签名，联网广播”** 的工作模式：

- **冷钱包端（树莓派）**：
    - <span class="text-weight-bold text-primary">纯离线运行</span>：设备不连接 Wi-Fi，仅开启低功耗蓝牙（BLE）作为从机。
    - <span class="text-weight-bold text-primary">数据边界</span>：蓝牙通道仅用于接收“未签名数据”和发送“已签名数据”。
    - **私钥不出设备**：签名过程完全在树莓派内部完成。

- **观察端（手机 App）**：
    - **网关角色**：App 充当区块链网络与冷钱包之间的网关。
    - **透明传输**：App 将区块链上的待处理交易通过蓝牙传给冷钱包，并在收到签名后广播回区块链。

---

<div class="text-h6 text-weight-bold text-grey-9 q-mt-md q-mb-sm">2. 关键权限说明</div>

为了建立安全的蓝牙通道，App 需要以下系统权限：

1.  **<div class="q-mt-md">蓝牙与附近设备 (Bluetooth / Nearby Devices)</div>**
    - <i class="material-icons text-grey-6" style="font-size: 1em; vertical-align: middle;">bluetooth</i> **用途**：用于扫描并连接您的 Airlock 树莓派设备。
    - **隐私**：我们仅连接名称匹配 Airlock 协议的设备，不会扫描或记录其他蓝牙设备信息。

2.  **<div class="q-mt-md">摄像头与相册 (Camera & Storage)</div>**
    - <i class="material-icons text-grey-6" style="font-size: 1em; vertical-align: middle;">qr_code_scanner</i> **用途**：用于扫描接收方地址二维码以发起交易，或从本地相册选取二维码图片进行识别。
    - **隐私**：二维码解析完全在本地设备进行，我们**不会**保存或上传您的任何照片或视频画面。
    
3.  **<div class="q-mt-md">位置信息 (Location)</div>**
    - <i class="material-icons text-grey-6" style="font-size: 1em; vertical-align: middle;">location_on</i> **用途**：在 Android 11 及以下版本中，系统要求蓝牙扫描必须开启位置权限。
    - **声明**：我们**不会**记录或上传您的 GPS 地理位置轨迹。

4.  **<div class="q-mt-md">网络权限 (Internet)</div>**
    - <i class="material-icons text-grey-6" style="font-size: 1em; vertical-align: middle;">public</i> **用途**：仅用于同步链上余额和广播交易。

---

<div class="text-h6 text-weight-bold text-grey-9 q-mt-md q-mb-sm">3. 安全性声明</div>

尽管使用无线连接，我们采取了多重防护措施：

* **端对端加密**：手机与树莓派之间的蓝牙传输经过 AES 加密，防止数据被周围设备窃听。
* **人工确认机制**：每一笔交易在签名并通过蓝牙发送回手机前，都必须在树莓派屏幕上进行**人工物理确认**（按下实体按键）。
* **无后台服务**：App 退出后，蓝牙连接立即断开，不会在后台静默通信。

---

<div class="bg-grey-2 q-pa-md rounded-borders q-mt-lg text-grey-8">
    <div class="text-subtitle2 text-weight-bold">
        <i class="material-icons" style="font-size: 1.2em; vertical-align: text-bottom;">contact_support</i> 
        联系与反馈
    </div>
    <div class="q-mt-sm" style="font-size: 0.9em;">
        如遇蓝牙连接失败或安全疑虑，请访问 Github Issues 提交日志（请确日志中不包含敏感私钥信息）。
    </div>
</div>