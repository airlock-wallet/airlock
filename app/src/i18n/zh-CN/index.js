/**
 * Copyright (C) 2026 Le Wang
 *
 * This file is part of Airlock.
 *
 * Airlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Airlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Airlock.  If not, see <https://www.gnu.org/licenses/>.
 */

export default {
    walletListPage: {
        filter: {
            all_chains: '全部链',
            summary_balance: '余额>={amount}',
            label: '筛选',
            summary_prefix: '全部资产',
            network: '所属网络',
            balance: '余额过滤',
            balance_placeholder: '自定义最小余额',
            fuzzy: '模糊查询',
            fuzzy_placeholder: '输入代币名称、符号或钱包地址',
            reset: '重置所有',
            apply: '确认应用',
            title: '筛选资产'
        },
        list: {
            empty: '暂无资产',
            end: '没有更多数据了'
        },
        msg: {
            added: '成功添加 {count} 个资产',
            derive_failed: '派生失败: {error}',
            limit_exceeded: '已超过数量限制',
            error_retry: '发生错误，请稍候重试'
        }
    },
    setupPage: {
        title_wizard: '安全设置向导',
        subtitle_wizard: '请按步骤设置您的双重安全密码',
        step1: {
            title: '标准 PIN',
            subtitle: '设置标准钱包密码',
            desc_html: '此 PIN 码用于解锁您的<strong>默认钱包 (24 助记词)</strong>',
            label_pin: '输入标准 PIN (6-32位)',
            btn_next: '下一步'
        },
        step2: {
            title: '确认',
            subtitle: '请再次输入确认',
            label_confirm: '再次输入标准 PIN',
            btn_confirm: '确认',
            btn_back: '返回修改'
        },
        step3: {
            title: '隐形 PIN',
            subtitle: '设置高级隐形密码',
            desc_html: '此 PIN 码用于解锁您的<strong>隐形钱包 (25 助记词)</strong>',
            label_hidden_pin: '输入隐形 PIN (6-32位)'
        },
        step4: {
            title: '完成',
            subtitle: '最后确认隐形密码',
            label_confirm_hidden: '再次输入隐形 PIN',
            btn_finish: '完成'
        },
        error: {
            pin_min_length: 'PIN 码至少 6 位',
            pin_mismatch: 'PIN 码不一致',
            pin_same: '隐形 PIN 不能与标准 PIN 相同！'
        },
        msg: {
            setup_success: '安全设置成功',
            setup_failed: '安全设置失败'
        }
    },
    mePage: {
        title_app: 'AIRLOCK',
        subtitle: '基于树莓派 Zero 2 W 平台打造的开源安全冷钱包',
        list: {
            node_setting: '节点设置',
            node_caption: '配置 API 连接地址',
            language: '语言设置',
            app_lock: '应用锁',
            lock_caption: '修改 App 启动密码',
            security_practice: '安全实践',
            security_caption: '冷钱包物理隔离与离线签名操作指南',
            project_docs: '项目文档',
            docs_caption: '了解 Airlock 的安全机制',
            source_code: '开源仓库',
            source_caption: '查看 App 与树莓派固件源代码',
            privacy: '隐私声明',
            privacy_caption: '承诺绝不上传私钥，数据纯本地存储',
            terms: '免责条款',
            terms_caption: '开源协议许可与用户风险提示',
            system_update: '系统更新',
            update_caption: '当前版本 v{version}',
            feedback: '问题反馈',
            feedback_caption: '提交 Bug 或加入社区讨论'
        },
        update: {
            new_version: '发现新版本',
            new_version_caption: '当前软件有最新版本, 请从官网升级',
            btn_visit: '访问官网',
            btn_close: '关闭',
            latest_title: '已经是最新版本',
            latest_caption: '当前软件版本已经是最新, 无需升级'
        },
        msg: {
            pin_updated: '更新 PIN 成功'
        }
    },
    loginPage: {
        title_app: 'AirLock',
        welcome: '欢迎回来，请先解锁钱包',
        input_label: '请输入 PIN 码',
        btn_unlock: '立即解锁',
        error: {
            pin_too_short: 'PIN 码长度不足',
            pin_incorrect: 'PIN 码错误',
            verify_error: '验证出错: {error}',
            db_critical: '严重错误：数据库无法读取，应用即将退出。请尝试卸载重装。'
        }
    },
    loadWalletPage: {
        title: '初始化钱包',
        description_html: '当前设备未检测到任何钱包数据<br>请连接您的硬件设备以同步账户',
        btn_connect: '连接并同步钱包',
        status: {
            ready: '准备同步...',
            connecting: '正在连接设备...',
            parsing: '正在解析数据...',
            detail_confirm: '请留意硬件端确认请求',
            saving: '正在保存数据',
            saving_detail: '请稍候...'
        },
        msg: {
            empty_response: '设备返回的账户列表为空',
            sync_failed: '同步失败',
            unknown_error: '未知错误'
        }
    },
    devicePage: {
        title: '设备信息',
        menu: {
            refresh: '刷新设备',
            reboot: '重启设备',
            shutdown: '安全关机'
        },
        label: {
            device_name: '设备名称',
            firmware_version: '固件版本',
            platform: '运行平台',
            hardware: '硬件平台',
            display: '显示设备',
            cpu_temp: 'CPU温度'
        },
        no_device_connected: '没有连接到任何设备，请先连接设备！',
        dialog: {
            reboot_title: '重启设备',
            reboot_msg: '重启过程可能需要耗时 30 秒，你确定要重启设备吗？',
            shutdown_title: '安全关机',
            shutdown_msg: '你确定需要安全关闭设备吗？'
        },
        msg: {
            refresh_success: '刷新设备成功',
            get_info_failed: '获取设备信息失败，请检查连接',
            unknown_error: '未知错误',
            reboot_sent: '重启命令已发送',
            reboot_failed: '发送重启命令失败，请检查连接',
            shutdown_sent: '关机命令已发送',
            shutdown_failed: '发送关机命令失败，请检查连接'
        }
    },
    assetDetailPage: {
        title_history: '交易记录',
        no_history: '暂无交易记录',
        btn_receive: '收款',
        btn_send: '转账',
        tx_type_send: '发送',
        tx_type_receive: '接收',
        msg: {
            asset_not_found: '资产不存在',
            copied: '地址已复制',
            copy_failed: '复制失败',
            clipboard_unavailable: 'Clipboard 未就绪'
        }
    },
    accountPage: {
        total_assets: '总资产估值 (USD)',
        search_placeholder: '搜索账户名称或币种...',
        account_list: '账户列表',
        no_account_match: '未找到匹配的账户',
        msg: {
            account_added: '账户添加成功',
            add_failed: '添加帐户失败，请重试',
            empty_response: '设备返回的账户列表为空'
        }
    },
    menu: {
        accounts: '帐户',
        device: '设备',
        me: '我'
    },
    updatePassword: {
        title: '更新 PIN 码',
        input: {
            old_pin_hint: '请输入当前的 PIN 码',
            old_pin_label: '原始 PIN',
            new_pin_hint: '请输入新的 PIN 码',
            new_pin_label: '新 PIN 码',
            confirm_pin_hint: '请再次输入新的 PIN 码',
            confirm_pin_label: '重复 PIN',
            rule_old_pin_required: '请输入旧 PIN 码',
            rule_pin_length: 'PIN 码长度必须大于 6 位',
            rule_new_pin_required: '请输入新 PIN 码',
            rule_pin_diff: '新 PIN 码不能与旧 PIN 码相同',
            rule_confirm_pin_required: '请再次输入新 PIN 码',
            rule_pin_match: '两次输入的新 PIN 码不一致'
        },
        btn: {
            confirm_update: '确认修改'
        }
    },
    bleScanDialog: {
        title: {
            connecting: '连接中',
            scanning: '搜索中',
            select_device: '选择设备'
        },
        status: {
            scanning: '正在搜索附近设备...',
            connecting: '正在连接 {device}', // With parameter
            keep_near: '请保持设备在附近',
            no_device_found: '未发现设备，请确保设备已开机',
            unknown_device: '未知设备'
        },
        action: {
            rescan: '重新扫描',
            connect_success: '连接成功',
            connect_failed: '连接失败'
        },
        error: {
            enable_bluetooth: '请先打开手机蓝牙',
            scan_error: '扫描出错: {error}'
        }
    },
    secureKeyboard: {
        secure_input: '安全输入'
    },
    addAccount: {
        title: '添加帐户',
        placeholder_search: '搜索币种名称或协议...',
        no_coin_found: '未找到相关币种'
    },
    confirm: {
        cancel: '取消',
        ok: '确定'
    },
    docs: {
        load_failed: '加载失败',
        network_error: '网络发生故障，请稍候再试~'
    },
    settingsDialog: {
        title: '节点设置',
        input: {
            label: 'API 节点地址',
            hint: '例如: https://api.airlock.io',
            rule_required: '请输入 API 地址',
            rule_https: '为了您的资金安全，必须以 https:// 开头'
        },
        banner: {
            title: '关于默认公共节点：',
            desc_1: '此节点由开发者自费维护，仅旨在方便新用户体验。',
            desc_2_prefix: '受限于',
            desc_2_highlight: '免费 RPC 服务的严格配额',
            desc_2_suffix: '，在高频访问时极易触发速率限制（Rate Limit），导致连接超时。',
            recommend_title: '为了您的<strong>交易隐私</strong>与<strong>极致速度</strong>，强烈建议：',
            setup: '搭建',
            private_node: 'AirLock 私有节点',
            free_opensource: '(完全免费/开源)'
        },
        btn: {
            save_test: '保存并测试连接'
        },
        msg: {
            restored: '已恢复默认官方节点',
            https_only_error: '为了您的资金安全，仅允许使用加密连接 (HTTPS)。禁止使用不安全的 HTTP 节点。',
            invalid_format: '无效的地址格式，必须以 https:// 开头',
            success: '安全连接成功！设置已保存',
            conn_failed_title: '连接失败',
            conn_failed_confirm: '节点连接失败！请确认您已经部署了私有节点并已经配置成功，是否仍然强制保存？',
            force_saved: '设置已强制保存'
        }
    },
    receiveDialog: {
        title: '收款 {asset}',
        warning_html: '仅支持接收 <strong class="text-black text-capitalize">{chain}</strong> 链上的资产',
        address_hint: '钱包地址 (点击复制)',
        btn_share: '分享地址',
        msg: {
            copied: '地址已复制',
            copy_failed: '复制失败',
            clipboard_not_ready: '剪贴板服务不可用',
            share_text: '我的 {symbol} ({chain}) 钱包地址是: {address}',
            share_title: '收款地址'
        }
    },
    transaction: {
        title: {
            send: '发送 {symbol}',
            confirm: '确认交易'
        },
        banner: {
            only_support: '仅支持发送 <strong>{chain}</strong> 链上的资产',
            balance_warning: '注意: 当前余额不足以支付完整 Gas，系统将自动扣除部分转账金额，实际到账将略低于 {amount}',
            sign_warning: '请在 <strong>Airlock</strong> 中对交易进行确认'
        },
        input: {
            to_label: '接收地址',
            amount_label: '转账金额',
            memo_optional: '{name} (选填)',
            password_label: '支付密码',
            rule_address_invalid: '地址格式无效',
            rule_amount_invalid: '转帐金额无效',
            rule_password_required: '请输入支付密码'
        },
        label: {
            max: '最大',
            available_balance: '可用余额:',
            amount: '金额',
            receiver: '接收方',
            gas_fee: '矿工费 (Gas)',
            calculating: '计算中...',
            energy: '能量 (Energy)',
            bandwidth: '带宽 (Bandwidth)',
            fetching: '获取中...'
        },
        btn: {
            next: '下一步',
            confirm_send: '确认并发送'
        },
        msg: {
            strategy_init_failed: '初始化失败: {error}',
            network_data_failed: '网络数据同步失败',
            strategy_not_init: '策略未初始化',
            network_not_synced: '网络数据未同步，请重试',
            sign_failed: '签名失败',
            tx_broadcasted: '交易已广播',
            address_recognized: '地址已识别',
            scanner_plugin_missing: '扫码插件未加载',
            scan_error: '扫描出错: {error}',
            camera_error: '无法访问相册 (需真机)',
            image_error: '获取图片失败: {error}',
            qr_invalid: '未发现有效的二维码',
            image_load_failed: '图片加载失败',
            refresh_failed: '刷新失败'
        }
    },

}