/**
 * Order Notification System
 * Handles loud ringing alerts, web push notifications, wake lock, and speech synthesis
 */

export class OrderNotificationManager {
    private audio: HTMLAudioElement | null = null;
    private standbyAudio: HTMLAudioElement | null = null; // Silent audio loop for standby
    private wakeLock: any = null;
    private isRinging = false;
    private isStandbyMode = false;
    private notificationPermission: NotificationPermission = 'default';
    public wakeLockActive = false; // Public for UI binding

    constructor() {
        // Initialize audio with a loud ringtone
        this.audio = new Audio('https://assets.mixkit.co/active_storage/sfx/941/941-preview.mp3');
        this.audio.loop = true; // Loop continuously
        this.audio.volume = 1.0; // Maximum volume

        // Create silent standby audio to keep audio context alive
        this.standbyAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
        this.standbyAudio.loop = true;
        this.standbyAudio.volume = 0.01; // Nearly silent

        // Request notification permission on initialization
        this.requestNotificationPermission();
    }

    /**
     * Request browser notification permission
     */
    async requestNotificationPermission(): Promise<void> {
        if ('Notification' in window) {
            try {
                this.notificationPermission = await Notification.requestPermission();
                console.log('[NOTIFICATION] Permission:', this.notificationPermission);
            } catch (error) {
                console.error('[NOTIFICATION] Permission request failed:', error);
            }
        }
    }

    /**
     * Request wake lock to prevent screen from sleeping
     */
    async requestWakeLock(): Promise<boolean> {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await (navigator as any).wakeLock.request('screen');
                this.wakeLockActive = true;
                console.log('[WAKE_LOCK] Screen wake lock active');

                // Handle wake lock release
                this.wakeLock.addEventListener('release', () => {
                    this.wakeLockActive = false;
                    console.log('[WAKE_LOCK] Wake lock released');
                });

                // Re-acquire wake lock when visibility changes
                document.addEventListener('visibilitychange', async () => {
                    if (this.wakeLock !== null && document.visibilityState === 'visible') {
                        try {
                            this.wakeLock = await (navigator as any).wakeLock.request('screen');
                            this.wakeLockActive = true;
                        } catch (e) {
                            this.wakeLockActive = false;
                        }
                    }
                });

                return true;
            } catch (error) {
                console.error('[WAKE_LOCK] Failed to acquire wake lock:', error);
                this.wakeLockActive = false;
                return false;
            }
        } else {
            console.warn('[WAKE_LOCK] Wake Lock API not supported');
            return false;
        }
    }

    /**
     * Start standby mode - keeps audio context alive
     */
    async startStandbyMode(): Promise<void> {
        if (this.isStandbyMode) {
            console.log('[STANDBY] Already in standby mode');
            return;
        }

        try {
            // Play silent audio loop to keep audio context active
            if (this.standbyAudio) {
                await this.standbyAudio.play();
                this.isStandbyMode = true;
                console.log('[STANDBY] Standby mode activated - audio context alive');
            }

            // Also request wake lock
            await this.requestWakeLock();
        } catch (error) {
            console.error('[STANDBY] Failed to start standby mode:', error);
            throw error;
        }
    }

    /**
     * Stop standby mode
     */
    stopStandbyMode(): void {
        if (this.standbyAudio) {
            this.standbyAudio.pause();
            this.standbyAudio.currentTime = 0;
            this.isStandbyMode = false;
            console.log('[STANDBY] Standby mode deactivated');
        }
    }

    /**
     * Check if in standby mode
     */
    isInStandbyMode(): boolean {
        return this.isStandbyMode;
    }

    /**
     * Play ringing sound with speech synthesis
     */
    async playRingtone(message: string = 'New order received'): Promise<void> {
        if (this.isRinging) {
            console.log('[RINGTONE] Already ringing, skipping duplicate alert');
            return;
        }

        this.isRinging = true;

        try {
            // Play ringtone
            if (this.audio) {
                await this.audio.play();
                console.log('[RINGTONE] Playing audio alert');
            }

            // Speak after a short delay to let ringtone start
            setTimeout(() => {
                this.speak(message);
            }, 1000);
        } catch (error) {
            console.error('[RINGTONE] Failed to play audio:', error);
            // Fallback to speech only if audio fails
            this.speak(message);
        }
    }

    /**
     * Stop ringing sound
     */
    stopRingtone(): void {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.isRinging = false;
            console.log('[RINGTONE] Stopped audio alert');
        }
    }

    /**
     * Use speech synthesis to announce order
     */
    speak(message: string): void {
        if ('speechSynthesis' in window) {
            try {
                const utterance = new SpeechSynthesisUtterance(message);
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;
                utterance.lang = 'en-US';

                window.speechSynthesis.cancel(); // Cancel any ongoing speech
                window.speechSynthesis.speak(utterance);
                console.log('[SPEECH] Speaking:', message);
            } catch (error) {
                console.error('[SPEECH] Failed to speak:', error);
            }
        }
    }

    /**
     * Show browser notification
     */
    showNotification(title: string, options?: NotificationOptions): void {
        if ('Notification' in window && this.notificationPermission === 'granted') {
            try {
                const notification = new Notification(title, {
                    icon: '/logo.png',
                    badge: '/logo.png',
                    requireInteraction: true, // Keep notification until user interacts
                    ...options,
                });

                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };

                console.log('[NOTIFICATION] Shown:', title);
            } catch (error) {
                console.error('[NOTIFICATION] Failed to show:', error);
            }
        } else {
            console.warn('[NOTIFICATION] Permission not granted or not supported');
        }
    }

    /**
     * Trigger full alert (ringtone + speech + notification)
     */
    triggerAlert(
        title: string,
        message: string,
        notificationBody?: string
    ): void {
        console.log('[ALERT] Triggering full alert:', title);

        // Play ringtone with speech
        this.playRingtone(message);

        // Show browser notification
        this.showNotification(title, {
            body: notificationBody || message,
            tag: 'new-order', // Prevents duplicate notifications
        });
    }

    /**
     * Acknowledge alert (stop all notifications)
     */
    acknowledge(): void {
        this.stopRingtone();
        window.speechSynthesis.cancel();
        console.log('[ALERT] Alert acknowledged');
    }

    /**
     * Release wake lock
     */
    releaseWakeLock(): void {
        if (this.wakeLock !== null) {
            this.wakeLock.release();
            this.wakeLock = null;
            this.wakeLockActive = false;
            console.log('[WAKE_LOCK] Released');
        }
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        this.acknowledge();
        this.stopStandbyMode();
        this.releaseWakeLock();
        this.audio = null;
        this.standbyAudio = null;
    }
}

// Singleton instance for global access
export const notificationManager = new OrderNotificationManager();
