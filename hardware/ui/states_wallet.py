# Copyright (C) 2026 Le Wang
#
# This file is part of Airlock.
#
# Airlock is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# Airlock is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with Airlock.  If not, see <https://www.gnu.org/licenses/>.

import time
import pygame
import re
import gc
import config
from .base_state import State
from .states_menu import MenuState
from .components import ScrollableTextState, InputState
from core.utils import Utils

# --- Localized Strings for Wallet Operations ---
WALLET_STRINGS = {
    "en": {
        # ReviewListState
        "review_list_items": "Item {}",
        # WordCountSelectorState
        "word_count_option": "{} words",
        # CreateWalletState - General
        "warning_title": "Warning",
        "warning_overwrite": ["Existing wallet found.", "Continuing will overwrite it.", "Ensure backup exists!", "[Enter] Continue", "[Esc] Cancel"],
        "error_retry": "[Enter] Retry",
        # Create - Step 1 (Passphrase)
        "step1_intro": ["Step 1/2: Set 25th Phrase", "* Extra protection layer, do not share", "* Write it down physically", "* Must contain upper, lower, digit, special", f"* Min length {config.PASSPHRASE_RULES.min_len}", "* If lost, assets are lost forever!", "[Enter] Start Input"],
        "step1_input_prompt": "1/2 Input 25th Phrase",
        "step2_verify_prompt": "Input again to verify",
        "mismatch_error": ["Inputs do not match", "Please re-enter"],
        # Create - Step 2 (Password)
        "step3_intro": ["Step 2/2: Set Payment Password", "* Used for transaction signing, do not share", "* Recommend writing it down", "* Must contain upper, lower, digit, special", f"* Min length {config.PASSWORD_RULES.min_len}", "[Enter] Start Input"],
        "step3_input_prompt": "2/2 Set Payment Pwd",
        "step4_verify_prompt": "Input again to verify",
        "same_as_passphrase_error": ["Cannot be same as 25th phrase", "Please re-enter"],
        # Create - Processing
        "creating_wallet": "Creating Wallet",
        "time_estimate": "Approx. 90 seconds",
        "please_wait": "Please wait...",
        "creation_error": ["Error generating wallet", "Please restart creation"],
        # Create - Backup
        "backup_intro": ['Wallet Created!', 'Prepare paper & pen to write down seed', 'Strongly suggest separating seed & 25th phrase', '', '[Enter] Start Backup'],
        "mnemonic_item": "{:02d}. {}",
        "start_verify_btn": "[Enter] Verify Now",
        # Create - Verify
        "verify_word_prompt": "Verify Word {}/{}",
        "verify_word_error": "Mnemonic Error",
        "verify_passphrase_prompt": "Verify 25th Phrase",
        "verify_passphrase_error": "25th Phrase Error",
        "verify_password_prompt": "Verify Payment Pwd",
        "verify_password_error": "Password Error",
        "verify_fail_detail": ["Your input: {}", "Verification Failed", "Correct: {}", "[Enter] Retry"],
        # Create - Success
        "success_msg": ["Congratulations!", "Cold wallet created & verified", "Keep seed and passphrase safe", "Separate storage recommended. Remember password.", "[Enter] Back to Menu"],
        # Validation Errors
        "err_len": "Length must be at least {}",
        "err_upper": "Must contain uppercase",
        "err_lower": "Must contain lowercase",
        "err_digit": "Must contain digit",
        "err_special": "Must contain special char",
        # ImportWalletState
        "import_warning": ["Existing wallet found.", "Importing will overwrite it.", "Confirm risk!", "[Enter] Continue", "[Esc] Cancel"],
        "import_step2_intro": ["Step 1/3", "* Used for transaction signing, do not share", "* Recommend writing it down", "* Must contain upper, lower, digit, special", f"* Min length {config.PASSWORD_RULES.min_len}", "[Enter] Start Input"],
        "import_pwd_prompt": "Set Payment Password",
        "import_pwd_verify": "Verify Password",
        "import_step3_intro": ["Step 2/3", "Input Mnemonic", "About to input {} words", "Ensure correct spelling", "[Enter] Start Input"],
        "import_word_prompt": "Input Word {}/{}",
        "word_empty_error": ["Word cannot be empty"],
        "import_step4_intro": ["Step 3/3", "Input 25th Phrase", "* Leave empty if none", "[Enter] Continue"],
        "import_passphrase_prompt": "25th Phrase (Optional)",
        "verifying": "Verifying...",
        "import_success": ["Import Success!", "Wallet recovered", "Remember your password", "[Enter] Back to Menu"],
        "import_fail": ["Import Failed", "Invalid mnemonic checksum or spelling error", "[Enter] Restart"]
    },
    "zh": {
        # ReviewListState
        "review_list_items": "项目 {}",
        # WordCountSelectorState
        "word_count_option": "{} 个单词",
        # CreateWalletState - General
        "warning_title": "警告",
        "warning_overwrite": ["检测到已有钱包文件，如果继续将会永久覆盖", "请确认已备份!", "[Enter] 继续", "[Esc] 取消"],
        "error_retry": "[Enter] 重试",
        # Create - Step 1 (Passphrase)
        "step1_intro": ["步骤1/2 设置第25短语", "* 这是助记词的额外保护层，切勿泄露", "* 务必将短语抄写保存", "* 必须包含英文大小写,数字,特殊字符", f"* 长度至少{config.PASSPHRASE_RULES.min_len}位", "* 如果遗忘，资产将无法找回!", "[Enter] 开始输入"],
        "step1_input_prompt": "1/2 输入第25短语",
        "step2_verify_prompt": "再次输入以验证",
        "mismatch_error": ["两次输入不一致", "请重新输入"],
        # Create - Step 2 (Password)
        "step3_intro": ["步骤2/2 设置支付密码", "* 支付时的交易签名凭证，切勿泄露", "* 建议将密码抄写保存", "* 必须包含英文大小写,数字,特殊字符", f"* 长度至少{config.PASSWORD_RULES.min_len}位", "[Enter] 开始输入"],
        "step3_input_prompt": "2/2 设置支付密码",
        "step4_verify_prompt": "再次输入以验证",
        "same_as_passphrase_error": ["不能与第25短语相同", "请重新输入"],
        # Create - Processing
        "creating_wallet": "正在创建钱包",
        "time_estimate": "预计耗时90秒",
        "please_wait": "请稍候...",
        "creation_error": ["生成钱包发生错误", "请重新开始创建"],
        # Create - Backup
        "backup_intro": ['钱包创建成功！', '请准备好纸、笔开始抄写助记词', '强烈建议将第25词与助记词分开保存', '', '[Enter] 开始抄写'],
        "mnemonic_item": "{:02d}. {}",
        "start_verify_btn": "[Enter] 开始验证",
        # Create - Verify
        "verify_word_prompt": "验证第 {}/{} 词",
        "verify_word_error": "助记词错误",
        "verify_passphrase_prompt": "验证第25词(Passphrase)",
        "verify_passphrase_error": "第25词错误",
        "verify_password_prompt": "验证支付密码",
        "verify_password_error": "支付密码错误",
        "verify_fail_detail": ["你的输入: {}", "验证失败", "正确: {}", "[Enter] 重新输入"],
        # Create - Success
        "success_msg": ["恭喜您!", "冷钱包创建并验证成功", "请妥善保管您的助记词和第25短语", "强烈建议将助记词与第25短语分开存放，另外请牢记支付密码", "[Enter] 返回主菜单"],
        # Validation Errors
        "err_len": "长度必须至少为 {} 位",
        "err_upper": "必须包含大写字母",
        "err_lower": "必须包含小写字母",
        "err_digit": "必须包含数字",
        "err_special": "必须包含特殊字符",
        # ImportWalletState
        "import_warning": ["检测到已有钱包，导入将会覆盖原文件", "请确认风险!", "[Enter] 继续", "[Esc] 取消"],
        "import_step2_intro": ["步骤 1/3", "* 支付时的交易签名凭证，切勿泄露", "* 建议将密码抄写保存", "* 必须包含英文大小写,数字,特殊字符", f"* 长度至少{config.PASSWORD_RULES.min_len}位", "[Enter] 开始输入"],
        "import_pwd_prompt": "设置支付密码",
        "import_pwd_verify": "再次输入验证",
        "import_step3_intro": ["步骤 2/3", "输入助记词", "即将输入 {} 个单词", "请确保拼写正确", "[Enter] 开始输入"],
        "import_word_prompt": "输入第 {}/{} 词",
        "word_empty_error": ["单词不能为空"],
        "import_step4_intro": ["步骤 3/3", "输入第25短语", "* 如果没有请留空", "[Enter] 继续"],
        "import_passphrase_prompt": "第25词(没有请留空)",
        "verifying": "正在验证...",
        "import_success": ["导入成功!", "钱包已恢复", "请牢记您的支付密码", "[Enter] 返回菜单"],
        "import_fail": ["导入失败", "助记词校验无效或单词拼写错误", "[Enter] 重新开始"]
    }
}


