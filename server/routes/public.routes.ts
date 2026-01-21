import { Router } from 'express';
import { storage } from '../storage';
import { publicOrderSchema, sales } from '../../shared/schema';
import { db } from '../lib/db';
import { eq } from 'drizzle-orm';
import { cache, CACHE_KEYS, CACHE_TTL } from '../lib/cache';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Configure multer for payment slip uploads
const uploadConfig = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'public/uploads/payment-slips');
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `slip-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: uploadConfig,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

/**
 * POST /api/public/verify-rider-pin
 * Verify the rider PIN for delivery app access
 * No authentication required
 */
router.post('/verify-rider-pin', async (req, res) => {
  try {
    const { pin } = req.body;
    // Use cached settings for PIN verification
    const settings = await cache.getOrFetch(
      CACHE_KEYS.APP_SETTINGS,
      () => storage.getAppSettings(),
      CACHE_TTL.VERY_LONG
    );
    const correctPin = settings.riderPin || '8888';

    console.log("[AUTH-DEBUG] Entered PIN:", pin, "Stored PIN:", correctPin);

    if (String(pin) === String(correctPin)) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Invalid PIN' });
    }
  } catch (error) {
    console.error('Error verifying rider PIN:', error);
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
});

/**
 * GET /api/public/menu
 * Get all menu items for the public lunch menu
 * Returns: dailySpecials (flagged items) + standardMenu (all other in-stock products)
 * No authentication required
 */
router.get('/menu', async (req, res) => {
  try {
    const businessUnitId = typeof req.query.businessUnitId === 'string' ? req.query.businessUnitId : undefined;

    // Get flagged items
    const dailySpecials = await storage.getDailySpecials(businessUnitId);
    const flaggedStandardItems = await storage.getStandardMenuItems(businessUnitId);

    // Get ALL products with stock > 0 as fallback for standard menu (cached)
    const allProducts = await cache.getOrFetch(
      CACHE_KEYS.PRODUCTS,
      () => storage.getProducts(),
      CACHE_TTL.MEDIUM
    );
    const dailySpecialIds = new Set(dailySpecials.map(p => p.id));
    const flaggedStandardIds = new Set(flaggedStandardItems.map(p => p.id));

    // Filter: active, in-stock, matching businessUnit (if provided), not already a daily special
    const standardItems = allProducts.filter(p => {
      if (p.status !== 'active' || p.stock <= 0) return false;
      if (dailySpecialIds.has(p.id)) return false; // Don't duplicate daily specials
      if (businessUnitId && p.businessUnitId !== businessUnitId) return false;
      return true;
    });

    // Map function to format product for public display
    const formatProduct = (product: any, isSpecial: boolean) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      imageData: product.imageData,
      category: product.category,
      unit: product.unit,
      stock: product.stock,
      specialStock: product.specialStock,
      isDailySpecial: isSpecial,
      isStandardMenu: !isSpecial,
    });

    // Return structured menu with both sections
    res.json({
      dailySpecials: dailySpecials.map(p => formatProduct(p, true)),
      standardMenu: standardItems.map(p => formatProduct(p, false)),
    });
  } catch (error) {
    console.error('Error fetching public menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

/**
 * GET /api/public/settings
 * Get public store settings (name, payment info, etc.)
 * No authentication required
 */
router.get('/settings', async (req, res) => {
  try {
    // Use cached settings
    const settings = await cache.getOrFetch(
      CACHE_KEYS.APP_SETTINGS,
      () => storage.getAppSettings(),
      CACHE_TTL.VERY_LONG
    );

    // Return only public-safe settings
    res.json({
      storeName: settings.storeName,
      storeAddress: settings.storeAddress,
      storePhone: settings.storePhone,
      storeLogoUrl: settings.storeLogoUrl,
      mobilePaymentQrUrl: settings.mobilePaymentQrUrl,
      currencyCode: settings.currencyCode,
      currencySymbol: settings.currencySymbol,
      currencyPosition: settings.currencyPosition,
    });
  } catch (error) {
    console.error('Error fetching public settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * GET /api/public/business-units
 * Get list of business units for store selection
 * No authentication required
 */
router.get('/business-units', async (req, res) => {
  try {
    // Use cached business units
    const businessUnits = await cache.getOrFetch(
      CACHE_KEYS.BUSINESS_UNITS,
      () => storage.getBusinessUnits(),
      CACHE_TTL.LONG // 5 minutes
    );

    // Return only necessary fields
    const publicUnits = businessUnits.map(bu => ({
      id: bu.id,
      name: bu.name,
      type: bu.type,
    }));

    res.json(publicUnits);
  } catch (error) {
    console.error('Error fetching business units:', error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

/**
 * POST /api/public/upload-slip
 * Upload payment slip image
 * No authentication required
 */
router.post('/upload-slip', upload.single('paymentSlip'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/payment-slips/${req.file.filename}`;
    res.json({ url: fileUrl });
  } catch (error) {
    console.error('Error uploading payment slip:', error);
    res.status(500).json({ error: 'Failed to upload payment slip' });
  }
});

