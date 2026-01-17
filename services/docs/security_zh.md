<div class="text-caption text-grey-7 q-mb-lg">
    最后更新：2025年12月08日
</div>

<div class="bg-blue-1 text-blue-9 q-pa-md rounded-borders q-mb-lg" style="border-left: 5px solid #3F51B5;">
    <div class="text-subtitle2 text-weight-bold q-mb-xs">
        <i class="material-icons" style="font-size: 1.2em; vertical-align: text-bottom;">admin_panel_settings</i> 
        最佳安全实践指南
    </div>
    为了您的资金安全，我们强烈建议您在使用 <b>Airlock</b> 之前认真阅读本指南，并严格按照本指南的安全规范进行操作。
</div>

<div class="text-subtitle1 text-weight-bold text-primary q-mb-xs">
  <i class="q-icon material-icons" style="font-size: 1em; vertical-align: middle;">wifi_off</i> 1. 彻底的物理隔离
</div>

Airlock 是冷钱包，**核心原则是永不触网**。
为了您的资产安全，请严格遵守以下红线：

- **禁止** 插入任何未知设备，除非你确定其安全
- **禁止** 将 Airlock 连接 WIFI 等任何网络
- 仅使用 **电源线** 连接设备，避免连接电脑 USB

---

<div class="text-subtitle1 text-weight-bold text-primary q-mb-xs">
  <i class="q-icon material-icons" style="font-size: 1em; vertical-align: middle;">bluetooth</i>  2. 规范的蓝牙交互
</div>

App 与冷钱包之间仅通过**蓝牙**传递信息：

1. **App -> Airlock**：发送未签名的交易
2. **Airlock -> App**：发送已签名的结果
3. **App**: 对已签名交易进行广播，交易完成

<div class="bg-red-1 text-red-9 q-pa-sm rounded-borders q-my-sm">
  <i class="q-icon material-icons" style="font-size: 1em; vertical-align: middle;">warning</i> <b>警惕：</b>
  如果在签名过程中，设备提示的交易信息与您的实际交易不符，请立即停止操作
</div>

---

<div class="text-subtitle1 text-weight-bold text-primary q-mb-xs">
  <i class="q-icon material-icons" style="font-size: 1em; vertical-align: middle;">vpn_key</i>  3. 助记词保管
</div>

助记词（Mnemonic Phrase）就是您的资产。

- **请勿截屏**：不要在手机 App 上截屏助记词
- **物理备份**：请使用纸张抄写或使用金属助记词板
- **防火防水**：将备份存放在安全、隐秘的地方

> 任何索要助记词的行为（包括客服）均为诈骗

---

<div class="text-caption text-grey-6 text-right q-mt-lg">
  Airlock Open Source Team
</div>