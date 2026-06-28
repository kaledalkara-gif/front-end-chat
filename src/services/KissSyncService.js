export class KissSyncService {
    constructor() {
        this.myActiveTouches = {};         // My current touches indexed by ID
        this.partnerActiveTouches = {};    // Partner's current touches indexed by ID
        this.matchedKisses = new Map();     // matchId -> expiration timestamp mapping
        this.aspectRatio = 1;              // Device display aspect ratio correction factor

        // Core presentation hooks
        this.onKissMatch = null;           // Triggered upon successful touch overlap
        this.onKissProgress = null;        // Throttled proximity metric delivery stream
        this.lastClosenessEmitted = 0;     // State filter to prevent redundant UI adjustments
    }

    // Set aspect ratio from the UI layer to normalize non-square layouts
    setAspectRatio(width, height) {
        if (height > 0) {
            this.aspectRatio = width / height;
        }
    }

    // Called when I touch the screen
    registerMyTouch(touchId, x, y, pattern) {
        this.myActiveTouches[touchId] = { x, y, pattern, timestamp: Date.now() };
        this.checkForMatches();
    }

    // Called when I lift my finger
    removeMyTouch(touchId) {
        delete this.myActiveTouches[touchId];
        this.evaluateGlobalProximityExits();
    }

    // Called when partner's touch data arrives over WebRTC DataChannel
    registerPartnerTouch(touchId, x, y, pattern) {
        this.partnerActiveTouches[touchId] = { x, y, pattern, timestamp: Date.now() };
        this.checkForMatches();
    }

    // Called when partner lifts finger
    removePartnerTouch(touchId) {
        delete this.partnerActiveTouches[touchId];
        this.evaluateGlobalProximityExits();
    }

    // Clean stale match states safely using current timestamps
    clearStaleMatches(now) {
        for (const [matchId, expiresAt] of this.matchedKisses.entries()) {
            if (now >= expiresAt) {
                this.matchedKisses.delete(matchId);
            }
        }
    }

    // Safety filter to turn off proximity mode instantly if interactions break off completely
    evaluateGlobalProximityExits() {
        if (Object.keys(this.myActiveTouches).length === 0 || Object.keys(this.partnerActiveTouches).length === 0) {
            if (this.lastClosenessEmitted > 0) {
                this.lastClosenessEmitted = 0;
                this.onKissProgress?.(0);
            }
        }
    }

    // High-Performance Sync Match Processing Pipeline
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

                // FIXED: Apply aspect ratio correction metrics to eliminate non-square phone scaling distortion
                const deltaX = (my.x - partner.x) * this.aspectRatio;
                const deltaY = my.y - partner.y;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                // Normalize scaling metric tracking bounds
                const closeness = Math.max(0, 1 - distance * 3.5);
                if (closeness > highestClosenessFound) {
                    highestClosenessFound = closeness;
                }

                // FIXED: Distance check normalized across device scaling configurations (8% threshold)
                if (distance < 0.08) {
                    // FIXED: Set an absolute timestamp rule to completely stop conflicting timer leaks
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

        // FIXED: Only emit proximity score changes if the value shifted to prevent UI component re-render loops
        if (Math.abs(highestClosenessFound - this.lastClosenessEmitted) > 0.02 || highestClosenessFound === 0) {
            this.lastClosenessEmitted = highestClosenessFound;
            this.onKissProgress?.(highestClosenessFound);
        }
    }

    // Clear everything safely on call end
    reset() {
        this.myActiveTouches = {};
        this.partnerActiveTouches = {};
        this.matchedKisses.clear();
        this.lastClosenessEmitted = 0;
    }
}

// Special haptic vibration frequency profile for kiss matches
export const KISS_MATCH_VIBRATION = [
    50, 40, 50, 40, 50, 40, // Quick initial contact notification alerts
    100, 60, 100, 60,       // Building amplitude tracks
    200, 80, 200,           // Deeper resonance stages
    400                     // Final peak saturation strike
];

// Heartbeat proximity warning indicator track rules
export const HEARTBEAT_VIBRATION =;
