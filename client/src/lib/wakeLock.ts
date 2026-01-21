/**
 * Wake Lock API Utility for Kitchen View
 * Prevents screen from sleeping while viewing orders
 */

export class WakeLockManager {
    private wakeLock: WakeLockSentinel | null = null;
    private isSupported: boolean;

    constructor() {
        this.isSupported = 'wakeLock' in navigator;
        if (!this.isSupported) {
            console.log('[Wake Lock] API not supported in this browser');
        }
    }

    /**
     * Request wake lock to keep screen on
     */
    async request(): Promise<boolean> {
        if (!this.isSupported) {
            console.log('[Wake Lock] Not supported');
            return false;
        }

        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            console.log('[Wake Lock] Activated - Screen will stay on');

            // Re-request wake lock when visibility changes (user returns to tab)
            this.wakeLock.addEventListener('release', () => {
                console.log('[Wake Lock] Released');
            });

            return true;
        } catch (err) {
            console.error('[Wake Lock] Failed to activate:', err);
            return false;
        }
    }

    /**
     * Release wake lock (allow screen to sleep)
     */
    async release(): Promise<void> {
        if (this.wakeLock) {
            await this.wakeLock.release();
            this.wakeLock = null;
            console.log('[Wake Lock] Manually released');
        }
    }

    /**
     * Check if wake lock is currently active
     */
    isActive(): boolean {
        return this.wakeLock !== null && !this.wakeLock.released;
    }
}

// Singleton instance
export const wakeLockManager = new WakeLockManager();
