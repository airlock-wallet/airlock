<!--
Copyright (C) 2026 Le Wang

This file is part of Airlock.

Airlock is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Airlock is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Airlock.  If not, see <https://www.gnu.org/licenses/>.
-->

<template>
    <transition name="slide-up" @after-enter="adjustScroll" @after-leave="resetScroll">
        <div
                v-if="modelValue"
                ref="keyboardRef"
                class="secure-keyboard-wrapper safe-pb"
                :class="['fixed-bottom', themeClass]"
                @mousedown.prevent>
            <div class="keyboard-toolbar row justify-end items-center q-px-md q-py-sm">
                <div class="text-caption q-mr-auto row items-center">
                    <q-icon name="lock" size="14px" color="primary" class="q-mr-xs"/>
                    <span :class="isDark ? 'text-grey-5' : 'text-grey-7'">{{ $t('secureKeyboard.secure_input') }}</span>
                </div>
                <q-btn flat dense round icon="keyboard_hide" :color="isDark ? 'white' : 'grey-8'" @click="closeKeyboard"/>
            </div>
            <div class="keyboard-body q-pb-sm q-px-sm">
                <div v-for="(row, rowIndex) in currentKeys" :key="rowIndex" class="keyboard-row row justify-center no-wrap q-mb-sm">
                    <div v-for="(key, keyIndex) in row" :key="keyIndex" class="keyboard-key-container" :class="getKeyWidthClass(key)">
                        <q-btn
                                v-if="isSpecialKey(key)"
                                class="keyboard-btn special-btn full-width full-height shadow-1"
                                :class="getSpecialBtnClass(key)"
                                unelevated no-caps
                                @click="handleKeyPress(key)">
                            <q-icon v-if="key === 'backspace'" name="backspace" size="20px"/>
                            <q-icon v-else-if="key === 'caps'" :name="isUpperCase ? 'file_upload' : 'arrow_upward'" size="20px"/>
                            <q-icon v-else-if="key === 'enter'" name="check" size="20px"/>
                            <span v-else class="text-weight-bold">{{ key }}</span>
                        </q-btn>
                        <q-btn
                                v-else
                                class="keyboard-btn char-btn full-width full-height shadow-1"
                                :class="isDark ? 'btn-char-dark' : 'btn-char-light'"
                                unelevated no-caps
                                @click="handleKeyPress(key)">
                            <span class="text-h6 text-weight-regular">{{ key }}</span>
                        </q-btn>
                    </div>
                </div>
            </div>
        </div>
    </transition>
</template>
<script>
import {defineComponent, ref, computed, nextTick} from 'vue';
import {useQuasar, scroll} from 'quasar';
import { useI18n } from 'vue-i18n'; // Import i18n

const { getScrollTarget, animVerticalScrollTo } = scroll;

const KEYBOARD_LAYOUT = {
    ABC: [
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
        ['caps', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'backspace'],
        ['?123', 'space', 'enter']
    ],
    NUM: [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
        ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
        ['#+=', '.', ',', '?', '!', "'", '_', 'backspace'],
        ['ABC', 'space', 'enter']
    ],
    SYMBOL: [
        ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
        ['_', '\\', '|', '~', '<', '>', '€', '£', '¥', '•'],
        ['123', '.', ',', '?', '!', "'", '"', 'backspace'],
        ['ABC', 'space', 'enter']
    ]
};