class ReviewListState(State):
    def __init__(self, ctx, items, callback):
        super().__init__(ctx)
        self.items = items
        self.callback = callback
        self.idx = 0
        self.visible_rows = 4
        self.lang = Utils.get_system_language()

    def on_keydown(self, event):
        if event.key == pygame.K_UP:
            if self.idx > 0: self.idx -= 1
        elif event.key == pygame.K_DOWN:
            if self.idx < len(self.items) - 1: self.idx += 1
        elif event.key in [pygame.K_RETURN, pygame.K_KP_ENTER]:
            if self.idx == len(self.items) - 1:
                self.callback()

    def draw(self):
        self.fill_screen()
        start_idx = 0
        if self.idx >= self.visible_rows:
            start_idx = self.idx - (self.visible_rows - 1)

        for i in range(self.visible_rows):
            item_index = start_idx + i
            if item_index >= len(self.items): break
            y = i * config.LINE_HEIGHT
            text = self.items[item_index]
            if item_index == self.idx:
                self.draw_rect(0, y, self.hw.width, config.LINE_HEIGHT, color=(255, 255, 255))
                self.draw_text(text, 2, y, color=(0, 0, 0))
            else:
                self.draw_text(text, 2, y, color=(255, 255, 255))


class WordCountSelectorState(State):
    def __init__(self, ctx, callback):
        super().__init__(ctx)
        self.callback = callback
        self.options = [12, 15, 18, 21, 24]
        self.lang = Utils.get_system_language()
        self.items = [self._t("word_count_option").format(n) for n in self.options]
        self.idx = 0
        self.visible_rows = 4

    def _t(self, key):
        return WALLET_STRINGS[self.lang].get(key, WALLET_STRINGS["en"][key])

    def on_keydown(self, event):
        if event.key == pygame.K_UP:
            self.idx = (self.idx - 1) % len(self.items)
        elif event.key == pygame.K_DOWN:
            self.idx = (self.idx + 1) % len(self.items)
        elif event.key in [pygame.K_RETURN, pygame.K_KP_ENTER]:
            self.callback(self.options[self.idx])
        elif event.key == pygame.K_ESCAPE:
            self.ctx.change_state(MenuState(self.ctx))

    def draw(self):
        self.fill_screen()
        start_idx = 0
        if self.idx >= self.visible_rows:
            start_idx = self.idx - (self.visible_rows - 1)
        for i in range(self.visible_rows):
            item_index = start_idx + i
            if item_index >= len(self.items): break
            y = i * config.LINE_HEIGHT
            text = self.items[item_index]
            if item_index == self.idx:
                self.draw_rect(0, y, self.hw.width, config.LINE_HEIGHT, color=(255, 255, 255))
                self.draw_text(text, 2, y, color=(0, 0, 0))
            else:
                self.draw_text(text, 2, y, color=(255, 255, 255))


