// Touch patterns that feel like different gestures
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
        emoji: '🫂',
        color: '#9c27b0',
        size: 55,
        duration: 1500,
        label: 'Squeeze',
    },
};

export class HapticService {
    static vibrate(patternKey) {
        const pattern = TOUCH_PATTERNS[patternKey];
        if (!pattern) return;

        // Check if vibration is supported
        if (navigator.vibrate) {
            navigator.vibrate(pattern.vibration);
            console.log('📳 Vibration:', patternKey);
        } else {
            console.log('⚠️ Vibration not supported on this device');
        }
    }

    static stopVibrate() {
        if (navigator.vibrate) {
            navigator.vibrate(0);
        }
    }

    static isSupported() {
        return !!navigator.vibrate;
    }
}