export class KissSyncService {
    constructor() {
        this.myActiveTouches = {};
        this.partnerActiveTouches = {};
        this.matchedKisses = new Map();
        this.aspectRatio = 1;
        this.onKissMatch = null;
        this.onKissProgress = null;
        this.lastClosenessEmitted = 0;
    }

    setAspectRatio(width, height) {
        if (height > 0) {
            this.aspectRatio = width / height;
        }
    }

    registerMyTouch(touchId, x, y, pattern) {
        this.myActiveTouches[touchId] = { x, y, pattern, timestamp: Date.now() };
        this.checkForMatches();
    }

    removeMyTouch(touchId) {
        delete this.myActiveTouches[touchId];
        this.evaluateGlobalProximityExits();
    }

    registerPartnerTouch(touchId, x, y, pattern) {
        this.partnerActiveTouches[touchId] = { x, y, pattern, timestamp: Date.now() };
        this.checkForMatches();
    }

    removePartnerTouch(touchId) {
        delete this.partnerActiveTouches[touchId];
        this.evaluateGlobalProximityExits();
    }

    clearStaleMatches(now) {
        for (const [matchId, expiresAt] of this.matchedKisses.entries()) {
            if (now >= expiresAt) {
                this.matchedKisses.delete(matchId);
            }
        }
    }

    evaluateGlobalProximityExits() {
        if (Object.keys(this.myActiveTouches).length === 0 || Object.keys(this.partnerActiveTouches).length === 0) {
            if (this.lastClosenessEmitted > 0) {
                this.lastClosenessEmitted = 0;
                this.onKissProgress?.(0);
            }
        }
    }

    checkForMatches() {
        const now = Date.now();
        this.clearStaleMatches(now);

        const myKeys = Object.keys(this.myActiveTouches);
        const partnerKeys = Object.keys(this.partnerActiveTouches);

        if (myKeys.length === 0 || partnerKeys.length === 0) return;

        let highestClosenessFound = 0;

        for (const myKey of myKeys) {
            for (const partnerKey of partnerKeys) {
                const my = this.myActiveTouches[myKey];
                const partner = this.partnerActiveTouches[partnerKey];
                const matchId = `${myKey}-${partnerKey}`;

                if (this.matchedKisses.has(matchId)) continue;

                const deltaX = (my.x - partner.x) * this.aspectRatio;
                const deltaY = my.y - partner.y;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                const closeness = Math.max(0, 1 - distance * 3.5);
                if (closeness > highestClosenessFound) {
                    highestClosenessFound = closeness;
                }

                if (distance < 0.08) {
                    this.matchedKisses.set(matchId, now + 3000);

                    this.onKissMatch?.({
                        x: (my.x + partner.x) / 2,
                        y: (my.y + partner.y) / 2,
                        pattern: my.pattern,
                        myTouch: my,
                        partnerTouch: partner,
                    });
                }
            }
        }

        if (Math.abs(highestClosenessFound - this.lastClosenessEmitted) > 0.02 || highestClosenessFound === 0) {
            this.lastClosenessEmitted = highestClosenessFound;
            this.onKissProgress?.(highestClosenessFound);
        }
    }

    reset() {
        this.myActiveTouches = {};
        this.partnerActiveTouches = {};
        this.matchedKisses.clear();
        this.lastClosenessEmitted = 0;
    }
}

export const KISS_MATCH_VIBRATION = [
    50, 40, 50, 40, 50, 40,
    100, 60, 100, 60,
    200, 80, 200,
    400
];

export const HEARTBEAT_VIBRATION = [60, 100, 60, 100, 60];
