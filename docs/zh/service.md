# 服务端部署指南

[English](../en/service.md)

**Airlock Services** 是 Airlock 钱包生态的后端核心。它基于高性能的 **FastAPI** 框架构建，充当 Airlock App 与各大区块链网络（如 Bitcoin, Ethereum, Solana, Tron 等）之间的网关。

它主要负责：
* **数据聚合**：从 Tatum, Ankr, TronGrid, Etherscan 等多个节点获取余额、Nonce 和 Gas 估算。
* **价格服务**：提供多币种的实时汇率查询。
* **隐私保护**：作为无状态代理，不存储任何用户私钥或敏感数据。

---

## 1. 环境准备

### 服务器要求
* **操作系统**: Ubuntu 20.04 LTS / Debian 11 或更高版本。
* **Python**: Python 3.9 或更高版本。
* **网络**: 需要能够访问外网（访问各大区块链节点 API）。

### 核心依赖 API
本项目依赖以下服务商的 API，请确保您准备好了相应的 API Key：
* **Tatum** (多链数据聚合)
* **Ankr** (多链 RPC 节点)
* **TronGrid** (Tron 网络专用)
* **TonCenter** (TON 网络专用)
* **Etherscan** (EVM 链辅助)

---

## 2. 系统初始化与安装

### 创建专用用户
出于安全考虑，建议使用专用用户运行服务。

```bash
# 创建 airlock 用户
sudo useradd -m -s /bin/bash airlock
# 设置密码
sudo passwd airlock
# 赋予 sudo 权限 (可选，方便调试)
sudo usermod -aG sudo airlock

```

### 安装基础环境

```bash
sudo apt update
sudo apt install -y python3-pip python3-venv git nginx

```

### 部署代码

由于本项目采用 Monorepo 结构，请克隆完整仓库并进入 Services 目录。

> **注意**：请务必确保在 `airlock` 用户下执行操作，否则会导致权限问题。

```bash
# 1. 切换到 airlock 用户
su - airlock

# 2. 拉取代码
git clone https://github.com/airlock-wallet/airlock.git

# 3. 进入后端代码目录
cd airlock/services

# 4. 创建 Python 虚拟环境
python3 -m venv venv

# 5. 激活环境并安装依赖
source venv/bin/activate
pip install -r requirements.txt

# 6. 退出 airlock 用户
exit

```

---

## 3. 配置文件修改

为了安全起见，所有的 API Key 都通过环境变量加载，严禁硬编码在代码中。

请将 `services` 目录下的 `.env.example` 模板文件复制为 `.env`，并填入您的真实 Key。

```bash
# 1. 切换回 airlock 用户
su - airlock
cd ~/airlock/services

# 2. 复制配置模板
cp .env.example .env

# 3. 编辑配置文件
vim .env

```

在打开的编辑器中，请填入您申请到的 API Key：

```ini
# Tatum API Keys
TATUM_API_KEY_MAINNET=your_tatum_key_here
TATUM_API_KEY_TESTNET=your_tatum_test_key_here

# Ankr API
ANKR_API_KEY_MAINNET=your_ankr_key_here

# TronGrid API
TRONGRID_API_KEY_MAINNET=your_trongrid_key_here

# TON API
TON_API_KEY_MAINNET=your_ton_key_here

# Etherscan API
ETHERSCAN_API_KEY_MAINNET=your_etherscan_key_here

```

---

## 4. 配置 Systemd 开机自启

我们将使用 Systemd 来管理 FastAPI 服务，确保进程守护与开机自启。

### 创建服务文件

```bash
sudo vim /etc/systemd/system/airlock-api.service

```

### 写入配置

**注意：请确保 ExecStart 中的路径指向正确的 Monorepo 目录结构。**

```ini
[Unit]
Description=Airlock Wallet Backend API
After=network-online.target
Wants=network-online.target

[Service]
# 指定运行用户
User=airlock
Group=airlock

# 工作目录
WorkingDirectory=/home/airlock/airlock/services

# 启动命令 (指向虚拟环境中的 uvicorn)
# host 设置为 127.0.0.1 因为我们强制要求配合 Nginx 使用
# workers 根据服务器 CPU 核心数调整 (建议 CPU核数 * 2 + 1)
ExecStart=/home/airlock/airlock/services/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4

# 进程管理配置
Type=simple
KillMode=control-group
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target

```

### 启动服务

```bash
# 重载配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start airlock-api

# 设置开机自启
sudo systemctl enable airlock-api

# 查看运行状态
sudo systemctl status airlock-api

```

---

## 5. 配置 Nginx 反向代理

建议使用 Nginx 处理 SSL 和并发连接。

```bash
sudo vim /etc/nginx/sites-available/airlock

```

写入以下内容：

```nginx
server {
    listen 80;
    server_name api.your-domain.com;  # 请替换为您的域名

    location / {
        # 反代 Python 后端
        proxy_pass [http://127.0.0.1:8000](http://127.0.0.1:8000);
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 跨域 CORS (App 访问必须配置)
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;

        # OPTIONS 预检拦截 (处理浏览器的跨域询问)
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
}

```

启用配置并重启 Nginx：

```bash
sudo ln -s /etc/nginx/sites-available/airlock /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

```

> **提示**: 建议使用 `certbot` 为域名配置免费的 SSL 证书：
> `sudo apt install certbot python3-certbot-nginx`
> `sudo certbot --nginx`

---

## 接口文档

服务启动后，您可以通过浏览器访问 Swagger UI 文档进行测试：

* **本地访问**: `http://127.0.0.1:8000/docs`
* **域名访问**: `https://api.your-domain.com/docs`

---

## 免责声明

* **软件按“原样”提供**：本软件（Airlock Services）是开源实验性项目，没有任何形式的明示或暗示担保。
* **API 依赖风险**：本项目强依赖第三方 API（如 Tatum, Ankr）。若第三方服务中断、变更计费策略或停止服务，可能导致本后端无法正常工作。
* **隐私与合规**：若您自行部署后端，请确保遵守服务器所在地的法律法规，并妥善保护访问日志中的用户隐私信息（如 IP 地址）。

**使用本软件即代表您已阅读并同意上述条款。**
