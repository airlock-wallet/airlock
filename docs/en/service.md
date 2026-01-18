# Backend Service Deployment Guide

[中文](../zh/service.md)

**Airlock Services** is the backend core of the Airlock ecosystem. Built on the high-performance **FastAPI** framework, it acts as a gateway between the Airlock App and major blockchain networks (e.g., Bitcoin, Ethereum, Solana, Tron).

Its primary responsibilities include:
* **Data Aggregation**: Fetches balances, Nonces, and Gas estimates from multiple nodes such as Tatum, Ankr, TronGrid, and Etherscan.
* **Price Service**: Provides real-time exchange rates for multiple currencies.
* **Privacy Protection**: Acts as a stateless proxy; stores no user private keys or sensitive data.

---

## 1. Prerequisites

### Server Requirements
* **OS**: Ubuntu 20.04 LTS / Debian 11 or higher.
* **Python**: Python 3.9 or higher.
* **Network**: Must have outbound internet access (to reach blockchain APIs).

### Core API Dependencies
This project relies on the following third-party APIs. Please ensure you have obtained the corresponding API Keys:
* **Tatum** (Multi-chain data aggregation)
* **Ankr** (Multi-chain RPC nodes)
* **TronGrid** (Tron network specific)
* **TonCenter** (TON network specific)
* **Etherscan** (EVM chain helper)

---

## 2. System Initialization & Installation

### Create Dedicated User
For security reasons, it is recommended to run the service as a dedicated user.

```bash
# Create airlock user
sudo useradd -m -s /bin/bash airlock
# Set password
sudo passwd airlock
# Grant sudo privileges (Optional, for debugging)
sudo usermod -aG sudo airlock

```

### Install Base Dependencies

```bash
sudo apt update
sudo apt install -y python3-pip python3-venv git nginx

```

### Deploy Code

Since this project uses a Monorepo structure, please clone the complete repository and navigate to the Services directory.

> **Note**: Ensure you perform these operations as the `airlock` user to avoid permission issues.

```bash
# 1. Switch to airlock user
su - airlock

# 2. Clone the repository
git clone https://github.com/airlock-wallet/airlock.git

# 3. Enter backend source directory
cd airlock/services

# 4. Create Python virtual environment
python3 -m venv venv

# 5. Activate environment and install dependencies
source venv/bin/activate
pip install -r requirements.txt

# 6. Exit airlock user
exit

```

---

## 3. Configuration

For security, all API Keys are loaded via environment variables and must strictly not be hardcoded in the codebase.

Please copy the `.env.example` template in the `services` directory to `.env` and fill in your actual keys.

```bash
# 1. Switch back to airlock user
su - airlock
cd ~/airlock/services

# 2. Copy configuration template
cp .env.example .env

# 3. Edit configuration file
vim .env

```

Fill in your API Keys in the editor:

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

## 4. Configure Systemd Service

We will use Systemd to manage the FastAPI service, ensuring process guarding and auto-start on boot.

### Create Service File

```bash
sudo vim /etc/systemd/system/airlock-api.service

```

### Write Configuration

**Note: Ensure the ExecStart path points to the correct Monorepo directory structure.**

```ini
[Unit]
Description=Airlock Wallet Backend API
After=network-online.target
Wants=network-online.target

[Service]
# Run as user
User=airlock
Group=airlock

# Working Directory
WorkingDirectory=/home/airlock/airlock/services

# Start Command (points to uvicorn in venv)
# host is set to 127.0.0.1 as we require Nginx for reverse proxy
# Adjust workers based on CPU cores (Recommended: CPU Cores * 2 + 1)
ExecStart=/home/airlock/airlock/services/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4

# Process Management
Type=simple
KillMode=control-group
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target

```

### Start Service

```bash
# Reload daemon
sudo systemctl daemon-reload

# Start service
sudo systemctl start airlock-api

# Enable auto-start on boot
sudo systemctl enable airlock-api

# Check status
sudo systemctl status airlock-api

```

---

## 5. Configure Nginx Reverse Proxy

It is recommended to use Nginx to handle SSL and concurrent connections.

```bash
sudo vim /etc/nginx/sites-available/airlock

```

Write the following content:

```nginx
server {
    listen 80;
    server_name api.your-domain.com;  # Replace with your actual domain

    location / {
        # Reverse proxy to Python backend
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # CORS Configuration (Mandatory for App access)
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;

        # OPTIONS Preflight Interception
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

Enable configuration and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/airlock /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

```

> **Tip**: It is recommended to use `certbot` to configure free SSL certificates for your domain:
> `sudo apt install certbot python3-certbot-nginx`
> `sudo certbot --nginx`

---

## API Documentation

Once the service is running, you can access the Swagger UI documentation via your browser:

* **Local Access**: `http://127.0.0.1:8000/docs`
* **Domain Access**: `https://api.your-domain.com/docs`

---

## Disclaimer

* **Software Provided "AS IS"**: This software (Airlock Services) is an open-source experimental project with no express or implied warranties.
* **Third-Party API Risks**: This project relies heavily on third-party APIs (e.g., Tatum, Ankr). If these services experience outages, change pricing models, or cease operations, this backend may fail to function correctly.
* **Privacy & Compliance**: If you deploy this backend yourself, please ensure compliance with local laws and regulations regarding the server's location, and properly protect user privacy information (such as IP addresses) in access logs.