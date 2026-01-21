import { Router } from 'express';
import { db } from '../lib/db';
import { cateringOrders, cateringItems, cateringProducts } from '../../shared/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { isAuthenticated, requireRole } from '../middleware/auth';

const router = Router();

// 🔥 CRITICAL SECURITY FIX: Block all public access
router.use(isAuthenticated);

// Validation Schemas
const createCateringOrderSchema = z.object({
    customerName: z.string().min(1),
    customerPhone: z.string().min(1),
    deliveryDate: z.string(), // ISO String
    deliveryAddress: z.string().optional(),
    depositPaid: z.number().default(0),
    items: z.array(z.object({
        itemName: z.string().min(1),
        quantity: z.number().min(1),
        unitPrice: z.number().min(0),
        isAddon: z.boolean().default(false)
    })).min(1)
});

const updateStatusSchema = z.object({
    status: z.enum(['draft', 'confirmed', 'cooking', 'ready', 'out_for_delivery', 'delivered', 'cancelled'])
});

// GET /api/catering/orders - List all orders (optional date filter)
// OPTIMIZED: Excludes large image blobs to reduce payload size for mobile
// NOTE: Catering orders are ALWAYS for Restaurant business unit (ID: '2')
// This ensures strict isolation between Restaurant and Grocery operations
router.get('/orders', async (req, res) => {
    try {
        const { date, businessUnitId } = req.query;

        // STRICT BUSINESS UNIT ISOLATION: Only show orders for the specified business unit
        // Catering is exclusively a Restaurant feature (businessUnitId = '2')
        // If no businessUnitId is provided, default to Restaurant ('2')
        const effectiveBusinessUnitId = typeof businessUnitId === 'string' ? businessUnitId : '2';

        // STRICT BUSINESS UNIT ISOLATION RELAXED FOR CATERING
        // Both Unit 1 (Main) and Unit 2 (Restaurant) need access to Catering orders
        // to manage the "Biryani" production flow together.
        if (effectiveBusinessUnitId !== '1' && effectiveBusinessUnitId !== '2') {
            return res.json([]);
        }

        let query = db.select().from(cateringOrders).orderBy(desc(cateringOrders.deliveryDate));

        const allOrders = await query;

        // Join items for list view
        const ordersWithItems = await Promise.all(allOrders.map(async (order) => {
            const items = await db.select().from(cateringItems).where(eq(cateringItems.cateringOrderId, order.id));

            // OPTIMIZATION: Strip large blob data from list response
            // proofImageUrl and paymentSlipUrl may contain base64 data (several MB each)
            // Only return URL paths, not base64 data
            const { proofImageUrl, paymentSlipUrl, ...orderWithoutBlobs } = order as any;

            // If URLs are file paths (not base64), include them; otherwise exclude
            const isFilePath = (url: string | null) => url && !url.startsWith('data:');

            return {
                ...orderWithoutBlobs,
                // Only include proof URLs if they are file paths (start with '/')
                proofImageUrl: isFilePath(proofImageUrl) ? proofImageUrl : null,
                paymentSlipUrl: isFilePath(paymentSlipUrl) ? paymentSlipUrl : null,
                items
            };
        }));

        // Filter by date if provided
        if (date && typeof date === 'string') {
            const filtered = ordersWithItems.filter(o => o.deliveryDate?.startsWith(date));
            return res.json(filtered);
        }

        res.json(ordersWithItems);
    } catch (error) {
        console.error('Error fetching catering orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// GET /api/catering/orders/:id - Detail view
router.get('/orders/:id', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid ID' });

        const order = await db.select().from(cateringOrders).where(eq(cateringOrders.id, orderId)).get();

        if (!order) return res.status(404).json({ error: 'Order not found' });

        const items = await db.select().from(cateringItems).where(eq(cateringItems.cateringOrderId, orderId));

        res.json({ ...order, items });
    } catch (error) {
        console.error('Error fetching catering order details:', error);
        res.status(500).json({ error: 'Failed to fetch order details' });
    }
});

// POST /api/catering/orders - Create Order (CRASH-PROOF VERSION)
router.post('/orders', async (req, res) => {
    // ============================================================
    // 🔥 STEP 1: DEBUG LOGGING (First Thing Always)
    // ============================================================
    console.log("🔥 INCOMING CATERING ORDER:", JSON.stringify(req.body, null, 2));
    console.log("👤 USER CONTEXT:", (req as any).user);

    try {
        // ============================================================
        // 📦 STEP 2: DATA NORMALIZATION (The "Fix")
        // ============================================================

        // -- Customer Info (Safe Extraction) --
        const customerName = String(req.body.customerName || 'Unknown Customer').trim();
        const customerPhone = String(req.body.customerPhone || '').trim();
        const deliveryAddress = String(req.body.deliveryAddress || '').trim();
        const depositPaid = Number(req.body.depositPaid) || 0;

        // -- Date Handling (Safe) --
        let deliveryDate: string;
        const parsedDate = new Date(req.body.deliveryDate);
        if (isNaN(parsedDate.getTime())) {
            deliveryDate = new Date().toISOString();
        } else {
            deliveryDate = parsedDate.toISOString();
        }

        // -- Items Handling (The Critical Fix) --
        let normalizedItems: { item_name: string; quantity: number; unit_price: number; is_addon: boolean }[] = [];
        const rawItems = req.body.items;


        if (Array.isArray(rawItems)) {
            // Frontend sent an Array (expected format)
            normalizedItems = rawItems.map((item: any) => ({
                item_name: String(item.itemName || item.item_name || 'Unknown Item'),
                quantity: Number(item.quantity) || 0,
                unit_price: Number(item.unitPrice || item.unit_price) || 0,
                is_addon: Boolean(item.isAddon || item.is_addon || false)
            }));
        } else if (rawItems && typeof rawItems === 'object') {
            // Frontend sent an Object like { "standard_set": 5, "royal_set": 2 }
            normalizedItems = Object.entries(rawItems).map(([key, qty]) => ({
                item_name: key,
                quantity: Number(qty) || 0,
                unit_price: 0, // Will be looked up from PRICE_MAP
                is_addon: key.toLowerCase().includes('extra')
            }));
        } else {
            console.error("❌ Items is neither Array nor Object:", rawItems);
            return res.status(400).json({
                error: 'Invalid items format',
                details: 'Expected "items" to be an Array or Object, received: ' + typeof rawItems
            });
        }

        // -- Filter out zero-quantity items --
        normalizedItems = normalizedItems.filter(item => item.quantity > 0);
        console.log("✅ Normalized Items (after filter):", normalizedItems);

        if (normalizedItems.length === 0) {
            return res.status(400).json({
                error: 'No valid items',
                details: 'All items had quantity <= 0 or items array was empty'
            });
        }

        // ============================================================
        // 💰 STEP 3: PRICE LOOKUP (Self-Contained Fallback)
        // ============================================================
        const PRICE_MAP: Record<string, number> = {
            'standard_set': 60,
            'standard set': 60,
            'standard set (rice+curry)': 60,
            'royal_set': 75,
            'royal set': 75,
            'royal set (all included)': 75,
            'std_balachaung': 65,
            'standard + balachaung': 65,
            'std_soup': 70,
            'standard + soup': 70,
            'extra_chicken': 25,
            'extra chicken': 25,
            'extra_rice': 10,
            'extra rice': 10,
            'extra_balachaung': 10,
            'extra balachaung': 10,
        };

        // Apply prices from PRICE_MAP if unit_price is 0
        normalizedItems = normalizedItems.map(item => {
            if (item.unit_price === 0) {
                const lookupKey = item.item_name.toLowerCase();
                const foundPrice = PRICE_MAP[lookupKey] || 0;
                console.log(`💵 Price lookup for "${item.item_name}": ${foundPrice}`);
                return { ...item, unit_price: foundPrice };
            }
            return item;
        });

        // Calculate total on server
        const totalAmount = normalizedItems.reduce((sum, item) => {
            return sum + (item.quantity * item.unit_price);
        }, 0);

        console.log("💰 Calculated Total Amount:", totalAmount);

        // ============================================================
        // 🗄️ STEP 4: TRANSACTION EXECUTION (Wrapped in try-catch)
        // ============================================================
        try {
            const orderData = {
                customerName: customerName,
                customerPhone: customerPhone,
                deliveryDate: deliveryDate,
                deliveryAddress: deliveryAddress || null,
                depositPaid: depositPaid,
                totalAmount: totalAmount,
                status: 'confirmed' as const,
                createdAt: new Date().toISOString()
            };

            const [newOrder] = await db.insert(cateringOrders).values(orderData).returning();

            if (normalizedItems.length > 0) {
                const itemsToInsert = normalizedItems.map((item: any) => ({
                    cateringOrderId: newOrder.id,
                    itemName: item.item_name || item.itemName || 'Unknown',
                    quantity: item.quantity || 0,
                    unitPrice: item.unit_price || item.unitPrice || 0,
                    totalPrice: (item.quantity || 0) * (item.unit_price || item.unitPrice || 0),
                    isAddon: Boolean(item.is_addon || item.isAddon),
                }));

                await db.insert(cateringItems).values(itemsToInsert);
            }

            const result = { orderId: newOrder.id, items: normalizedItems };
            res.status(201).json(result);

        } catch (dbError: any) {
            // ============================================================
            // 💥 CRITICAL DB ERROR HANDLER
            // ============================================================
            console.error("💥 CRITICAL DB ERROR:", dbError);
            return res.status(500).json({
                error: 'Database transaction failed',
                message: dbError.message || 'Unknown DB error',
                details: dbError.toString()
            });
        }

    } catch (error: any) {
        // ============================================================
        // ⚠️ GENERAL ERROR HANDLER (Outer catch)
        // ============================================================
        console.error("💥 UNEXPECTED ERROR in catering order creation:", error);
        return res.status(500).json({
            error: 'Failed to process catering order',
            message: error.message || 'Unknown error',
            details: error.toString()
        });
    }
});

// DELETE /api/catering/orders/:id - Delete Order
router.delete('/orders/:id', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid ID' });

        // Delete items first (foreign key constraint)
        await db.delete(cateringItems).where(eq(cateringItems.cateringOrderId, orderId));

        // Delete order
        await db.delete(cateringOrders).where(eq(cateringOrders.id, orderId));

        console.log(`✅ Deleted catering order ${orderId}`);
        res.json({ success: true, message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting catering order:', error);
        res.status(500).json({ error: 'Failed to delete order' });
    }
});

// PUT /api/catering/orders/:id - Update Order
router.put('/orders/:id', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid ID' });

        const { customerName, customerPhone, deliveryDate, deliveryAddress, depositPaid, items } = req.body;

        console.log(`🔄 Updating catering order ${orderId}:`, { customerName, itemCount: items?.length });

        // Transaction: Update order + replace items
        const result = db.transaction((tx) => {
            // 1. Delete old items
            tx.delete(cateringItems).where(eq(cateringItems.cateringOrderId, orderId)).run();

            // 2. Calculate new total
            const totalAmount = items.reduce((sum: number, item: any) =>
                sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);

            // 3. Update order
            const updatedOrderArray = tx.update(cateringOrders)
                .set({
                    customerName,
                    customerPhone,
                    deliveryDate,
                    deliveryAddress: deliveryAddress || null,
                    depositPaid: depositPaid || 0,
                    totalAmount
                })
                .where(eq(cateringOrders.id, orderId))
                .returning()
                .all();

            const updatedOrder = updatedOrderArray[0];

            // 4. Insert new items (filter out zero quantities)
            const validItems = items.filter((item: any) => (item.quantity || 0) > 0);
            if (validItems.length > 0) {
                tx.insert(cateringItems).values(
                    validItems.map((item: any) => ({
                        cateringOrderId: orderId,
                        itemName: item.itemName,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.quantity * item.unitPrice,
                        isAddon: item.isAddon || false
                    }))
                ).run();
            }

            return updatedOrder;
        });

        console.log(`✅ Updated catering order ${orderId}`);
        res.json(result);
    } catch (error) {
        console.error('Error updating catering order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// PATCH /api/catering/orders/:id/status - Update Status (with optional Proof of Delivery)
router.patch('/orders/:id/status', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const { status, proofImageUrl, paymentSlipUrl } = req.body;

        // Validate status
        const validStatuses = ['draft', 'confirmed', 'cooking', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status', validStatuses });
        }

        if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid ID' });

        // Build update object
        const updateData: any = { status };

        // If proof images provided (base64), convert to files
        if (proofImageUrl || paymentSlipUrl) {
            const uploadDir = path.join(process.cwd(), 'public/uploads/delivery-proofs');
            await fs.mkdir(uploadDir, { recursive: true });

            if (proofImageUrl && proofImageUrl.startsWith('data:image')) {
                const matches = proofImageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
                if (matches) {
                    const ext = matches[1];
                    const base64Data = matches[2];
                    const filename = `catering-proof-${orderId}-${Date.now()}.${ext}`;
                    const filepath = path.join(uploadDir, filename);

                    await fs.writeFile(filepath, Buffer.from(base64Data, 'base64'));
                    updateData.proofImageUrl = `/uploads/delivery-proofs/${filename}`;
                }
            }

            if (paymentSlipUrl && paymentSlipUrl.startsWith('data:image')) {
                const matches = paymentSlipUrl.match(/^data:image\/(\w+);base64,(.+)$/);
                if (matches) {
                    const ext = matches[1];
                    const base64Data = matches[2];
                    const filename = `catering-slip-${orderId}-${Date.now()}.${ext}`;
                    const filepath = path.join(uploadDir, filename);

                    await fs.writeFile(filepath, Buffer.from(base64Data, 'base64'));
                    updateData.paymentSlipUrl = `/uploads/delivery-proofs/${filename}`;
                }
            }
        }

        const [updatedOrder] = await db
            .update(cateringOrders)
            .set(updateData)
            .where(eq(cateringOrders.id, orderId))
            .returning();

        if (!updatedOrder) return res.status(404).json({ error: 'Order not found' });

        res.json(updatedOrder);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation Error', details: error.errors });
        }
        console.error('Error updating catering order status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// GET /api/catering/production-report - Aggregated Production Data
router.get('/production-report', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date || typeof date !== 'string') {
            return res.status(400).json({ error: 'Date parameter is required (YYYY-MM-DD)' });
        }

        // Fetch orders for the specific date
        // Note: Using startsWith for ISO date string matching "YYYY-MM-DD"
        // In a real app with more load, this should be a DB range query.
        const allOrders = await db.select().from(cateringOrders)
            .where(eq(cateringOrders.status, 'confirmed')) // Only confirmed orders
            .orderBy(desc(cateringOrders.deliveryDate));

        const dayOrders = allOrders.filter(o => o.deliveryDate.startsWith(date));

        const ordersWithItems = await Promise.all(dayOrders.map(async (order) => {
            const items = await db.select().from(cateringItems).where(eq(cateringItems.cateringOrderId, order.id));
            return { ...order, items };
        }));

        // Calculate Totals based on Flexible Keyword Detection
        // Supports both English and Burmese (Myanmar) localized item names
        const totals = {
            chicken: 0,
            rice: 0,
            balachaung: 0,
            soup: 0
        };

        console.log(`📊 [PRODUCTION-REPORT] Calculating totals for ${date}...`);
        console.log(`📦 Processing ${ordersWithItems.length} confirmed orders`);

        ordersWithItems.forEach(order => {
            order.items.forEach(item => {
                const name = (item.itemName || '').toLowerCase();
                const qty = item.quantity;

                console.log(`   Item: "${item.itemName}" (qty: ${qty})`);

                // Helper function to check if item name contains any of the keywords
                const containsAny = (...keywords: string[]) =>
                    keywords.some(kw => name.includes(kw.toLowerCase()));

                // ============================================================
                // CHICKEN CALCULATION
                // ============================================================
                // Count chicken for:
                // - Standard Set (သာမန်ပွဲ / ထမင်း+ဟင်း)
                // - Royal Set (ရှယ်ပွဲ / အစုံ)
                // - Standard + Balachaung (သာမန် + ငပိကြော်)
                // - Standard + Soup (သာမန် + ဟင်းရည်)
                // - Extra Chicken (ကြက်သားသီးသန့်)
                if (containsAny('standard', 'သာမန်', 'ထမင်း+ဟင်း', 'royal', 'ရှယ်', 'အစုံ', 'chicken', 'ကြက်သား')) {
                    totals.chicken += qty;
                    console.log(`     ✓ Added ${qty} to CHICKEN (total: ${totals.chicken})`);
                }

                // ============================================================
                // RICE CALCULATION
                // ============================================================
                // Count rice for:
                // - Standard Set (သာမန်ပွဲ / ထမင်း+ဟင်း)
                // - Royal Set (ရှယ်ပွဲ / အစုံ)
                // - Standard + Balachaung (သာမန် + ငပိကြော်)
                // - Standard + Soup (သာမန် + ဟင်းရည်)
                // - Extra Rice (ထမင်းသီးသန့်)
                if (containsAny('standard', 'သာမန်', 'ထမင်း+ဟင်း', 'royal', 'ရှယ်', 'အစုံ', 'rice', 'ထမင်း')) {
                    totals.rice += qty;
                    console.log(`     ✓ Added ${qty} to RICE (total: ${totals.rice})`);
                }

                // ============================================================
                // BALACHAUNG CALCULATION
                // ============================================================
                // Count balachaung for:
                // - Royal Set (ရှယ်ပွဲ / အစုံ)
                // - Standard + Balachaung (သာမန် + ငပိကြော်)
                // - Extra Balachaung (ငပိကြော်သီးသန့်)
                if (containsAny('royal', 'ရှယ်', 'အစုံ', 'balachaung', 'ငပိကြော်')) {
                    totals.balachaung += qty;
                    console.log(`     ✓ Added ${qty} to BALACHAUNG (total: ${totals.balachaung})`);
                }

                // ============================================================
                // SOUP CALCULATION
                // ============================================================
                // Count soup for:
                // - Royal Set (ရှယ်ပွဲ / အစုံ)
                // - Standard + Soup (သာမန် + ဟင်းရည်)
                if (containsAny('royal', 'ရှယ်', 'အစုံ', 'soup', 'ဟင်းရည်')) {
                    totals.soup += qty;
                    console.log(`     ✓ Added ${qty} to SOUP (total: ${totals.soup})`);
                }
            });
        });

        console.log(`✅ [PRODUCTION-REPORT] Final Totals:`, totals);


        res.json({
            date,
            totals,
            orders: ordersWithItems
        });

    } catch (error) {
        console.error('Error generating production report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// GET /api/catering/products - Fetch all products (Seed if empty)
router.get('/products', async (req, res) => {
    try {
        const products = await db.select().from(cateringProducts);

        if (products.length === 0) {
            // Seed defaults
            const defaults = [
                { key: 'standard_set', label: 'Standard Set (Rice+Curry)', price: 60 },
                { key: 'royal_set', label: 'Royal Set (All Included)', price: 75 },
                { key: 'std_balachaung', label: 'Standard + Balachaung', price: 65 },
                { key: 'std_soup', label: 'Standard + Soup', price: 70 },
                { key: 'extra_chicken', label: 'Extra Chicken', price: 25 },
                { key: 'extra_rice', label: 'Extra Rice', price: 10 },
                { key: 'extra_balachaung', label: 'Extra Balachaung', price: 10 },
            ];

            const seeded = await db.insert(cateringProducts).values(defaults).returning();
            return res.json(seeded);
        }

        res.json(products);
    } catch (error) {
        console.error('Error fetching catering products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// PUT /api/catering/products/:key - Update Price
router.put('/products/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const { price } = z.object({ price: z.number().min(0) }).parse(req.body);

        const [updated] = await db
            .update(cateringProducts)
            .set({ price })
            .where(eq(cateringProducts.key, key))
            .returning();

        if (!updated) return res.status(404).json({ error: 'Product not found' });

        res.json(updated);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation Error' });
        }
        console.error('Error updating product price:', error);
        res.status(500).json({ error: 'Failed to update price' });
    }
});


// PUT /api/catering/orders/:id/location - Update Driver GPS
router.put('/orders/:id/location', async (req, res) => {
    try {
        const { id } = req.params;
        const { lat, lng } = req.body;

        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        console.log(`📍 [CATERING GPS] Order ${id}: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

        const [updated] = await db
            .update(cateringOrders)
            .set({
                driverLat: lat,
                driverLng: lng,
                locationUpdatedAt: new Date().toISOString()
            })
            .where(eq(cateringOrders.id, Number(id)))
            .returning();

        if (!updated) return res.status(404).json({ error: 'Order not found' });

        res.json({ success: true, lat, lng });
    } catch (error) {
        console.error('Error updating GPS:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

export default router;