/**
 * POST /api/public/orders
 * Create a new delivery order from the public menu
 * No authentication required
 */
router.post('/orders', async (req, res) => {
  try {
    // Handle base64 payment proof if provided in body
    let paymentProofUrl = req.body.paymentProofUrl;

    // If paymentProof is base64, save it as a file
    if (req.body.paymentProof && req.body.paymentProof.startsWith('data:image')) {
      const base64Data = req.body.paymentProof.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `slip-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
      const uploadPath = path.join(process.cwd(), 'public/uploads/payment-slips');
      await fs.mkdir(uploadPath, { recursive: true });
      await fs.writeFile(path.join(uploadPath, filename), buffer);
      paymentProofUrl = `/uploads/payment-slips/${filename}`;
    }

    // Validate the order data
    const orderData = {
      ...req.body,
      paymentProofUrl,
    };

    const parsed = publicOrderSchema.safeParse(orderData);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid order data',
        details: parsed.error.errors
      });
    }

    const { customerName, customerPhone, deliveryAddress, items, businessUnitId, orderType, tableNumber } = parsed.data;

    // Validate that all products exist and have stock (use cached products)
    const products = await cache.getOrFetch(
      CACHE_KEYS.PRODUCTS,
      () => storage.getProducts(),
      CACHE_TTL.MEDIUM
    );
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        return res.status(400).json({ error: `Product not found: ${item.productName}` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for ${item.productName}. Available: ${product.stock}`
        });
      }
    }

    // Get or create the online customer
    const onlineCustomer = await storage.getOrCreateOnlineCustomer(businessUnitId);

    // Calculate totals (use cached settings)
    const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
    const settings = await cache.getOrFetch(
      CACHE_KEYS.APP_SETTINGS,
      () => storage.getAppSettings(),
      CACHE_TTL.VERY_LONG
    );
    const tax = settings.enableTax ? (subtotal * (settings.taxPercentage / 100)) : 0;
    const total = subtotal + tax;

    // Determine the actual order type (default to delivery if not specified)
    const finalOrderType = orderType || 'delivery';
    const isDineIn = finalOrderType === 'dine-in';

    console.log(`[PUBLIC-ORDER] Creating ${finalOrderType} order${tableNumber ? ` for table ${tableNumber}` : ''}`);

    // Create the sale/order
    const sale = storage.createSale({
      items,
      subtotal,
      discount: 0,
      tax,
      total,
      paymentMethod: 'mobile', // Default to mobile payment for online orders
      paymentStatus: 'pending' as any, // Pending until cashier manually verifies against SMS
      orderType: finalOrderType,
      tableNumber: tableNumber || undefined,
      customerId: onlineCustomer.id,
      customerName,
      customerPhone: customerPhone || undefined,
      deliveryAddress: deliveryAddress || undefined,
      paymentProofUrl,
      paymentSlipUrl: paymentProofUrl, // Populate both fields for compatibility
      businessUnitId,
      requestedDeliveryTime: (req.body as any).requestedDeliveryTime,
      createdBy: isDineIn ? `Table ${tableNumber} Order` : 'Online Order',
      timestamp: new Date().toISOString(),
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      orderId: sale.id,
      message: isDineIn ? `Order placed for Table ${tableNumber}!` : 'Order placed successfully!',
      order: {
        id: sale.id,
        customerName,
        customerPhone,
        deliveryAddress,
        tableNumber,
        orderType: finalOrderType,
        items: sale.items,
        total: sale.total,
        timestamp: sale.timestamp,
      }
    });
  } catch (error) {
    console.error('Error creating public order:', error);
    const message = error instanceof Error ? error.message : 'Failed to create order';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/public/delivery-orders
 * Get delivery orders for the rider app
 * Returns all orders where orderType === 'delivery' AND status !== 'delivered'
 * No authentication required - for delivery riders
 */
router.get('/delivery-orders', async (req, res) => {
  try {
    const allSales = await storage.getSales();

    // Filter for delivery orders that are NOT delivered
    const deliveryOrders = allSales
      .filter(sale => {
        return sale.orderType === 'delivery' && sale.status !== 'delivered';
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .map(sale => ({
        id: sale.id,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        deliveryAddress: sale.deliveryAddress,
        orderType: sale.orderType,
        items: sale.items.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
        })),
        total: sale.total,
        timestamp: sale.timestamp,
        status: sale.status,
        paymentStatus: sale.paymentStatus,
        requestedDeliveryTime: sale.requestedDeliveryTime,
      }));

    console.log("[FINAL-DEBUG] Sending", deliveryOrders.length, "orders to Rider App");
    res.json(deliveryOrders);
  } catch (error) {
    console.error('Error fetching delivery orders:', error);
    res.status(500).json({ error: 'Failed to fetch delivery orders' });
  }
});

