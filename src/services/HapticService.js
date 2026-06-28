// Touch patterns carefully tuned for physical mobile phone vibration motors
export const TOUCH_PATTERNS = {
    kiss: {
        vibration: [80, 60, 80, 60, 80, 60, 120],
        emoji: '💋',
        color: '#ff4081',
        size: 50,
        duration: 1500,
        label: 'Kiss',
    },
    touch: {
        vibration: [40],
        emoji: '👆',
        color: '#64b5f6',
        size: 30,
        duration: 800,
        label: 'Touch',
    },
    hug: {
        vibration: [150, 80, 150, 80, 300],
        emoji: '🤗',
        color: '#ff9800',
        size: 60,
        duration: 2000,
        label: 'Hug',
    },
    heartbeat: {
        vibration: [100, 80, 100, 80, 100, 80, 100],
        emoji: '💓',
        color: '#f44336',
        size: 40,
        duration: 2000,
        label: 'Heartbeat',
    },
    caress: {
        vibration: [30, 30, 30, 30, 30, 30, 30],
        emoji: '✨',
        color: '#ffd54f',
        size: 25,
        duration: 1200,
        label: 'Caress',
    },
    squeeze: {
        vibration: [200, 100, 200],
        emoji: '✊',
        color: '#9c27b0',
        size: 55,
        duration: 1500,
        label: 'Squeeze',
    }
};

export class HapticService {
    static lastVibrationTime = 0;
    static currentVibrationTimeout = null;
    static onFallbackAlert = null;

    static vibrate(patternKeyOrRawArray, force = false) {
        let vibrationPattern = null;
        let identifier = 'Custom';

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
        if (!force && (now - HapticService.lastVibrationTime < 150)) {
            return;
        }

        HapticService.lastVibrationTime = now;

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            if (HapticService.currentVibrationTimeout) {
                clearTimeout(HapticService.currentVibrationTimeout);
            }

            navigator.vibrate(vibrationPattern);

            const totalDuration = vibrationPattern.reduce((acc, current) => acc + current, 0);
            HapticService.currentVibrationTimeout = setTimeout(() => {
                HapticService.currentVibrationTimeout = null;
            }, totalDuration);

        } else {
            console.warn(`⚠️ Haptics unsupported on this platform: ${identifier}`);
            if (typeof HapticService.onFallbackAlert === 'function') {
                HapticService.onFallbackAlert(identifier);
            }
        }
    }

    static stopVibrate() {
        if (HapticService.currentVibrationTimeout) {
            clearTimeout(HapticService.currentVibrationTimeout);
            HapticService.currentVibrationTimeout = null;
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(0);
        }
    }

    static isSupported() {
        return typeof navigator !== 'undefined' && !!navigator.vibrate;
    }
}
