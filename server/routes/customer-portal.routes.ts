
import { Router } from 'express';
import { db } from '../lib/db';
import { staff, sales, saleItems } from '../../shared/schema';
import { eq, desc, and } from 'drizzle-orm';

const router = Router();

// Middleware to check if user is logged in as customer
const requireCustomerAuth = (req: any, res: any, next: any) => {
    // Check both customerId and staffId for backwards compatibility
    const customerId = req.session?.customerId || req.session?.staffId;
    if (!customerId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    // Normalize for downstream handlers
    req.customerId = customerId;
    next();
};

router.use(requireCustomerAuth);

// GET /api/customer/profile
router.get('/profile', async (req: any, res) => {
    try {
        const userId = req.customerId;
        const user = await db.select().from(staff).where(eq(staff.id, userId)).get();

        if (!user) return res.status(404).json({ error: 'User not found' });

        // Fetch phone from last order if not in staff table (Workaround)
        const lastSale = await db.select()
            .from(sales)
            .where(eq(sales.guestId, userId))
            .orderBy(desc(sales.timestamp))
            .limit(1)
            .get();

        res.json({
            id: user.id,
            name: user.name,
            role: user.role,
            phone: lastSale?.customerPhone || 'N/A', // Best effort
            joinedAt: user.createdAt
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// PUT /api/customer/profile
router.put('/profile', async (req: any, res) => {
    try {
        const userId = req.customerId;
        const { name } = req.body;

        if (!name) return res.status(400).json({ error: 'Name is required' });

        await db.update(staff)
            .set({ name, updatedAt: new Date().toISOString() })
            .where(eq(staff.id, userId));

        res.json({ success: true, message: 'Profile updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// GET /api/customer/orders
router.get('/orders', async (req: any, res) => {
    try {
        const userId = req.customerId;

        // Fetch orders where guestId matches current user
        const userOrders = await db.select()
            .from(sales)
            .where(eq(sales.guestId, userId))
            .orderBy(desc(sales.timestamp))
            .limit(50) // Limit to last 50
            .all();

        res.json(userOrders);
    } catch (error) {
        console.error("Fetch orders error:", error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// DELETE /api/customer/account
// Soft delete / Anonymize for privacy
router.delete('/account', async (req: any, res) => {
    try {
        const userId = req.customerId;

        // 1. Anonymize User Record
        await db.update(staff)
            .set({
                name: 'Deleted User',
                status: 'deleted',
                password: null,
                pin: '0000', // Invalidate PIN
                barcode: null
            })
            .where(eq(staff.id, userId));

        // 2. Destroy Session
        req.session.destroy();

        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

export default router;
