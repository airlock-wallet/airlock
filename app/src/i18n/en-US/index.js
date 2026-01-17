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
            all_chains: 'All Chains',
            summary_balance: 'Balance>={amount}',
            label: 'Filter',
            summary_prefix: 'All Assets',
            network: 'Network',
            balance: 'Balance Filter',
            balance_placeholder: 'Min Balance',
            fuzzy: 'Fuzzy Search',
            fuzzy_placeholder: 'Token Name, Symbol or Address',
            reset: 'Reset All',
            apply: 'Apply',
            title: 'Filter Assets'
        },
        list: {
            empty: 'No assets found',
            end: 'No more data'
        },
        msg: {
            added: 'Successfully added {count} assets',
            derive_failed: 'Derivation failed: {error}',
            limit_exceeded: 'Limit exceeded',
            error_retry: 'Error occurred, please try again later'
        }
    },
    setupPage: {
        title_wizard: 'Security Setup Wizard',
        subtitle_wizard: 'Please follow steps to set up dual security PINs',
        step1: {
            title: 'Standard PIN',
            subtitle: 'Set Standard Wallet Password',
            desc_html: 'This PIN unlocks your <strong>Default Wallet (24 words)</strong>',
            label_pin: 'Enter Standard PIN (6-32 digits)',
            btn_next: 'Next'
        },
        step2: {
            title: 'Confirm',
            subtitle: 'Please confirm again',
            label_confirm: 'Re-enter Standard PIN',
            btn_confirm: 'Confirm',
            btn_back: 'Back to Edit'
        },
        step3: {
            title: 'Hidden PIN',
            subtitle: 'Set Advanced Hidden Password',
            desc_html: 'This PIN unlocks your <strong>Hidden Wallet (25th word)</strong>',
            label_hidden_pin: 'Enter Hidden PIN (6-32 digits)'
        },
        step4: {
            title: 'Finish',
            subtitle: 'Final confirm hidden password',
            label_confirm_hidden: 'Re-enter Hidden PIN',
            btn_finish: 'Finish'
        },
        error: {
            pin_min_length: 'PIN must be at least 6 digits',
            pin_mismatch: 'PINs do not match',
            pin_same: 'Hidden PIN cannot be same as Standard PIN!'
        },
        msg: {
            setup_success: 'Security setup successful',
            setup_failed: 'Security setup failed'
        }
    },
    mePage: {
        title_app: 'AIRLOCK',
        subtitle: 'Open Source Secure Cold Wallet based on Raspberry Pi Zero 2 W',
        list: {
            node_setting: 'Node Settings',
            node_caption: 'Configure API connection address',
            app_lock: 'App Lock',
            lock_caption: 'Change App launch password',
            security_practice: 'Security Practices',
            security_caption: 'Guide to air-gapped isolation and offline signing',
            project_docs: 'Documentation',
            docs_caption: 'Understand Airlock security mechanism',
            source_code: 'Source Code',
            source_caption: 'View App and Raspberry Pi firmware source code',
            privacy: 'Privacy Policy',
            privacy_caption: 'No private key upload, local storage only',
            terms: 'Terms of Service',
            terms_caption: 'Open source license and risk disclaimer',
            system_update: 'System Update',
            update_caption: 'Current version v{version}',
            feedback: 'Feedback',
            feedback_caption: 'Report bugs or join community discussion'
        },
        update: {
            new_version: 'New Version Found',
            new_version_caption: 'A newer version is available, please update from official site',
            btn_visit: 'Visit Site',
            btn_close: 'Close',
            latest_title: 'Up to date',
            latest_caption: 'Software is up to date, no update needed'
        },
        msg: {
            pin_updated: 'PIN updated successfully'
        }
    },
    loginPage: {
        title_app: 'AirLock',
        welcome: 'Welcome back, please unlock wallet',
        input_label: 'Enter PIN',
        btn_unlock: 'Unlock Now',
        error: {
            pin_too_short: 'PIN too short',
            pin_incorrect: 'Incorrect PIN',
            verify_error: 'Verification error: {error}',
            db_critical: 'Critical Error: Database unreadable, app exiting. Please reinstall.'
        }
    },
    loadWalletPage: {
        title: 'Initialize Wallet',
        description_html: 'No wallet data detected<br>Please connect hardware device to sync accounts',
        btn_connect: 'Connect & Sync Wallet',
        status: {
            ready: 'Preparing sync...',
            connecting: 'Connecting to device...',
            parsing: 'Parsing data...',
            detail_confirm: 'Please confirm on hardware device',
            saving: 'Saving data',
            saving_detail: 'Please wait...'
        },
        msg: {
            empty_response: 'Device returned empty account list',
            sync_failed: 'Sync failed',
            unknown_error: 'Unknown error'
        }
    },
    devicePage: {
        title: 'Device Info',
        menu: {
            refresh: 'Refresh Device',
            reboot: 'Reboot Device',
            shutdown: 'Shutdown Safely'
        },
        label: {
            device_name: 'Device Name',
            firmware_version: 'Firmware Version',
            platform: 'Platform',
            hardware: 'Hardware',
            display: 'Display',
            cpu_temp: 'CPU Temp'
        },
        no_device_connected: 'No device connected, please connect first!',
        dialog: {
            reboot_title: 'Reboot Device',
            reboot_msg: 'Reboot may take 30 seconds, are you sure?',
            shutdown_title: 'Shutdown Safely',
            shutdown_msg: 'Are you sure you want to shut down safely?'
        },
        msg: {
            refresh_success: 'Device refreshed successfully',
            get_info_failed: 'Failed to get device info, check connection',
            unknown_error: 'Unknown error',
            reboot_sent: 'Reboot command sent',
            reboot_failed: 'Failed to send reboot command, check connection',
            shutdown_sent: 'Shutdown command sent',
            shutdown_failed: 'Failed to send shutdown command, check connection'
        }
    },
    assetDetailPage: {
        title_history: 'Transaction History',
        no_history: 'No transaction history',
        btn_receive: 'Receive',
        btn_send: 'Send',
        tx_type_send: 'Sent',
        tx_type_receive: 'Received',
        msg: {
            asset_not_found: 'Asset not found',
            copied: 'Address copied',
            copy_failed: 'Copy failed',
            clipboard_unavailable: 'Clipboard unavailable'
        }
    },
    accountPage: {
        total_assets: 'Total Asset Value (USD)',
        search_placeholder: 'Search account name or coin...',
        account_list: 'Account List',
        no_account_match: 'No matching accounts found',
        msg: {
            account_added: 'Account added successfully',
            add_failed: 'Failed to add account, please retry',
            empty_response: 'Empty account list returned from device'
        }
    },
    menu: {
        accounts: 'Accounts',
        device: 'Device',
        me: 'Me'
    },
    updatePassword: {
        title: 'Update PIN',
        input: {
            old_pin_hint: 'Enter current PIN',
            old_pin_label: 'Old PIN',
            new_pin_hint: 'Enter new PIN',
            new_pin_label: 'New PIN',
            confirm_pin_hint: 'Enter new PIN again',
            confirm_pin_label: 'Repeat PIN',
            rule_old_pin_required: 'Please enter old PIN',
            rule_pin_length: 'PIN must be at least 6 digits',
            rule_new_pin_required: 'Please enter new PIN',
            rule_pin_diff: 'New PIN cannot be the same as old PIN',
            rule_confirm_pin_required: 'Please repeat new PIN',
            rule_pin_match: 'PINs do not match'
        },
        btn: {
            confirm_update: 'Confirm Update'
        }
    },
    bleScanDialog: {
        title: {
            connecting: 'Connecting',
            scanning: 'Scanning',
            select_device: 'Select Device'
        },
        status: {
            scanning: 'Searching for nearby devices...',
            connecting: 'Connecting to {device}',
            keep_near: 'Please keep the device close',
            no_device_found: 'No devices found, please ensure device is powered on',
            unknown_device: 'Unknown Device'
        },
        action: {
            rescan: 'Rescan',
            connect_success: 'Connected Successfully',
            connect_failed: 'Connection Failed'
        },
        error: {
            enable_bluetooth: 'Please enable Bluetooth first',
            scan_error: 'Scan Error: {error}'
        }
    },
    secureKeyboard: {
        secure_input: 'Secure Input'
    },
    addAccount: {
        title: 'Add Account',
        placeholder_search: 'Search for coin name or protocol...',
        no_coin_found: 'No coins found'
    },
    confirm: {
        cancel: 'Cancel',
        ok: 'OK'
    },
    docs: {
        load_failed: 'Load Failed',
        network_error: 'Network error, please try again later~'
    },
    settingsDialog: {
        title: 'Node Settings',
        input: {
            label: 'API Node Address',
            hint: 'e.g. https://api.airlock.io',
            rule_required: 'Please enter API address',
            rule_https: 'For fund safety, must start with https://'
        },
        banner: {
            title: 'About Default Public Node:',
            desc_1: 'This node is maintained at the developer\'s expense, intended only for new user experience.',
            desc_2_prefix: 'Limited by',
            desc_2_highlight: 'strict quotas of free RPC services',
            desc_2_suffix: ', frequent access may trigger rate limits, causing connection timeouts.',
            recommend_title: 'For your <strong>transaction privacy</strong> and <strong>extreme speed</strong>, we strongly recommend:',
            setup: 'Set up',
            private_node: 'AirLock Private Node',
            free_opensource: '(Free/Open Source)'
        },
        btn: {
            save_test: 'Save & Test Connection'
        },
        msg: {
            restored: 'Default official node restored',
            https_only_error: 'For your fund safety, only encrypted connections (HTTPS) are allowed. Insecure HTTP nodes are prohibited.',
            invalid_format: 'Invalid address format, must start with https://',
            success: 'Secure connection successful! Settings saved',
            conn_failed_title: 'Connection Failed',
            conn_failed_confirm: 'Node connection failed! Please confirm private node deployment and configuration. Force save anyway?',
            force_saved: 'Settings forced saved'
        }
    },
    receiveDialog: {
        title: 'Receive {asset}',
        warning_html: 'Only supports receiving assets on the <strong class="text-black text-capitalize">{chain}</strong> chain',
        address_hint: 'Wallet Address (Click to Copy)',
        btn_share: 'Share Address',
        msg: {
            copied: 'Address copied',
            copy_failed: 'Copy failed',
            clipboard_not_ready: 'Clipboard service unavailable',
            share_text: 'My {symbol} ({chain}) wallet address is: {address}',
            share_title: 'Receive Address'
        }
    },
    transaction: {
        title: {
            send: 'Send {symbol}',
            confirm: 'Confirm Transaction'
        },
        banner: {
            only_support: 'Only supports sending assets on the <strong>{chain}</strong> chain',
            balance_warning: 'Note: Insufficient balance to cover full Gas. The system will deduct part of the transfer amount. Actual amount received will be slightly less than {amount}',
            sign_warning: 'Please confirm the transaction on <strong>Airlock</strong>'
        },
        input: {
            to_label: 'Recipient Address',
            amount_label: 'Amount',
            memo_optional: '{name} (Optional)',
            password_label: 'Payment Password',
            rule_address_invalid: 'Invalid Address Format',
            rule_amount_invalid: 'Invalid Amount',
            rule_password_required: 'Please enter payment password'
        },
        label: {
            max: 'Max',
            available_balance: 'Available:',
            amount: 'Amount',
            receiver: 'Recipient',
            gas_fee: 'Miner Fee (Gas)',
            calculating: 'Calculating...',
            energy: 'Energy',
            bandwidth: 'Bandwidth',
            fetching: 'Fetching...'
        },
        btn: {
            next: 'Next',
            confirm_send: 'Confirm & Send'
        },
        msg: {
            strategy_init_failed: 'Initialization failed: {error}',
            network_data_failed: 'Failed to sync network data',
            strategy_not_init: 'Strategy not initialized',
            network_not_synced: 'Network data not synced, please retry',
            sign_failed: 'Sign failed',
            tx_broadcasted: 'Transaction Broadcasted',
            address_recognized: 'Address Recognized',
            scanner_plugin_missing: 'Scanner plugin not loaded',
            scan_error: 'Scan Error: {error}',
            camera_error: 'Cannot access gallery (Real device required)',
            image_error: 'Failed to get image: {error}',
            qr_invalid: 'No valid QR code found',
            image_load_failed: 'Image load failed',
            refresh_failed: 'Refresh failed'
        }
    },

}