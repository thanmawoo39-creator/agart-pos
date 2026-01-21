/**
 * Simple in-memory cache for frequently accessed data
 * Reduces database queries for data that doesn't change often
 */

interface CacheEntry<T> {
    data: T;
    expiry: number;
}

class SimpleCache {
    private cache = new Map<string, CacheEntry<any>>();
    private defaultTTL = 60000; // 1 minute default

    /**
     * Get data from cache or fetch fresh data
     */
    async getOrFetch<T>(
        key: string,
        fetcher: () => Promise<T>,
        ttlMs: number = this.defaultTTL
    ): Promise<T> {
        const cached = this.cache.get(key);
        const now = Date.now();

        if (cached && cached.expiry > now) {
            console.log(`[CACHE] HIT: ${key}`);
            return cached.data as T;
        }

        console.log(`[CACHE] MISS: ${key}`);
        const data = await fetcher();
        this.cache.set(key, { data, expiry: now + ttlMs });
        return data;
    }

    /**
     * Invalidate a specific cache entry
     */
    invalidate(key: string): void {
        this.cache.delete(key);
        console.log(`[CACHE] INVALIDATED: ${key}`);
    }

    /**
     * Invalidate all entries matching a prefix
     */
    invalidatePrefix(prefix: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
        console.log(`[CACHE] INVALIDATED PREFIX: ${prefix}*`);
    }

    /**
     * Clear entire cache
     */
    clear(): void {
        this.cache.clear();
        console.log(`[CACHE] CLEARED ALL`);
    }

    /**
     * Get cache statistics
     */
    stats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        };
    }
}

// Export singleton instance
export const cache = new SimpleCache();

// Cache key constants for consistency
export const CACHE_KEYS = {
    PRODUCTS: 'products',
    PRODUCTS_BY_BU: (buId: string) => `products:bu:${buId}`,
    CUSTOMERS: 'customers',
    STAFF: 'staff',
    BUSINESS_UNITS: 'business_units',
    APP_SETTINGS: 'app_settings',
    TABLES: (buId: string) => `tables:bu:${buId}`,
} as const;

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
    SHORT: 30000,      // 30 seconds - for frequently changing data
    MEDIUM: 60000,     // 1 minute - default
    LONG: 300000,      // 5 minutes - for rarely changing data
    VERY_LONG: 600000, // 10 minutes - for static data like settings
} as const;
