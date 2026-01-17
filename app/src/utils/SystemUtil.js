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

import { useQuasar, colors, debounce } from 'quasar';


/**
 * Set status bar color (Visual deception immersion)
 * Principle: Set the status bar background to the same color as the Header, visually blending them into one
 * @param bgColor
 */
export function setStatusBar(bgColor) {
    const { getPaletteColor, luminosity } = colors
    if (typeof window.StatusBar === 'undefined') {
        console.warn('StatusBar plugin not ready yet.');
        return;
    }

    try {
        if (!bgColor) {
            window.StatusBar.hide();
        } else {
            window.StatusBar.show();
            const hexColor = getPaletteColor(bgColor)
            console.log(`color=${hexColor}`)
            window.StatusBar.backgroundColorByHexString(hexColor)
            window.StatusBar.overlaysWebView(true)
            if (luminosity(hexColor) < 0.5) {
                window.StatusBar.styleLightContent()
                console.log(`Status bar set to dark background, white text`)
            } else {
                window.StatusBar.styleDefault()
                console.log(`Status bar set to light background, black text`)
            }
        }
    } catch (e) {
        console.error('setStatusBar error:', e);
        // Fallback check if StatusBar is available
        if (typeof window.StatusBar !== 'undefined') {
            window.StatusBar.backgroundColorByHexString('#FFFFFF')
            window.StatusBar.styleDefault()
            console.log(`Status bar set to light background, black text`)
        }
    }
}

/**
 * Initialize safe area height
 */
export function initSafeArea() {
    const $q = useQuasar();

    // 1. Get root element style object
    const rootStyle = document.documentElement.style;

    const calcSafeArea = () => {
        console.log('[SystemUtil] Recalculating Safe Area...');

        // 2. Android Environment: Use plugin to get physical height
        if ($q.platform.is.android) {
            // Check if plugin is loaded
            if (window.AndroidNotch) {
                window.AndroidNotch.getInsetTop(
                    (px) => {
                        console.log('Android statusbar height:', px)
                        // If 0 is returned (no notch), fallback to 24px
                        // If value returned (has notch), use it directly
                        const safePx = px > 0 ? px : 24
                        rootStyle.setProperty('--safe-top', `${safePx}px`)
                    },
                    (err) => {
                        console.error('AndroidNotch Error:', err)
                        rootStyle.setProperty('--safe-top', '24px') // Fallback on failure
                    }
                )

            } else {
                // Plugin not installed or in browser
                rootStyle.setProperty('--safe-top', '0px');
                rootStyle.setProperty('--safe-bottom', '0px');
            }

            // Handle safe bottom area
            if (window.cordova && window.cordova.plugins && window.cordova.plugins.InsetsPlugin) {
                window.cordova.plugins.InsetsPlugin.getInsets(
                    (insets) => {
                        const density = window.devicePixelRatio || 1;

                        // --- Top handling ---
                        // const topPx = insets.top / density;
                        // rootStyle.setProperty('--safe-top', `${topPx > 0 ? topPx : 24}px`);

                        // --- Bottom Smart Judgment Logic (Core) ---
                        const bottomPhysical = insets.bottom; // Physical pixels returned by plugin
                        const bottomCss = bottomPhysical / density; // Convert to CSS pixels

                        if (bottomCss > 0) {
                            // Get screen total height (CSS pixels)
                            const screenHeight = window.screen.height;
                            // Get current WebView visible height
                            const windowHeight = window.innerHeight;

                            // Calculate difference: (Screen Total Height - Viewport Height) = Height occupied by System Bars (Status Bar + Navigation Bar)
                            const systemReservedHeight = screenHeight - windowHeight;

                            // [Smart Judgment]
                            // If "System Reserved Height" is significantly larger than "Bottom Navigation Bar Height", it means the system has already compressed the WebView (e.g., Xiaomi).
                            // In this case, the system has already reserved safe area, we don't need to add Padding.
                            // (*0.8 here is for tolerance, preventing minor calculation errors)
                            if (systemReservedHeight > (bottomCss * 0.8)) {
                                console.log('SystemUtil: Detected system auto-avoidance for bottom, frontend reset to 0');
                                rootStyle.setProperty('--safe-bottom', '0px');
                            } else {
                                // Set bottom safe area (Critical! Prevent Home bar obstruction)
                                // If there is a bottom navigation bar, insets.bottom will return a value (e.g., 48 or 24)
                                const safeBottom = insets.bottom > 0 ? insets.bottom : 0;
                                rootStyle.setProperty('--safe-bottom', `${safeBottom}px`);
                                console.log(`SystemUtil: Detected immersive obstruction, frontend manually added ${safeBottom}px`);
                            }
                        } else {
                            rootStyle.setProperty('--safe-bottom', '0px');
                        }
                    },
                    (err) => console.error('Insets Error:', err)
                );
            }
        }

        // 3. iOS Environment: Directly use CSS environment variables
        // iOS Webview native support is perfect, no JS calculation needed
        else if ($q.platform.is.ios) {
            rootStyle.setProperty('--safe-top', 'env(safe-area-inset-top)');
            rootStyle.setProperty('--safe-bottom', 'env(safe-area-inset-bottom)');
        }

        // 4. Other Environments (Browser Debug)
        else {
            rootStyle.setProperty('--safe-top', '0px');
            rootStyle.setProperty('--safe-bottom', '0px');
        }
    }

    calcSafeArea();

    window.addEventListener('resize', debounce(calcSafeArea, 200));
}