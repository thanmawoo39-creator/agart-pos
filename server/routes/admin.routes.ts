import { Router } from 'express';
import { db } from '../lib/db';
import {
    sales, cateringOrders, kitchenTickets, saleItems, paymentBuffers,
    smsLogs, inventoryLogs, creditLedger, attendance, expenses,
    customers, staff, tables, alerts
} from '../../shared/schema';
import { eq, or, and, isNotNull, ne } from 'drizzle-orm';
import { isAuthenticated, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/admin/active-deliveries
// Returns all active deliveries with GPS coordinates
router.get('/active-deliveries', isAuthenticated, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
    try {
        // Fetch Restaurant Deliveries
        const restaurantDeliveries = await db
            .select({
                id: sales.id,
                riderName: sales.customerName, // Usually rider or customer, but for delivery it's customer. Wait, where is rider name stored? 
                // Ah, legacy app doesn't strictly store Rider Name separately if using external riders, 
                // but we might assume the "User" logged in is the rider.
                // However, the `sales` table has `driverLat/Lng`.
                // Let's return customer info as identifier + Order ID.
                customerName: sales.customerName,
                lat: sales.driverLat,
                lng: sales.driverLng,
                status: sales.status,
                type: sales.orderType, // 'delivery'
                updatedAt: sales.locationUpdatedAt
            })
            .from(sales)
            .where(
                and(
                    or(eq(sales.status, 'out_for_delivery'), eq(sales.status, 'delivering')),
                    isNotNull(sales.driverLat),
                    isNotNull(sales.driverLng)
                )
            );

        // Fetch Catering Deliveries
        const cateringDeliveries = await db
            .select({
                id: cateringOrders.id,
                customerName: cateringOrders.customerName,
                lat: cateringOrders.driverLat,
                lng: cateringOrders.driverLng,
                status: cateringOrders.status, // 'out_for_delivery'
                updatedAt: cateringOrders.locationUpdatedAt
            })
            .from(cateringOrders)
            .where(
                and(
                    eq(cateringOrders.status, 'out_for_delivery'),
                    isNotNull(cateringOrders.driverLat),
                    isNotNull(cateringOrders.driverLng)
                )
            );

        // Normalize Data
        const normalized = [
            ...restaurantDeliveries.map(d => ({
                id: d.id,
                type: 'restaurant',
                riderName: 'Rider (Rest.)', // We don't track rider name explicitly yet, just lat/lng
                customerName: d.customerName,
                lat: d.lat,
                lng: d.lng,
                status: d.status,
                updatedAt: d.updatedAt
            })),
            ...cateringDeliveries.map(d => ({
                id: String(d.id), // Catering IDs are numbers
                type: 'catering',
                riderName: 'Rider (Cat.)',
                customerName: d.customerName,
                lat: d.lat,
                lng: d.lng,
                status: d.status,
                updatedAt: d.updatedAt
            }))
        ];

        res.json(normalized);
    } catch (error) {
        console.error('Error fetching active deliveries:', error);
        res.status(500).json({ error: 'Failed to fetch deliveries' });
    }
});

// POST /api/admin/factory-reset
// DANGER: Wipes all transactional data for a clean system
router.post('/factory-reset', isAuthenticated, requireRole('owner'), async (req, res) => {
    try {
        console.warn(`[FACTORY-RESET] Initiated by ${req.user?.name} (${req.user?.id})`);

        // 1. Transactional Data (Order independent)
        await db.delete(kitchenTickets);
        await db.delete(saleItems);
        await db.delete(sales);
        await db.delete(cateringOrders);
        await db.delete(paymentBuffers);
        await db.delete(smsLogs);
        await db.delete(inventoryLogs);
        await db.delete(creditLedger);
        await db.delete(attendance);
        await db.delete(expenses);
        await db.delete(alerts);

        // 2. Customers (Delete all)
        await db.delete(customers);

        // 3. Staff (Preserve Owner/Admin)
        // Delete everyone who is NOT an owner AND NOT using the default admin PIN '0000'
        await db.delete(staff).where(
            and(
                ne(staff.role, 'owner'),
                ne(staff.pin, '0000')
            )
        );

        // 4. Tables (Do not delete, just reset status)
        await db.update(tables).set({
            status: 'available',
            currentOrder: null,
            lastOrdered: null,
            serviceStatus: null,
            updatedAt: new Date().toISOString()
        });

        console.log('[FACTORY-RESET] System wiped successfully.');

        res.json({ success: true, message: "System verified and reset to factory defaults." });
    } catch (error) {
        console.error('Error performing factory reset:', error);
        res.status(500).json({ error: 'Failed to reset system', details: error });
    }
});

// GET /api/admin/backup
// PostgreSQL database backup (not supported via file download)
router.get('/backup', isAuthenticated, requireRole('owner'), async (req, res) => {
    // PostgreSQL backups should be done via Supabase dashboard or pg_dump
    res.status(501).json({
        error: "Database backup not available for PostgreSQL via this endpoint",
        message: "Please use Supabase dashboard or pg_dump for database backups"
    });
});

export default router;
