// Touch patterns carefully tuned for physical mobile phone vibration motors
export const TOUCH_PATTERNS = {
    kiss: {
        vibration:,
        emoji: '💋',
        color: '#ff4081',
        size: 50,
        duration: 1500,
        label: 'Kiss',
    },
    touch: {
        vibration:,
        emoji: '👆',
        color: '#64b5f6',
        size: 30,
        duration: 800,
        label: 'Touch',
    },
    hug: {
        vibration:,
        emoji: '🤗',
        color: '#ff9800',
        size: 60,
        duration: 2000,
        label: 'Hug',
    },
    heartbeat: {
        vibration:,
        emoji: '💓',
        color: '#f44336',
        size: 40,
        duration: 2000,
        label: 'Heartbeat',
    },
    caress: {
        vibration:,
        emoji: '✨',
        color: '#ffd54f',
        size: 25,
        duration: 1200,
        label: 'Caress',
    },
    squeeze: {
        vibration:,
        emoji: '✊',
        color: '#9c27b0',
        size: 55,
        duration: 1500,
        label: 'Squeeze',
    }
};

export class HapticService {
    // Static variable states to manage hardware tracking queues
    static lastVibrationTime = 0;
    static currentVibrationTimeout = null;
    static onFallbackAlert = null; // Callback assigned by UI layer to support iOS devices

    /**
     * Fires a precise haptic vibration pulse sequence
     * @param {string|Array} patternKeyOrRawArray - Registered lookup string key or direct raw numeric array
     * @param {boolean} force - Bypass standard throttling rules (crucial for special events like Kiss Match)
     */
    static vibrate(patternKeyOrRawArray, force = false) {
        let vibrationPattern = null;
        let identifier = 'Custom';

        // Route inputs adaptively: handle both string dictionary lookups and raw numeric array feeds
        if (typeof patternKeyOrRawArray === 'string') {
            const pattern = TOUCH_PATTERNS[patternKeyOrRawArray];
            if (!pattern) return;
            vibrationPattern = pattern.vibration;
            identifier = patternKeyOrRawArray;
        } else if (Array.isArray(patternKeyOrRawArray)) {
            vibrationPattern = patternKeyOrRawArray;
        }

        if (!vibrationPattern) return;

        const now = Date.now();
        // HARDWARE FILTER: Throttle rapid continuous inputs (minimum 150ms) to prevent mobile engine freezes
        if (!force && (now - HapticService.lastVibrationTime < 150)) {
            return;
        }

        HapticService.lastVibrationTime = now;

        // Check for native Android/Chrome physical vibration support
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            // Clear any pending hardware teardown assignments
            if (HapticService.currentVibrationTimeout) {
                clearTimeout(HapticService.currentVibrationTimeout);
            }

            navigator.vibrate(vibrationPattern);
            console.log(`📳 Haptic Trigger: ${identifier}`);

            // Calculate total sequence duration length to manage tracking lifecycles smoothly
            const totalDuration = vibrationPattern.reduce((acc, current) => acc + current, 0);
            HapticService.currentVibrationTimeout = setTimeout(() => {
                HapticService.currentVibrationTimeout = null;
            }, totalDuration);

        } else {
            // VISUAL FALLBACK ROUTING: Triggers visual cues for iOS/Apple devices lacking native hardware access
            console.warn(`⚠️ Haptics unsupported on this platform. Routing fallback visual alert for: ${identifier}`);
            if (typeof HapticService.onFallbackAlert === 'function') {
                HapticService.onFallbackAlert(identifier);
            }
        }
    }

    // Abruptly terminate all active physical hardware vibration streams instantly
    static stopVibrate() {
        if (HapticService.currentVibrationTimeout) {
            clearTimeout(HapticService.currentVibrationTimeout);
            HapticService.currentVibrationTimeout = null;
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(0);
        }
    }

    // Boolean validation check to verify physical device hardware access metrics
    static isSupported() {
        return typeof navigator !== 'undefined' && !!navigator.vibrate;
    }
}
