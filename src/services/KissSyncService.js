export class KissSyncService {
    constructor() {
        this.myActiveTouches = {};      // My current touches by ID
        this.partnerActiveTouches = {}; // Partner's current touches
        this.matchedKisses = new Set(); // Already matched kiss IDs
        this.onKissMatch = null;        // Callback when both kiss same spot
        this.onKissProgress = null;     // Callback showing how close they are
    }

    // Called when I touch the screen
    registerMyTouch(touchId, x, y, pattern) {
        this.myActiveTouches[touchId] = { x, y, pattern, timestamp: Date.now() };
        this.checkForMatches();
    }

    // Called when I lift my finger
    removeMyTouch(touchId) {
        delete this.myActiveTouches[touchId];
    }

    // Called when partner's touch data arrives
    registerPartnerTouch(touchId, x, y, pattern) {
        this.partnerActiveTouches[touchId] = { x, y, pattern, timestamp: Date.now() };
        this.checkForMatches();
    }

    // Called when partner lifts finger
    removePartnerTouch(touchId) {
        delete this.partnerActiveTouches[touchId];
    }

    // Check if any of my touches are close to partner's touches
    checkForMatches() {
        const myKeys = Object.keys(this.myActiveTouches);
        const partnerKeys = Object.keys(this.partnerActiveTouches);

        for (const myKey of myKeys) {
            for (const partnerKey of partnerKeys) {
                const my = this.myActiveTouches[myKey];
                const partner = this.partnerActiveTouches[partnerKey];

                const matchId = `${myKey}-${partnerKey}`;
                if (this.matchedKisses.has(matchId)) continue;

                // Calculate distance (0-1 scale where 0 = perfect match)
                const distance = Math.sqrt(
                    Math.pow(my.x - partner.x, 2) +
                    Math.pow(my.y - partner.y, 2)
                );

                // Notify about progress
                const closeness = Math.max(0, 1 - distance * 3); // 0 to 1
                this.onKissProgress?.(closeness);

                // If within 8% distance, it's a match!
                if (distance < 0.08) {
                    this.matchedKisses.add(matchId);
                    this.onKissMatch?.({
                        x: (my.x + partner.x) / 2,
                        y: (my.y + partner.y) / 2,
                        pattern: my.pattern,
                        myTouch: my,
                        partnerTouch: partner,
                    });

                    // Reset after animation
                    setTimeout(() => {
                        this.matchedKisses.delete(matchId);
                    }, 3000);
                }
            }
        }
    }

    // Clear everything
    reset() {
        this.myActiveTouches = {};
        this.partnerActiveTouches = {};
        this.matchedKisses.clear();
    }
}

// Special vibration pattern for kiss match
export const KISS_MATCH_VIBRATION = [
    50, 40, 50, 40, 50, 40,  // Quick pulses
    100, 60, 100, 60,         // Building
    200, 80, 200,              // Stronger
    400                        // Climax!
];

// Heartbeat during close proximity
export const HEARTBEAT_VIBRATION = [60, 100, 60, 100, 60];