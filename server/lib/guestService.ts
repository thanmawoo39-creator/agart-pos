import { db } from './db';
import { staff, sales } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { cache, CACHE_KEYS } from './cache';

/**
 * Guest Service - Isolated guest user management
 * 
 * This service handles guest users separately from core POS staff.
 * It uses targeted cache invalidation to avoid impacting POS performance.
 */

export interface GuestUser {
    id: string;
    phone: string;
    guestId: string;
    createdAt: string;
}

export interface CreateGuestOptions {
    phone: string;
    name?: string;
}

/**
 * Create a guest user (temporary staff record with isGuest=true)
 * @param options Guest creation options
 * @returns Created guest user data
 */
export async function createGuestUser(options: CreateGuestOptions): Promise<GuestUser> {
    const guestId = `GUEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const guestName = options.name || `Guest ${options.phone.slice(-4)}`;

    // Generate a random PIN for guest (not used for auth, just for schema compliance)
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();

    const result = await db.insert(staff).values({
        name: guestName,
        pin: randomPin,
        role: 'customer', // Default role for guests
        status: 'active',
        isGuest: true, // Mark as guest
        businessUnitId: '1', // Default business unit
    }).returning();

    const guestUser = result[0];

    // Invalidate ONLINE cache keys only (not POS caches)
    invalidateOnlineCaches();

    return {
        id: guestUser.id,
        phone: options.phone,
        guestId: guestUser.id, // Use actual DB ID for robust lookup
        createdAt: guestUser.createdAt,
    };
}

/**
 * Find a guest user by phone number
 * @param phone Guest phone number
 * @returns Guest user or null
 */
export async function findGuestByPhone(phone: string): Promise<GuestUser | null> {
    // Note: In production, you'd store phone in staff table or a separate guests table
    // For now, we're using the name field pattern matching
    const guests = await db.select()
        .from(staff)
        .where(eq(staff.isGuest, true))
        .limit(100);

    // This is a simplification - in production, add a phone column to staff
    const guest = guests.find(g => g.name.includes(phone.slice(-4)));

    if (!guest) return null;

    return {
        id: guest.id,
        phone,
        guestId: `GUEST-${guest.id}`,
        createdAt: guest.createdAt,
    };
}

/**
 * Verify guest phone (placeholder for SMS verification)
 * @param guestId Guest identifier
 * @param code Verification code
 * @returns Verification result
 */
export async function verifyGuestPhone(guestId: string, code: string): Promise<boolean> {
    // TODO: Implement actual SMS verification logic
    // For now, accept any 4-digit code
    const isValid = /^\d{4}$/.test(code);

    if (isValid) {
        // Mark phone as verified in sales record
        // This would be called when creating an order
        console.log(`[GuestService] Phone verified for guest: ${guestId}`);
    }

    return isValid;
}

/**
 * Create a guest order with phone verification tracking
 * @param guestId Guest identifier
 * @param orderData Order data
 * @returns Created order ID
 */
export async function createGuestOrder(
    guestId: string,
    orderData: {
        items: any[];
        subtotal: number;
        tax: number;
        total: number;
        deliveryAddress?: string;
        customerPhone?: string;
    }
): Promise<string> {
    const result = await db.insert(sales).values({
        subtotal: orderData.subtotal,
        discount: 0,
        tax: orderData.tax,
        total: orderData.total,
        status: 'pending',
        paymentMethod: 'mobile',
        paymentStatus: 'pending_verification',
        orderSource: 'delivery',
        orderType: 'delivery',
        deliveryAddress: orderData.deliveryAddress,
        customerPhone: orderData.customerPhone,
        phoneVerified: false, // Will be updated after verification
        guestId: guestId,
        businessUnitId: '1',
        timestamp: new Date().toISOString(),
    }).returning();

    // Invalidate ONLINE cache keys only
    invalidateOnlineCaches();

    return result[0].id;
}

/**
 * Invalidate only online store caches, preserving POS performance
 */
function invalidateOnlineCaches(): void {
    // Only invalidate online-specific caches
    // POS caches (products, staff, settings) are untouched
    cache.invalidate('online:products');
    cache.invalidate('online:settings');
    cache.invalidate('online:orders');

    console.log('[GuestService] Invalidated ONLINE caches only - POS performance preserved');
}

/**
 * Clean up old guest users (run periodically)
 * Removes guest staff records older than 30 days
 */
export async function cleanupOldGuests(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // This is a placeholder - would need proper cleanup logic
    console.log('[GuestService] Cleanup scheduled for guests older than', thirtyDaysAgo);

    return 0; // Return count of deleted guests
}
