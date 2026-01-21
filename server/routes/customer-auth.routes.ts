
import { Router } from 'express';
import { db } from '../lib/db';
import { staff } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

// POST /api/customer/login
// POST /api/customer/login
router.post('/login', async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ error: 'Phone and password are required' });
        }

        const { sales } = await import('../../shared/schema');
        const { desc } = await import('drizzle-orm');

        console.log(`[AUTH] Login attempt for phone: '${phone}'`);

        // ROBUST LOOKUP: Try multiple variations to match how it might be stored
        const variations = [
            phone,
            phone.trim(),
            phone.replace(/\s+/g, ''), // Strip spaces
            phone.replace(/^0/, '+66'), // Country code check (optional)
        ];

        let lastSale = null;

        for (const p of variations) {
            const found = await db.select()
                .from(sales)
                .where(eq(sales.customerPhone, p))
                .orderBy(desc(sales.timestamp))
                .limit(1)
                .get();

            if (found) {
                lastSale = found;
                console.log(`[AUTH] Match found using variation: '${p}' -> GuestID: ${found.guestId}`);
                break;
            }
        }

        if (!lastSale || !lastSale.guestId) {
            console.log('[AUTH] No history found or no guestId linked for any phone variation.');
            return res.status(401).json({ error: 'Invalid credentials or no history found.' });
        }

        const userId = lastSale.guestId;

        // Verify User in Staff table
        const user = await db.select().from(staff).where(eq(staff.id, userId)).get();
        console.log(`[AUTH] User lookup for ID ${userId}:`, user ? `Found ${user.name}` : 'Not found');

        if (!user) {
            return res.status(401).json({ error: 'User account not found' });
        }

        // PASSWORD VERIFICATION: Support both Legacy (Plaintext) and New (Scrypt Hash)
        let passwordValid = false;

        console.log(`[AUTH] Password Check Debug:`);
        console.log(`- Stored Password Length: ${user.password?.length || 0}`);
        console.log(`- Is Hashed (contains :): ${user.password?.includes(':')}`);

        // 1. Check for Hash format (salt:hash)
        if (user.password && user.password.includes(':')) {
            try {
                const { scryptSync } = await import('crypto');
                const [salt, storedHash] = user.password.split(':');
                const inputHash = scryptSync(password, salt, 64).toString('hex');
                passwordValid = (storedHash === inputHash);
                console.log(`[AUTH] Hashed password check: ${passwordValid ? 'VALID' : 'INVALID'}`);
            } catch (err) {
                console.error('[AUTH] Hash check error:', err);
            }
        }
        // 2. Check for Plaintext (Legacy)
        else {
            passwordValid = (user.password === password);
            console.log(`[AUTH] Plaintext password check: ${passwordValid ? 'VALID' : 'INVALID'}`);
        }

        if (!passwordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.status === 'suspended' || user.status === 'deleted') {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        // Create Session
        (req.session as any).staffId = user.id; // Legacy support
        (req.session as any).role = 'customer'; // Force role to customer for this context
        (req.session as any).name = user.name;
        (req.session as any).isCustomer = true;
        (req.session as any).customerId = user.id; // Align with feedback route expectation

        res.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });

    } catch (error) {
        console.error('Customer login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/customer/profile
router.get('/profile', async (req, res) => {
    if (!(req.session as any).customerId) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const userId = (req.session as any).customerId;
        const user = await db.select().from(staff).where(eq(staff.id, userId)).get();

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user.id,
            name: user.name,
            phone: user.name.replace('Guest ', ''), // Hacky fallback since phone isn't in staff table yet
            joinedAt: user.createdAt,
            role: user.role
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// GET /api/customer/orders
router.get('/orders', async (req, res) => {
    if (!(req.session as any).customerId) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const userId = (req.session as any).customerId;
        const { sales } = await import('../../shared/schema');
        const { desc } = await import('drizzle-orm');

        const customerOrders = await db.select()
            .from(sales)
            .where(eq(sales.guestId, userId))
            .orderBy(desc(sales.timestamp))
            .all();

        res.json(customerOrders);
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// POST /api/customer/logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

// POST /api/customer/convert (Guest to Account)
router.post('/convert', async (req, res) => {
    try {
        const { guestId, phone, password, name } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        const { sales } = await import('../../shared/schema');
        const { desc } = await import('drizzle-orm');

        let userId: string;
        let userName: string;

        // PRIORITY 1: If guestId provided, upgrade that specific guest account
        if (guestId) {
            console.log(`[CONVERT] Upgrading guest account: ${guestId}`);

            const existingGuest = await db.select().from(staff).where(eq(staff.id, guestId)).get();

            if (!existingGuest) {
                return res.status(404).json({ error: 'Guest account not found' });
            }

            // Update the existing guest to a full customer account
            await db.update(staff)
                .set({
                    password: password,
                    isGuest: false,
                    name: name || existingGuest.name,
                    role: 'customer' as const,
                    updatedAt: new Date().toISOString()
                })
                .where(eq(staff.id, guestId));

            userId = guestId;
            userName = name || existingGuest.name;
            console.log(`[CONVERT] Guest ${guestId} upgraded to full customer`);

            // PRIORITY 2: Fallback - find by phone and create new if needed
        } else if (phone) {
            console.log(`[CONVERT] Converting by phone: ${phone}`);

            // Check recent sale to ensure they actually ordered
            const lastSale = await db.select().from(sales)
                .where(eq(sales.customerPhone, phone))
                .orderBy(desc(sales.timestamp))
                .limit(1)
                .get();

            if (!lastSale) {
                return res.status(404).json({ error: 'No order history found for this phone. Please order first.' });
            }

            // If the sale has a guestId, upgrade that account
            if (lastSale.guestId) {
                const existingGuest = await db.select().from(staff).where(eq(staff.id, lastSale.guestId)).get();
                if (existingGuest) {
                    await db.update(staff)
                        .set({
                            password: password,
                            isGuest: false,
                            name: name || existingGuest.name,
                            role: 'customer' as const,
                            updatedAt: new Date().toISOString()
                        })
                        .where(eq(staff.id, lastSale.guestId));

                    userId = lastSale.guestId;
                    userName = name || existingGuest.name;
                    console.log(`[CONVERT] Guest ${lastSale.guestId} (from sale) upgraded to full customer`);
                } else {
                    // Guest record missing, create new
                    userId = crypto.randomUUID();
                    userName = name || lastSale.customerName || `Customer ${phone.slice(-4)}`;
                    await createNewCustomer(userId, userName, password);
                }
            } else {
                // No guestId on sale, create new customer
                userId = crypto.randomUUID();
                userName = name || lastSale.customerName || `Customer ${phone.slice(-4)}`;
                await createNewCustomer(userId, userName, password);
            }

            // Link all sales with this phone to the user
            await db.update(sales)
                .set({ guestId: userId })
                .where(eq(sales.customerPhone, phone))
                .run();

        } else {
            return res.status(400).json({ error: 'GuestId or phone is required' });
        }

        // Create session (auto-login)
        (req.session as any).staffId = userId;
        (req.session as any).role = 'customer';
        (req.session as any).name = userName;
        (req.session as any).isCustomer = true;
        (req.session as any).customerId = userId;

        res.json({ success: true, user: { id: userId, name: userName, role: 'customer' } });

    } catch (error) {
        console.error('Convert account error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// Helper function to create new customer
async function createNewCustomer(id: string, name: string, password: string) {
    await db.insert(staff).values({
        id,
        name,
        pin: '0000',
        password: password,
        role: 'customer' as const,
        status: 'active' as const,
        isGuest: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
}

export default router;