export default defineComponent({
    name: 'SecureKeyboard',
    props: {
        modelValue: {type: Boolean, default: false},
        // Receive target element (can be Vue component instance or DOM element)
        target: { type: [Object, Element], default: null }
    },
    emits: ['update:modelValue', 'input', 'delete', 'confirm'],

    setup(props, {emit}) {
        const $q = useQuasar();
        const { t } = useI18n(); // Use t function
        const mode = ref('ABC');
        const isUpperCase = ref(false);
        const keyboardRef = ref(null); // Bind keyboard DOM
        let parentContainer = null;    // Cache scroll container
        let initialPadding = '';       // Cache initial padding

        // Reactively get current theme mode
        const isDark = computed(() => $q.dark.isActive);
        const themeClass = computed(() => isDark.value ? 'kb-dark' : 'kb-light');

        const currentKeys = computed(() => {
            let keys = mode.value === 'ABC' ? KEYBOARD_LAYOUT.ABC : (mode.value === 'NUM' ? KEYBOARD_LAYOUT.NUM : KEYBOARD_LAYOUT.SYMBOL);
            if (mode.value === 'ABC') {
                return keys.map(row => row.map(key => key.length === 1 ? (isUpperCase.value ? key.toUpperCase() : key) : key));
            }
            return keys;
        });

        const isSpecialKey = (key) => ['caps', 'backspace', 'enter', 'space', '?123', 'ABC', '#+=', '123'].includes(key);

        const getKeyWidthClass = (key) => {
            if (key === 'space') return 'col-5';
            if (['enter', '?123', 'ABC', '#+=', '123'].includes(key)) return 'col-2';
            if (['caps', 'backspace'].includes(key)) return 'col-1-5';
            return 'col-1';
        };

        /**
         * Find the first parent element containing class="scroll" in the current DOM hierarchy
         * @param {HTMLElement} el - Current DOM element
         * @returns {HTMLElement|null} - Found parent element, or null if not found
         */
        function findScrollParent(el) {
            // 1. Safety check: if element doesn't exist or has no parent, return null directly
            if (!el || !el.parentElement) return null;

            // 2. Use native closest API to look up
            // Pass in '.scroll' selector, it will find the nearest matching ancestor
            return el.parentElement.closest('.scroll');
        }

        const adjustScroll = () => {
            if (!props.target || !keyboardRef.value) return;

            // 1. Get element
            const targetEl = props.target.$el || props.target;
            if (!targetEl) return;

            // 2. Get parent container (class='scroll')
            parentContainer = findScrollParent(targetEl);
            if (!parentContainer) return;

            // 3. Record current padding for reset
            if (parentContainer !== window && parentContainer.style) {
                initialPadding = parentContainer.style.paddingBottom;
            }

            // Get dimension data
            const viewportHeight = window.innerHeight;
            const kbHeight = keyboardRef.value.offsetHeight;
            const targetRect = targetEl.getBoundingClientRect();

            // Calculate according to formula:
            // A = Distance from target bottom to screen bottom (free space)
            const distanceToBottom = viewportHeight - targetRect.bottom;

            // B = Keyboard height - Free space = Obscured height (Height needing offset)
            const overlapHeight = kbHeight - distanceToBottom;

            // Only handle when obscured (overlapHeight > 0)
            if (overlapHeight > 0) {
                // 1. Add Padding to container first to ensure enough space to scroll up
                // Adding padding here is to physically "expand" the container, otherwise it can't scroll when hitting bottom
                if (parentContainer !== window && parentContainer.style) {
                    parentContainer.style.paddingBottom = `${kbHeight}px`;
                }

                // 2. Execute scroll
                nextTick(() => {
                    const target = getScrollTarget(document.querySelector('.q-page'));
                    animVerticalScrollTo(target, overlapHeight, 200)
                });
            }
        };

        // Reset logic when keyboard closes ---
        const resetScroll = () => {
            if (parentContainer && parentContainer !== window && parentContainer.style) {
                parentContainer.style.paddingBottom = initialPadding;
            }
        };

        // Get style class for special keys (handle Enter highlight)
        const getSpecialBtnClass = (key) => {
            if (key === 'enter') return 'bg-primary text-white'; // Confirm key always uses primary color
            return isDark.value ? 'btn-special-dark' : 'btn-special-light';
        };

        const handleKeyPress = (key) => {
            if (navigator.vibrate) navigator.vibrate(10);
            if (key === '?123') {
                mode.value = 'NUM';
                return;
            }
            if (key === 'ABC') {
                mode.value = 'ABC';
                return;
            }
            if (key === '#+=') {
                mode.value = 'SYMBOL';
                return;
            }
            if (key === '123') {
                mode.value = 'NUM';
                return;
            }
            if (key === 'caps') {
                isUpperCase.value = !isUpperCase.value;
                return;
            }

            let type = 'input';
            let val = key;
            if (key === 'backspace') {
                type = 'delete';
                val = null;
            } else if (key === 'enter') {
                type = 'confirm';
                val = null;
            } else if (key === 'space') val = ' ';

            emit(type, val);
        };

        const closeKeyboard = () => emit('update:modelValue', false);

        return {
            mode, isUpperCase, currentKeys, isSpecialKey,
            getKeyWidthClass, getSpecialBtnClass, handleKeyPress, closeKeyboard,
            isDark, themeClass, keyboardRef, adjustScroll, resetScroll
        };
    }
});
</script>
<style lang="scss" scoped>
.secure-keyboard-wrapper {
    width: 100%;
    z-index: 9999;
    border-top-width: 1px;
    border-top-style: solid;
    user-select: none;
    transition: background-color 0.3s, border-color 0.3s;
}

/* === Theme: Dark === */
.kb-dark {
    background-color: #1d1d1d;
    border-top-color: rgba(255, 255, 255, 0.08);

    .keyboard-toolbar {
        background-color: #2d2d2d;
    }

    .btn-char-dark {
        background-color: #424242 !important;
        color: white !important;

        &:active {
            background-color: #616161 !important;
        }
    }

    .btn-special-dark {
        background-color: #616161 !important;
        color: white !important;
    }
}

/* === Theme: Light === */
.kb-light {
    background-color: #cfd8dc; /* Keyboard base: Blue-grey */
    border-top-color: rgba(0, 0, 0, 0.1);

    .keyboard-toolbar {
        background-color: #eceff1;
        border-bottom: 1px solid #cfd8dc;
    }

    .btn-char-light {
        background-color: #ffffff !important;
        color: #000000 !important;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15); /* Simulate physical key shadow */
        &:active {
            background-color: #e0e0e0 !important;
        }
    }

    .btn-special-light {
        background-color: #b0bec5 !important; /* Function keys darker */
        color: #37474f !important;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
}

/* Layout Classes */
.fixed-bottom {
    position: fixed;
    bottom: 0;
    left: 0;
}

.static-block {
    position: relative;
    flex-shrink: 0;
    padding-bottom: 0;
}

/* Generic Inner Styles */
.keyboard-body {
    padding-top: 8px;
}

.keyboard-row {
    width: 100%;
    margin: 0 auto;
    max-width: 600px;
    gap: 6px;
}

.keyboard-key-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 42px;
    margin-bottom: 3px;

    &.col-1 {
        flex: 1;
    }

    &.col-1-5 {
        flex: 1.5;
    }

    &.col-2 {
        flex: 2;
    }

    &.col-5 {
        flex: 5;
    }
}

.keyboard-btn {
    border-radius: 5px;
    font-size: 16px;
    transition: transform 0.05s, background-color 0.1s;

    &:active {
        transform: translateY(1px);
        box-shadow: none;
    }
}

.special-btn {
    font-size: 14px;
}

.slide-up-enter-active, .slide-up-leave-active {
    transition: transform 0.25s cubic-bezier(0.2, 0.0, 0.2, 1);
}

.slide-up-enter-from, .slide-up-leave-to {
    transform: translateY(100%);
}
</style>