/**
 * POST /api/public/delivery-orders/:id/delivered
 * Mark an order as delivered (for rider app)
 * No authentication required - for delivery riders
 */
router.post('/delivery-orders/:id/delivered', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify the order exists
    const order = await storage.getSale(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update the order status to delivered
    await storage.updateSaleStatus(id, 'delivered');

    console.log(`[DELIVERY-APP] Order ${id} marked as delivered`);

    res.json({
      success: true,
      orderId: id,
      status: 'delivered'
    });
  } catch (error) {
    console.error('Error marking order as delivered:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

/**
 * PUT /api/public/delivery-orders/:id/status
 * Update order status (e.g. out_for_delivery) with optional proof images
 */
router.put('/delivery-orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, proofImageUrl, paymentSlipUrl } = req.body;

    if (!['out_for_delivery', 'delivered'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await storage.updateSaleStatus(id, status);

    // If proof images provided (base64), convert to files and save
    if (proofImageUrl || paymentSlipUrl) {
      const uploadDir = path.join(process.cwd(), 'public/uploads/delivery-proofs');
      await fs.mkdir(uploadDir, { recursive: true });

      const updates: any = {};

      if (proofImageUrl && proofImageUrl.startsWith('data:image')) {
        // Extract base64 data
        const matches = proofImageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1];
          const base64Data = matches[2];
          const filename = `proof-${id}-${Date.now()}.${ext}`;
          const filepath = path.join(uploadDir, filename);

          await fs.writeFile(filepath, Buffer.from(base64Data, 'base64'));
          updates.paymentProofUrl = `/uploads/delivery-proofs/${filename}`;
        }
      }

      if (paymentSlipUrl && paymentSlipUrl.startsWith('data:image')) {
        const matches = paymentSlipUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1];
          const base64Data = matches[2];
          const filename = `slip-${id}-${Date.now()}.${ext}`;
          const filepath = path.join(uploadDir, filename);

          await fs.writeFile(filepath, Buffer.from(base64Data, 'base64'));
          updates.paymentSlipUrl = `/uploads/delivery-proofs/${filename}`;
        }
      }

      if (Object.keys(updates).length > 0) {
        await db.update(sales)
          .set(updates)
          .where(eq(sales.id, id));
      }
    }

    console.log(`[DELIVERY-APP] Order ${id} status updated to ${status}`);

    res.json({ success: true, status });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

/**
 * PUT /api/public/delivery-orders/:id/location
 * Update driver GPS location for an order
 * No authentication required - for delivery riders
 */
router.put('/delivery-orders/:id/location', async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    console.log(`📍 [GPS] Order ${id}: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

    // Update the order with driver location
    const updated = await storage.updateSaleLocation(id, lat, lng);

    if (!updated) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ success: true, lat, lng });
  } catch (error) {
    console.error('Error updating driver location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

export default router;