# ==========================
# Create Wallet Workflow
# ==========================
class CreateWalletState(State):
    def __init__(self, ctx):
        super().__init__(ctx)
        self.temp_passphrase = None
        self.temp_password = None
        self.temp_mnemonic = None
        self.lang = Utils.get_system_language()

    def _t(self, key):
        return WALLET_STRINGS[self.lang].get(key, WALLET_STRINGS["en"][key])

    def validate_input(self, input_str: str, rules) -> list[str]:
        errors = []
        if len(input_str) < rules.min_len:
            errors.append(self._t("err_len").format(rules.min_len))
        if rules.require_upper and not re.search(r'[A-Z]', input_str):
            errors.append(self._t("err_upper"))
        if rules.require_lower and not re.search(r'[a-z]', input_str):
            errors.append(self._t("err_lower"))
        if rules.require_digit and not re.search(r'[0-9]', input_str):
            errors.append(self._t("err_digit"))
        if rules.require_special and not re.search(r'[^A-Za-z0-9]', input_str):
            errors.append(self._t("err_special"))
        return errors

    def on_enter(self):
        if self.ctx.svc.wallet_exists():
            lines = self._t("warning_overwrite")
            handlers = {pygame.K_RETURN: self._step1_show_intro, pygame.K_KP_ENTER: self._step1_show_intro,
                        pygame.K_ESCAPE: lambda: self.ctx.change_state(MenuState(self.ctx))}
            self.ctx.change_state(ScrollableTextState(ctx=self.ctx, lines=lines, title=self._t("warning_title"), key_handlers=handlers))
        else:
            self._step1_show_intro()

    def _step1_show_intro(self):
        lines = self._t("step1_intro")
        handlers = {pygame.K_RETURN: self._step1_input, pygame.K_KP_ENTER: self._step1_input,
                    pygame.K_ESCAPE: lambda: self.ctx.change_state(MenuState(self.ctx))}
        self.ctx.change_state(ScrollableTextState(self.ctx, lines, key_handlers=handlers))

    def _step1_input(self):
        self.ctx.change_state(InputState(self.ctx, self._t("step1_input_prompt"), callback=self._step2_verify_input, is_pwd=False))

    def _step2_verify_input(self, text):
        validate_result = self.validate_input(text, config.PASSPHRASE_RULES)
        if len(validate_result) > 0:
            self._show_error(validate_result, self._step1_input)
            return
        self.temp_passphrase = text
        self.ctx.change_state(InputState(self.ctx, self._t("step2_verify_prompt"), callback=self._step2_check_match, is_pwd=False))

    def _step2_check_match(self, text):
        if text != self.temp_passphrase:
            self._show_error(self._t("mismatch_error"), self._step1_input)
        else:
            self._step3_show_intro()

    def _step3_show_intro(self):
        lines = self._t("step3_intro")
        handlers = {pygame.K_RETURN: self._step3_input, pygame.K_KP_ENTER: self._step3_input,
                    pygame.K_ESCAPE: self._step1_show_intro}
        self.ctx.change_state(ScrollableTextState(self.ctx, lines, key_handlers=handlers))

    def _step3_input(self):
        self.ctx.change_state(InputState(self.ctx, self._t("step3_input_prompt"), callback=self._step4_verify_input, is_pwd=False))

    def _step4_verify_input(self, text):
        validate_result = self.validate_input(text, config.PASSWORD_RULES)
        if len(validate_result) > 0:
            self._show_error(validate_result, self._step3_input)
            return
        self.temp_password = text
        self.ctx.change_state(InputState(self.ctx, self._t("step4_verify_prompt"), callback=self._step4_check_match, is_pwd=False))

    def _step4_check_match(self, text):
        if text != self.temp_password:
            self._show_error(self._t("mismatch_error"), self._step3_input)
        elif self.temp_passphrase == self.temp_password:
            self._show_error(self._t("same_as_passphrase_error"), self._step3_input)
        else:
            self._start_generation()

    def _start_generation(self):
        self.fill_screen()
        self.draw_text(self._t("creating_wallet"), 0, 8, center=True)
        self.draw_text(self._t("time_estimate"), 0, 22, center=True)
        self.draw_text(self._t("please_wait"), 0, 36, center=True)
        self.ctx.hw.render()
        mnemonic = self.ctx.svc.generate_mnemonic(passphrase=self.temp_passphrase, password=self.temp_password)
        if isinstance(mnemonic, list) and len(mnemonic) == config.MNEMONIC_LEN:
            self.temp_mnemonic = mnemonic
            self._show_backup_instruction()
        else:
            self._show_error(self._t("creation_error"), self._step1_show_intro)

    def _show_backup_instruction(self):
        lines = self._t("backup_intro")
        handlers = {pygame.K_RETURN: self._show_mnemonic_list, pygame.K_KP_ENTER: self._show_mnemonic_list}
        self.ctx.change_state(ScrollableTextState(self.ctx, lines, key_handlers=handlers))

    def _show_mnemonic_list(self):
        items = []
        for i, word in enumerate(self.temp_mnemonic):
            items.append(self._t("mnemonic_item").format(i + 1, word))
        items.append(self._t("start_verify_btn"))
        self.ctx.change_state(ReviewListState(self.ctx, items, callback=lambda: self._start_verify_loop(0)))

    def _start_verify_loop(self, index):
        if index >= config.MNEMONIC_LEN:
            self._verify_passphrase_final()
            return
        target_word = self.temp_mnemonic[index]
        prompt = self._t("verify_word_prompt").format(index + 1, config.MNEMONIC_LEN)

        def on_input(text):
            if text.strip().lower() == target_word.lower():
                self._start_verify_loop(index + 1)
                return None
            else:
                self._handle_verify_error(self._t("verify_word_error"), text, target_word, lambda: self._start_verify_loop(index))
                return None

        self.ctx.change_state(InputState(self.ctx, prompt, callback=on_input))

    def _verify_passphrase_final(self):
        target = self.temp_passphrase

        def on_input(text):
            if text == target:
                self._verify_password_final()
                return None
            else:
                self._handle_verify_error(self._t("verify_passphrase_error"), text, target, self._verify_passphrase_final)
                return None

        self.ctx.change_state(InputState(self.ctx, self._t("verify_passphrase_prompt"), callback=on_input))

    def _verify_password_final(self):
        target = self.temp_password

        def on_input(text):
            if text == target:
                self._finish_creation()
                return None
            else:
                self._handle_verify_error(self._t("verify_password_error"), text, target, self._verify_password_final)
                return None

        self.ctx.change_state(InputState(self.ctx, self._t("verify_password_prompt"), callback=on_input, is_pwd=False))

    def _handle_verify_error(self, title, user_input, correct, retry_cb):
        base_msg = self._t("verify_fail_detail")
        lines = [base_msg[0].format(user_input), base_msg[1], base_msg[2].format(correct), base_msg[3]]
        handlers = {pygame.K_RETURN: retry_cb, pygame.K_KP_ENTER: retry_cb}
        self.ctx.change_state(ScrollableTextState(self.ctx, lines, title=title, key_handlers=handlers))

    def _finish_creation(self):
        lines = self._t("success_msg")
        self.temp_mnemonic = None
        self.temp_passphrase = None
        self.temp_password = None
        gc.collect()
        handlers = {pygame.K_RETURN: lambda: self.ctx.change_state(MenuState(self.ctx)),
                    pygame.K_KP_ENTER: lambda: self.ctx.change_state(MenuState(self.ctx))}
        self.ctx.change_state(ScrollableTextState(self.ctx, lines, key_handlers=handlers))

    def _show_error(self, msg: list[str], retry_callback):
        handlers = {pygame.K_RETURN: retry_callback, pygame.K_KP_ENTER: retry_callback}
        msg_copy = msg.copy()
        msg_copy.append(self._t("error_retry"))
        self.ctx.change_state(ScrollableTextState(self.ctx, msg_copy, key_handlers=handlers))


# ==========================
# Import Wallet Workflow
# ==========================
class ImportWalletState(State):
    def __init__(self, ctx):
        super().__init__(ctx)
        self.word_count = 12
        self.imported_words = []
        self.temp_passphrase = ""
        self.temp_password = ""
        self.lang = Utils.get_system_language()

    def _t(self, key):
        return WALLET_STRINGS[self.lang].get(key, WALLET_STRINGS["en"][key])

    def on_enter(self):
        if self.ctx.svc.wallet_exists():
            lines = self._t("import_warning")
            handlers = {pygame.K_RETURN: self._step1_select_count, pygame.K_KP_ENTER: self._step1_select_count,
                        pygame.K_ESCAPE: lambda: self.ctx.change_state(MenuState(self.ctx))}
            self.ctx.change_state(ScrollableTextState(self.ctx, lines, title=self._t("warning_title"), key_handlers=handlers))
        else:
            self._step1_select_count()

    def _step1_select_count(self):
        self.ctx.change_state(WordCountSelectorState(self.ctx, callback=self._on_count_selected))

    def _on_count_selected(self, count):
        self.word_count = count
        self._step2_password_intro()

    def _step2_password_intro(self):
        lines = self._t("import_step2_intro")
        handlers = {pygame.K_RETURN: self._step2_password_input, pygame.K_KP_ENTER: self._step2_password_input}
        self.ctx.change_state(ScrollableTextState(self.ctx, lines, key_handlers=handlers))

    def _step2_password_input(self):
        self.ctx.change_state(InputState(self.ctx, self._t("import_pwd_prompt"), callback=self._step2_password_verify, is_pwd=False))

    # Note: Import flow reuses logic from CreateWalletState, but helper function defined locally
    # For brevity, duplicated validate_input logic, ideally extract to core/utils.py
    def _validate_rules(self, input_str, rules):
        errors = []
        if len(input_str) < rules.min_len: errors.append(self._t("err_len").format(rules.min_len))
        if rules.require_upper and not re.search(r'[A-Z]', input_str): errors.append(self._t("err_upper"))
        if rules.require_lower and not re.search(r'[a-z]', input_str): errors.append(self._t("err_lower"))
        if rules.require_digit and not re.search(r'[0-9]', input_str): errors.append(self._t("err_digit"))
        return errors

    def _step2_password_verify(self, text):
        errors = self._validate_rules(text, config.PASSWORD_RULES)
        if errors:
            self._show_error(errors, self._step2_password_input)
            return
        self.temp_password = text
        self.ctx.change_state(InputState(self.ctx, self._t("import_pwd_verify"), callback=self._step2_password_check_match, is_pwd=False))

    def _step2_password_check_match(self, text):
        if text != self.temp_password:
            self._show_error(self._t("mismatch_error"), self._step2_password_input)
        else:
            self._step3_mnemonic_intro()

    def _step3_mnemonic_intro(self):
        lines = [self._t("import_step3_intro")[0], self._t("import_step3_intro")[1],
                 self._t("import_step3_intro")[2].format(self.word_count),
                 self._t("import_step3_intro")[3], self._t("import_step3_intro")[4]]
        handlers = {pygame.K_RETURN: lambda: self._start_input_loop(0),
                    pygame.K_KP_ENTER: lambda: self._start_input_loop(0)}
        self.ctx.change_state(ScrollableTextState(self.ctx, lines, key_handlers=handlers))

    def _start_input_loop(self, index):
        if index >= self.word_count:
            self._step4_passphrase_intro()
            return
        prompt = self._t("import_word_prompt").format(index + 1, self.word_count)

        def on_input(text):
            word = text.strip().lower()
            if not word:
                self._show_error(self._t("word_empty_error"), lambda: self._start_input_loop(index))
                return None
            if len(self.imported_words) > index:
                self.imported_words[index] = word
            else:
                self.imported_words.append(word)
            self._start_input_loop(index + 1)
            return None

        self.ctx.change_state(InputState(self.ctx, prompt, callback=on_input))

    def _step4_passphrase_intro(self):
        lines = self._t("import_step4_intro")
        handlers = {pygame.K_RETURN: self._step4_passphrase_input, pygame.K_KP_ENTER: self._step4_passphrase_input}
        self.ctx.change_state(ScrollableTextState(self.ctx, lines, key_handlers=handlers))

    def _step4_passphrase_input(self):
        self.ctx.change_state(InputState(self.ctx, self._t("import_passphrase_prompt"), callback=self._step5_finalize, is_pwd=False))

    def _step5_finalize(self, text):
        self.temp_passphrase = text
        self.fill_screen()
        self.draw_text(self._t("verifying"), 0, 20, center=True)
        self.ctx.hw.render()

        success = self.ctx.svc.import_wallet(mnemonic_list=self.imported_words, passphrase=self.temp_passphrase, password=self.temp_password)

        if success:
            self.imported_words = []
            self.temp_passphrase = None
            self.temp_password = None
            gc.collect()

            lines = self._t("import_success")
            handlers = {pygame.K_RETURN: lambda: self.ctx.change_state(MenuState(self.ctx)),
                        pygame.K_KP_ENTER: lambda: self.ctx.change_state(MenuState(self.ctx))}
            self.ctx.change_state(ScrollableTextState(self.ctx, lines, key_handlers=handlers))
        else:
            # 1. Mnemonic list: Clear it because user needs to re-enter
            self.imported_words = []

            # 2. Passphrase: Can be cleared because Step 4 will ask again
            self.temp_passphrase = None

            # 3. Payment Password (temp_password): [DO NOT CLEAR]
            # Retry flow starts from Step 3, won't ask for password again

            lines = self._t("import_fail")
            handlers = {pygame.K_RETURN: self._step3_mnemonic_intro, pygame.K_KP_ENTER: self._step3_mnemonic_intro}
            self.ctx.change_state(ScrollableTextState(self.ctx, lines, key_handlers=handlers))

    def _show_error(self, msg: list[str], retry_callback):
        handlers = {pygame.K_RETURN: retry_callback, pygame.K_KP_ENTER: retry_callback}
        msg_copy = msg.copy()
        msg_copy.append(self._t("error_retry"))
        self.ctx.change_state(ScrollableTextState(self.ctx, msg_copy, key_handlers=handlers))