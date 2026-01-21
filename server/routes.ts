import type { Express } from "express";
import { type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { db } from "./lib/db";
import { eq, sql, desc } from "drizzle-orm";
import {
  insertExpenseSchema,
  appSettingsSchema,
  type Alert,
  restaurantTables,
  kitchenTickets,
  tables,
  paymentBuffers,
  smsLogs,
  staff,
  sales,
  expenses,
  products
} from "../shared/schema";
import {
  getAllCustomerRiskAnalysis,
  getProfitLossReport
} from "./lib/ai-engine";
import {
  askGeminiAboutBusiness,
  verifyPaymentSlip,
  generateReportSummary,
  analyzeSystemHealth
} from "./lib/gemini";
import { cache, CACHE_KEYS, CACHE_TTL } from './lib/cache';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import aiRouter from './routes/ai';
import authRouter from './routes/auth.routes';
import productRouter from './routes/product.routes';
import customerRouter from './routes/customer.routes';
import salesRouter from './routes/sales.routes';
import staffRouter from './routes/staff.routes';
import inventoryRouter from './routes/inventory.routes';
import scanRouter from './routes/scan.routes';
import attendanceRouter from './routes/attendance.routes';
import shiftsRouter from './routes/shifts.routes';
import creditLedgerRouter from './routes/credit-ledger.routes';
import ledgerRouter from './routes/ledger.routes';
import kitchenTicketsRouter from './routes/kitchen-tickets.routes';
import categoriesRouter from './routes/categories.routes';
import publicRouter from './routes/public.routes';
import deliveryRouter from './routes/delivery.routes';
import systemRouter from './routes/system.routes'; // 🚨 EMERGENCY: Health check endpoint
import cateringRouter from './routes/catering.routes';
import adminRouter from './routes/admin.routes';
import customerAuthRouter from './routes/customer-auth.routes';
import customerPortalRouter from './routes/customer-portal.routes';
import { isAuthenticated, requireAdmin, requireManager, requireRole } from './middleware/auth';

const storageConfig = multer.diskStorage({
  destination: async (req, file, cb) => {
    // FIX: Use process.cwd() for consistent path resolution
    const uploadPath = path.join(process.cwd(), 'public/uploads');
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedOriginalName}`);
  }
});

const upload = multer({ storage: storageConfig });
const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {


  // 🚨 REGISTER ROUTERS
  app.use('/api/customer', customerAuthRouter);
  app.use('/api/customer', customerPortalRouter);

  app.use('/api/kitchen-tickets', kitchenTicketsRouter);
  app.use('/api/system', systemRouter);
  app.use('/api/system', systemRouter);
  app.use('/api/catering', cateringRouter);
  app.use('/api/admin', adminRouter);

  await storage.initialize();

  // PRODUCTION GUARD: Auto-clock-in is ONLY for development convenience
  // This block will NOT execute in production (NODE_ENV === 'production')
  if (process.env.NODE_ENV !== 'production') {
    try {
      const current = await storage.getCurrentShift();
      if (!current.isActive) {
        const staff = await storage.getStaff();
        const admin = staff.find((s) => s.pin === '0000' || s.role === 'owner');
        if (admin) {
          await storage.clockIn(admin.id, admin.name);
          console.log('[DEV ONLY] Auto clocked in:', admin.name);
        }
      }

      // Check for delivery orders and seed if empty
      const sales = await storage.getSales();
      const hasDelivery = sales.some(s => s.orderType === 'delivery');
      if (!hasDelivery) {
        console.log('[DEV ONLY] Seeding dummy delivery order...');
        const onlineCustomer = await storage.getOrCreateOnlineCustomer('default'); // Assuming default or first BU
        await storage.createSale({
          items: [
            { productId: 'seed-1', productName: 'Rider Test Burger', quantity: 2, unitPrice: 5000, total: 10000 }
          ],
          subtotal: 10000,
          discount: 0,
          tax: 0,
          total: 10000,
          paymentMethod: 'mobile',
          paymentStatus: 'paid',
          orderType: 'delivery',
          customerId: onlineCustomer.id,
          customerName: 'Rider Test',
          customerPhone: '09123456789',
          deliveryAddress: '123 Test Road, Yangon',
          businessUnitId: sales[0]?.businessUnitId || 'bu-default', // Fallback
          createdBy: 'System Seed',
          timestamp: new Date().toISOString(),
          status: 'paid',
          requestedDeliveryTime: '12:00',
        });
        console.log('[DEV ONLY] Dummy delivery order created.');
      }
    } catch (err) {
      console.error('[DEV ONLY] Auto-clock-in failed:', err);
    }
  }

  // Force allow access to lunch-menu without login (User Requested Override)
  app.get("/lunch-menu", (req: any, res: any, next: any) => {
    // Force allow access to lunch-menu without login
    next();
  });

  app.get("/api/products", (req: any, res: any, next: any) => {
    // Force allow access to products for the menu
    next();
  });

  // Dedicated Public Menu Endpoint (No Auth) - User Requested "Nuclear Option"
  app.get("/api/public/menu-items", async (req: any, res: any) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching public menu items:", error);
      res.status(500).json({ error: "Failed to fetch menu items" });
    }
  });

  // ============================================================
  // Thermal Printer Logic (Hardware Specialist)
  // ============================================================
  app.post("/api/printer/print-raw", async (req: any, res: any) => {
    try {
      const { data, printerIp } = req.body;

      if (!data) return res.status(400).json({ error: "No print data" });

      // Decode Base64 to Buffer
      const buffer = Buffer.from(data, 'base64');

      console.log(`🖨️ [PRINTER] Sent ${buffer.length} bytes to ${printerIp || 'Default'}`);
      console.log(`   (Hex: ${buffer.subarray(0, 20).toString('hex')}...)`);

      // TODO: Real Implementation with net.connect for Network Printers
      // const client = new net.Socket();
      // client.connect(9100, printerIp, () => client.write(buffer, () => client.destroy()));

      res.json({ success: true, mocked: true });
    } catch (error) {
      console.error("Print Error:", error);
      res.status(500).json({ error: "Print failed" });
    }
  });

  // ============================================================
  // Real-time Cart Add Endpoint for QR Table Ordering
  // No Auth - Called by customer's phone when adding items
  // ============================================================
  app.post("/api/cart/add", async (req: any, res: any) => {
    try {
      const { tableId, tableNumber, productId, productName, quantity, unitPrice, businessUnitId } = req.body;

      console.log("[CART-ADD] Received:", { tableId, tableNumber, productId, productName, quantity });

      if (!productId || !quantity) {
        return res.status(400).json({ error: "Missing required fields: productId, quantity" });
      }

      // 🔍 Stock Validation
      const product = await db.select().from(products).where(eq(products.id, productId)).get();
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Check stock based on item type (Special vs Regular)
      const stockAvailable = product.isDailySpecial ? (product.specialStock ?? 0) : product.stock;

      if (stockAvailable < quantity || stockAvailable <= 0) {
        return res.status(400).json({ error: "Item is out of stock" });
      }

      // Determine table identifier
      const tableIdentifier = tableId || tableNumber;
      if (!tableIdentifier) {
        return res.status(400).json({ error: "Missing tableId or tableNumber" });
      }

      // Find or create table record
      const allTables = await storage.getTables();
      let tableRecord = allTables.find((t: any) =>
        String(t.id) === String(tableIdentifier) ||
        String(t.number) === String(tableIdentifier)
      );

      if (!tableRecord && tableNumber) {
        console.log("[CART-ADD] Creating new table record for:", tableNumber);
        const newTableId = crypto.randomUUID();
        await db.insert(tables).values({
          id: newTableId,
          number: String(tableNumber),
          capacity: 4,
          status: 'available',
          businessUnitId: businessUnitId || null,
          currentOrder: null,
          lastOrdered: null
        });
        const freshTables = await storage.getTables();
        tableRecord = freshTables.find((t: any) => t.id === newTableId);
      }

      if (!tableRecord) {
        return res.status(404).json({ error: "Table not found" });
      }

      // Get current cart from table or initialize empty array
      let currentCart: any[] = [];
      if (tableRecord.currentOrder) {
        try {
          const orderData = typeof tableRecord.currentOrder === 'string'
            ? JSON.parse(tableRecord.currentOrder)
            : tableRecord.currentOrder;
          currentCart = orderData.items || [];
        } catch (e) {
          currentCart = [];
        }
      }

      // Check if item already exists in cart
      const existingIndex = currentCart.findIndex((item: any) => item.productId === productId);

      if (existingIndex >= 0) {
        // Update quantity of existing item
        currentCart[existingIndex].quantity += quantity;
        currentCart[existingIndex].total = currentCart[existingIndex].quantity * currentCart[existingIndex].unitPrice;
      } else {
        // Add new item to cart
        currentCart.push({
          id: crypto.randomUUID(),
          productId,
          productName: productName || 'Unknown Item',
          name: productName || 'Unknown Item',
          quantity,
          unitPrice: unitPrice || 0,
          price: unitPrice || 0,
          total: (unitPrice || 0) * quantity
        });
      }

      // Calculate new total
      const cartTotal = currentCart.reduce((sum: number, item: any) => sum + (item.total || 0), 0);

      // Update table's current order
      const updatedOrder = JSON.stringify({ items: currentCart, total: cartTotal });
      await db.update(tables)
        .set({
          currentOrder: updatedOrder,
          status: 'occupied',
          lastOrdered: new Date().toISOString()
        })
        .where(eq(tables.id, tableRecord.id));

      console.log("[CART-ADD] Updated table cart:", {
        tableId: tableRecord.id,
        tableNumber: tableRecord.number,
        itemCount: currentCart.length,
        total: cartTotal
      });

      // Emit Socket.IO event for real-time POS update
      const io = (global as any).io;
      if (io) {
        io.emit('tableCartUpdated', {
          tableId: tableRecord.id,
          tableNumber: String(tableRecord.number),
          businessUnitId: tableRecord.businessUnitId,
          cart: currentCart,
          total: cartTotal,
          timestamp: new Date().toISOString()
        });
        console.log("[SOCKET] Emitted tableCartUpdated for table:", tableRecord.number);
      }

      res.json({
        success: true,
        tableId: tableRecord.id,
        tableNumber: tableRecord.number,
        cart: currentCart,
        total: cartTotal
      });

    } catch (error) {
      console.error("[CART-ADD] Error:", error);
      res.status(500).json({ error: "Failed to add item to cart" });
    }
  });

  // POST /api/public/orders - Create new order (Public/Guest)
  app.post("/api/public/orders", async (req: any, res: any) => {
    try {
      console.log("[DEBUG-ORDER] New Public Order Received (Guest/Table):", req.body);

      let {
        items,
        tableNumber,
        businessUnitId,
        customerName,
        customerPhone,
        deliveryAddress,
        paymentProofUrl,
        paymentMethod,
        paymentProof,
        isGuest, // Guest flag from frontend
        customerId, // Logged-in user's ID from frontend
        createAccountPassword // Password for in-checkout account creation
      } = req.body;

      // PRIORITY 1: Check for logged-in user from request body or session
      // If customerId is provided or exists in session, use it (NOT a guest order)
      let guestId = customerId || (req.session as any)?.customerId || (req.session as any)?.staffId || null;
      let phoneVerified = false;
      let newlyCreatedAccount = false;

      console.log('[PUBLIC-ORDER] Auth check:', {
        bodyCustomerId: customerId,
        sessionCustomerId: (req.session as any)?.customerId,
        sessionStaffId: (req.session as any)?.staffId,
        isGuest,
        hasPassword: !!createAccountPassword,
        resolvedGuestId: guestId
      });

      // PRIORITY 2: If createAccountPassword is provided, create a full account (not guest)
      if (createAccountPassword && customerPhone && !guestId) {
        try {
          const { scryptSync, randomBytes } = await import('crypto');

          // Generate salt and hash password
          const salt = randomBytes(16).toString('hex');
          const hash = scryptSync(createAccountPassword, salt, 64).toString('hex');
          const hashedPassword = `${salt}:${hash}`;

          const newUserId = crypto.randomUUID();
          const userName = customerName || `Customer ${customerPhone.slice(-4)}`;

          await db.insert(staff).values({
            id: newUserId,
            name: userName,
            pin: '0000',
            password: hashedPassword, // HASHED password, not plaintext!
            role: 'customer' as const,
            status: 'active' as const,
            isGuest: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          guestId = newUserId;
          newlyCreatedAccount = true;
          console.log(`[PUBLIC-ORDER] Created new account with hashed password: ${guestId}`);

          // Auto-login: Create session
          (req.session as any).staffId = guestId;
          (req.session as any).customerId = guestId;
          (req.session as any).role = 'customer';
          (req.session as any).isCustomer = true;
        } catch (err) {
          console.error('[PUBLIC-ORDER] Account creation error:', err);
        }
      }
      // PRIORITY 3: Only create guest user if explicitly flagged as guest AND no user ID found
      else if (isGuest && !guestId && customerPhone) {
        try {
          const { createGuestUser, findGuestByPhone } = await import('./lib/guestService');

          // Normalize phone
          const phone = customerPhone?.trim();
          if (phone) {
            let guestUser = await findGuestByPhone(phone);
            if (!guestUser) {
              guestUser = await createGuestUser({
                phone: phone,
                name: customerName
              });
              console.log(`[PUBLIC-ORDER] Created new guest user: ${guestUser.guestId}`);
            } else {
              console.log(`[PUBLIC-ORDER] Found existing guest user: ${guestUser.guestId}`);
            }
            guestId = guestUser.guestId;
            phoneVerified = true;
          }
        } catch (err) {
          console.error('[PUBLIC-ORDER] Guest service error:', err);
        }
      } else if (guestId) {
        console.log(`[PUBLIC-ORDER] Using logged-in user ID: ${guestId}`);
      }

      // Handle base64 payment proof (Preserve Delivery Functionality)
      if (paymentProof && typeof paymentProof === 'string' && paymentProof.startsWith('data:image')) {
        try {
          const base64Data = paymentProof.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const filename = `slip-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
          const uploadPath = path.join(process.cwd(), 'public/uploads/payment-slips');
          await fs.mkdir(uploadPath, { recursive: true });
          await fs.writeFile(path.join(uploadPath, filename), buffer);
          paymentProofUrl = `/uploads/payment-slips/${filename}`;
        } catch (e) {
          console.error("Error saving payment proof:", e);
        }
      }

      let orderId;
      let finalItems;
      let finalTotal;

      // DINE-IN ORDER (QR Code) - Integrate with Table Cart System
      if (tableNumber) {
        console.log("[QR-ORDER] Processing dine-in order for table:", tableNumber);

        // 1. Find or create table record
        const allTables = await storage.getTables();
        let tableRecord = allTables.find((t: any) =>
          String(t.number) === String(tableNumber) &&
          t.businessUnitId === businessUnitId
        );

        if (!tableRecord) {
          console.log("[QR-ORDER] Creating new table record for:", tableNumber);
          // Create table record using database directly
          const newTableId = crypto.randomUUID();
          await db.insert(tables).values({
            id: newTableId,
            number: String(tableNumber),
            capacity: 4,
            status: 'available',
            businessUnitId: businessUnitId,
            currentOrder: null,
            lastOrdered: null
          });

          // Fetch the newly created table
          const freshTables = await storage.getTables();
          tableRecord = freshTables.find((t: any) => t.id === newTableId);
        }

        // Ensure table record exists before proceeding
        if (!tableRecord) {
          throw new Error(`Failed to find or create table ${tableNumber}`);
        }

        // 2. Convert items to cart format
        const cart = items.map((i: any) => ({
          id: crypto.randomUUID(),
          productId: i.productId,
          productName: i.productName,
          name: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          price: i.unitPrice,
          total: i.total || i.unitPrice * i.quantity
        }));

        // 3. Use standard table ordering flow (same as waiters)
        const result = await storage.orderTableAndCreateKitchenTicket({
          businessUnitId,
          tableId: tableRecord.id,
          tableNumber: String(tableNumber),
          cart
        });

        // 4. Create sale record for financial tracking (UNIFIED with POS flow)
        const saleItems = items.map((i: any) => ({
          productId: i.productId,
          productName: i.productName || i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice || i.price,
          total: i.total || (i.unitPrice || i.price) * i.quantity
        }));

        const subtotal = saleItems.reduce((sum: number, i: any) => sum + i.total, 0);

        const sale = storage.createSale({
          items: saleItems,
          subtotal: subtotal,
          tax: 0,
          discount: 0,
          total: subtotal,
          paymentMethod: paymentMethod || 'cash',
          paymentStatus: 'unpaid', // QR orders are unpaid until cashier processes
          orderType: 'dine-in',
          tableNumber: String(tableNumber),
          customerName: customerName || `Table ${tableNumber}`,
          customerPhone: customerPhone || undefined,
          businessUnitId: businessUnitId,
          status: 'pending',
          createdBy: 'QR Menu',
          timestamp: new Date().toISOString(),
        });

        // 4b. Update with Guest Info if available
        if (guestId) {
          await db.update(sales)
            .set({ guestId, phoneVerified })
            .where(eq(sales.id, sale.id));
        }

        orderId = sale.id;
        finalItems = sale.items || saleItems;
        finalTotal = sale.total;

        // 5. Emit Socket.IO events for real-time updates
        const io = (global as any).io;
        if (io) {
          io.emit('newQROrder', {
            tableId: tableRecord.id,
            tableNumber: String(tableNumber),
            businessUnitId: businessUnitId,
            saleId: sale.id,
            items: finalItems,
            total: finalTotal,
            customerName: customerName || `Table ${tableNumber}`,
            orderSource: 'qr',
            timestamp: new Date().toISOString()
          });
        }
      }
      // DELIVERY ORDER
      else {
        const orderType = 'delivery';
        const paymentStatus = 'pending';

        const sale = storage.createSale({
          items: items,
          subtotal: items.reduce((sum: number, i: any) => sum + (i.total || i.unitPrice * i.quantity), 0),
          tax: 0,
          discount: 0,
          total: items.reduce((sum: number, i: any) => sum + (i.total || i.unitPrice * i.quantity), 0),
          paymentMethod: paymentMethod || 'mobile',
          paymentStatus: paymentStatus,
          orderType: orderType,
          customerName: customerName || 'Online Customer',
          customerPhone: customerPhone,
          deliveryAddress: deliveryAddress,
          paymentProofUrl: paymentProofUrl,
          businessUnitId: businessUnitId,
          status: 'pending',
          createdBy: 'Public Menu',
          timestamp: new Date().toISOString(),
        });

        // Update with Guest Info if available
        if (guestId) {
          await db.update(sales)
            .set({ guestId, phoneVerified })
            .where(eq(sales.id, sale.id));
        }

        orderId = sale.id;
        console.log("[DELIVERY-ORDER] Sale Created:", { orderId, orderType: sale.orderType });
      }

      res.json({
        success: true,
        orderId: orderId,
        guestId // Return guestId so frontend can prompt for password
      });

    } catch (error: any) {
      console.error("Error creating public order:", error);
      // Return 400 for stock issues
      if (error.message && error.message.includes("Insufficient")) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to create order", details: error.message, stack: error.stack });
    }
  });


  // POST /api/guest/convert - Convert Guest to Registered User
  app.post("/api/guest/convert", async (req: any, res: any) => {
    try {
      const { guestId, password } = req.body;

      if (!guestId || !password) {
        return res.status(400).json({ error: "Guest ID and Password are required" });
      }

      console.log(`[GUEST-CONVERT] Converting guest ID: ${guestId}`);

      // 1. Direct Lookup by ID (Robust)
      // Since guestId is now the UUID from the staff table
      const guestUser = await db.select().from(staff).where(eq(staff.id, guestId)).get();

      if (!guestUser) {
        console.warn(`[GUEST-CONVERT] Guest Profile Not Found: ${guestId}`);
        return res.status(404).json({ error: "Guest user profile not found" });
      }

      // 2. Update to Registered User
      await db.update(staff)
        .set({
          isGuest: false,
          password: password,
          // Keep role as is (likely 'cashier') or set to 'customer' if supported
          updatedAt: new Date().toISOString()
        })
        .where(eq(staff.id, guestId));

      console.log(`[GUEST-CONVERT] Success: ${guestUser.name} converted to registered user.`);

      res.json({ success: true, message: "Account created successfully" });

    } catch (error: any) {
      console.error("Error converting guest:", error);
      res.status(500).json({ error: "Failed to convert guest account", details: error.message });
    }
  });

  // Mount Modular Routers
  app.use('/api/ai', aiRouter);
  app.use('/api/auth', authRouter);

  // ============================================================
  // DIRECT PASSWORD INIT ROUTE (Bypasses auth router for reliability)
  // ============================================================
  app.get('/api/auth/init-passwords', async (req, res) => {
    try {
      const { or, eq } = await import('drizzle-orm');

      // Get all owners and managers
      const ownersAndManagers = db.select().from(staff)
        .where(or(eq(staff.role, "owner"), eq(staff.role, "manager")))
        .all();

      let updated = 0;
      for (const s of ownersAndManagers) {
        // Update password to 'admin123' for all owners/managers
        db.update(staff)
          .set({ password: "admin123", updatedAt: new Date().toISOString() })
          .where(eq(staff.id, s.id))
          .run();
        updated++;
        console.log(`✅ Set password 'admin123' for: ${s.name} (${s.role})`);
      }

      res.json({
        success: true,
        message: `Password set to 'admin123' for ${updated} owner/manager accounts`,
        accounts: ownersAndManagers.map(s => ({ name: s.name, role: s.role }))
      });
    } catch (error: any) {
      console.error("Error initializing passwords:", error);
      res.status(500).json({ error: error.message || "Failed to initialize passwords" });
    }
  });

  // Staff list for login selection (no auth required for login page)
  app.get('/api/auth/staff-list', async (req, res) => {
    try {
      const { eq, ne, and, notLike } = await import('drizzle-orm');

      const allStaff = db.select({
        id: staff.id,
        name: staff.name,
        role: staff.role,
        status: staff.status,
        businessUnitId: staff.businessUnitId,
      }).from(staff).where(and(
        eq(staff.status, "active"),
        ne(staff.role, "customer"),
        notLike(staff.name, "%Guest%"),
        notLike(staff.name, "%Test%"),
        notLike(staff.name, "%Customer%")
      )).all();

      res.json(allStaff);
    } catch (error: any) {
      console.error("Error fetching staff list:", error);
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });

  // Public routes (no authentication required) - MUST be before kitchen role isolation
  app.use('/api/public', publicRouter);
  app.use('/api/delivery', deliveryRouter);

  // ============================================================
  // Payment Buffer Check - Manual Verification Endpoint
  // ============================================================
  app.get('/api/public/check-payment-buffer', async (req, res) => {
    try {
      const amount = parseFloat(req.query.amount as string);

      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid amount parameter',
        });
      }

      console.log(`[PAYMENT-BUFFER] ========================================`);
      console.log(`[PAYMENT-BUFFER] Checking buffer for amount:`, amount);

      // Find matching payment in buffer (within last 15 minutes, ±2 tolerance)
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

      const buffers = await db
        .select()
        .from(paymentBuffers)
        .where(
          sql`${paymentBuffers.createdAt} > ${fifteenMinsAgo} 
              AND ${paymentBuffers.verified} = 0
              AND ABS(${paymentBuffers.amount} - ${amount}) <= 2`
        )
        .orderBy(desc(paymentBuffers.createdAt))
        .limit(1);

      console.log(`[PAYMENT-BUFFER] Found:`, buffers.length > 0 ? buffers[0] : 'NO MATCHING SMS');
      console.log(`[PAYMENT-BUFFER] ========================================`);

      if (buffers.length > 0) {
        const buffer = buffers[0];
        console.log(`[PAYMENT-BUFFER] ✓ Verification SUCCESS for amount: ${buffer.amount}`);

        return res.json({
          success: true,
          verified: true,
          amount: buffer.amount,
          transactionId: buffer.transactionId,
          message: 'Payment verified successfully',
        });
      }

      console.log(`[PAYMENT-BUFFER] No matching payment found for ${amount}`);
      return res.json({
        success: true,
        verified: false,
        message: 'SMS not received yet. Please wait and try again.',
      });

    } catch (error) {
      console.error('[PAYMENT-BUFFER] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  // ============================================================
  // SMS Webhook for Automated Payment Verification
  // External endpoint - no authentication (called by SMS automation)
  // ============================================================

  // Health check for external API
  app.get('/api/external/health', (req, res) => {
    console.log('[EXTERNAL-API] Health check accessed');
    res.json({ status: 'ok', endpoint: '/api/external', timestamp: new Date().toISOString() });
  });

  // GET endpoint for testing connectivity
  app.get('/api/external/sms-webhook', (req, res) => {
    console.log('[SMS-WEBHOOK] GET request received - endpoint is accessible');
    res.json({
      status: 'ok',
      message: 'SMS webhook endpoint is active. Use POST to send SMS data.',
      timestamp: new Date().toISOString()
    });
  });

  // Main POST endpoint for SMS processing
  app.post('/api/external/sms-webhook', async (req, res) => {
    // ============================================================
    // 📩 IMMEDIATE LOGGING - First thing before ANY processing
    // ============================================================
    console.log('\n\n');
    console.log('📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩');
    console.log('📩 SMS Webhook Received!');
    console.log('📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩📩');

    // Truncate long Base64 strings for logging
    const logBody = JSON.stringify(req.body, (key, value) => {
      if (typeof value === 'string' && value.length > 500) {
        return value.substring(0, 20) + '...[TRUNCATED_BASE64]...' + value.substring(value.length - 20);
      }
      return value;
    }, 2);

    console.log('Body:', logBody);
    console.log('\n');

    try {
      // Debug: Log EVERYTHING for troubleshooting
      console.log('[SMS-WEBHOOK] ==========================================');
      console.log('[SMS-WEBHOOK] ========== INCOMING SMS REQUEST ==========');
      console.log('[SMS-WEBHOOK] ==========================================');
      console.log('[SMS-WEBHOOK] Timestamp:', new Date().toISOString());
      console.log('[SMS-WEBHOOK] Content-Type:', req.headers['content-type']);
      console.log('[SMS-WEBHOOK] Raw body type:', typeof req.body);
      console.log('[SMS-WEBHOOK] Raw body:', JSON.stringify(req.body, null, 2));
      console.log('[SMS-WEBHOOK] All keys in body:', Object.keys(req.body || {}));

      // Try multiple possible field names from different SMS forwarder apps
      const message = req.body.message || req.body.text || req.body.body || req.body.sms || req.body.content || '';
      const sender = req.body.sender || req.body.from || req.body.number || req.body.phone || 'unknown';

      console.log('[SMS-WEBHOOK] Extracted sender:', sender);
      console.log('[SMS-WEBHOOK] Extracted message:', message);
      console.log('[SMS-WEBHOOK] Message length:', message.length);
      console.log('[SMS-WEBHOOK] Message char codes:', message.split('').slice(0, 20).map((c: string) => c.charCodeAt(0)));

      if (!message || typeof message !== 'string' || message.length === 0) {
        console.log('[SMS-WEBHOOK] ERROR: Missing or invalid message field');
        console.log('[SMS-WEBHOOK] TIP: Check SMS Forwarder app settings. Use variables like {{message}} or {{body}}');
        return res.status(400).json({
          success: false,
          reason: 'Missing or invalid message field',
          receivedBody: req.body,
          hint: 'Configure SMS Forwarder to send: {"message": "{{message}}", "sender": "{{from}}"}'
        });
      }

      // Check if message is literally an unreplaced template variable
      const unreplacedPatterns = [
        '%body%', '%msg%', '%message%', '%text%', '%sms%',
        '{{body}}', '{{msg}}', '{{message}}', '{{text}}', '{{sms}}',
        '[body]', '[msg]', '[message]', '[text]', '[sms]',
        '$body', '$msg', '$message', '$text', '$sms'
      ];

      const isUnreplacedVariable = unreplacedPatterns.some(p =>
        message.toLowerCase().trim() === p.toLowerCase() ||
        message.toLowerCase().includes(p.toLowerCase())
      );

      if (isUnreplacedVariable) {
        console.log('[SMS-WEBHOOK] ❌ ERROR: App variable not replaced!');
        console.log('[SMS-WEBHOOK] Received literal:', message);
        console.log('[SMS-WEBHOOK] ====================================');
        console.log('[SMS-WEBHOOK] FIX: In your SMS Forwarder app, the variable syntax is wrong.');
        console.log('[SMS-WEBHOOK] Common syntaxes to try:');
        console.log('[SMS-WEBHOOK]   - SMS Forwarder Pro: [text] or [body]');
        console.log('[SMS-WEBHOOK]   - Tasker: %SMSRB (SMS Recent Body)');
        console.log('[SMS-WEBHOOK]   - Automate: #sms_body');
        console.log('[SMS-WEBHOOK]   - MacroDroid: {sms_body}');
        console.log('[SMS-WEBHOOK] ====================================');
        return res.status(400).json({
          success: false,
          error: 'App variable not replaced',
          receivedMessage: message,
          fix: 'Your SMS Forwarder is sending the literal variable name instead of the SMS content. Check the app documentation for correct variable syntax.'
        });
      }

      // Parse amount from SMS message using multiple regex patterns
      // Priority: Thai Baht (KBank, etc.) > Myanmar Kyat > Generic numbers > ANY number
      const amountPatterns = [
        // === Thai Baht Patterns (KBank, SCB, etc.) ===
        // "500.00 Baht", "1,500.00 Baht", "received 500.00 Baht"
        /([\d,]+(?:\.\d{2})?)\s*(?:Baht|THB|บาท)/i,
        // "THB 500.00", "THB 1,500.00"
        /(?:THB|Baht|บาท)\s*([\d,]+(?:\.\d{2})?)/i,
        // "฿500.00", "฿1,500.00"
        /฿\s*([\d,]+(?:\.\d{2})?)/,
        // KBank specific patterns
        /(?:received|deposit(?:ed)?|transfer(?:red)?|credited|payment|amount|โอนเงิน|รับเงิน)\s*(?:of\s*)?([\d,]+(?:\.\d{2})?)/i,

        // === Myanmar Kyat Patterns ===
        /(?:cash\s*in|received|credited|deposited|transferred|payment|amount)[:\s]*(?:MMK|Ks|K)?\s*([\d,]+(?:\.\d{2})?)/i,
        /(?:MMK|Ks|K)\s*([\d,]+(?:\.\d{2})?)/i,
        /([\d,]+(?:\.\d{2})?)\s*(?:MMK|Ks|K)/i,

        // === Generic Patterns ===
        /(?:amount|total|sum)[:\s]*([\d,]+(?:\.\d{2})?)/i,

        // === FALLBACK: Any number with decimals (e.g., "500.00") ===
        /([\d,]+\.\d{2})/,

        // === LAST RESORT: Any number 3+ digits (e.g., "500", "1500") ===
        /(\d{3,})/,

        // === ULTRA FALLBACK: Any number 2+ digits (e.g., "50") ===
        /(\d{2,})/
      ];

      console.log('[SMS-WEBHOOK] Attempting to extract amount from message...');
      console.log('[SMS-WEBHOOK] Will try', amountPatterns.length, 'different patterns');

      let extractedAmount: number | null = null;
      let matchedPattern: string | null = null;

      for (let i = 0; i < amountPatterns.length; i++) {
        const pattern = amountPatterns[i];
        const match = message.match(pattern);
        if (match && match[1]) {
          // Remove commas and convert to number
          const amountStr = match[1].replace(/,/g, '');
          const parsed = parseFloat(amountStr);
          if (!isNaN(parsed) && parsed > 0) {
            extractedAmount = parsed;
            matchedPattern = pattern.toString();
            console.log(`[SMS-WEBHOOK] ✓ Pattern #${i + 1} matched: ${pattern}`);
            console.log(`[SMS-WEBHOOK] ✓ Raw match: "${match[1]}" -> ${parsed}`);
            break;
          }
        }
      }

      if (matchedPattern) {
        console.log(`[SMS-WEBHOOK] Successfully extracted amount using pattern: ${matchedPattern}`);
      }

      if (extractedAmount === null) {
        console.log('[SMS-WEBHOOK] Could not extract amount from message');
        console.log('[SMS-WEBHOOK] Message was:', message);
        console.log('[SMS-WEBHOOK] This might mean:');
        console.log('[SMS-WEBHOOK]   1. SMS Forwarder variables not resolving (check app settings)');
        console.log('[SMS-WEBHOOK]   2. Message format not recognized (send example SMS for debugging)');

        // ============================================================
        // AUDIT LOG: Store failed SMS for review
        // ============================================================
        try {
          await db.insert(smsLogs).values({
            id: crypto.randomUUID(),
            sender: sender,
            messageContent: message.substring(0, 500),
            extractedAmount: null,
            status: 'failed',
            createdAt: new Date().toISOString(),
          });
          console.log('[SMS-WEBHOOK] Failed SMS logged to sms_logs for audit');
        } catch (logError) {
          console.error('[SMS-WEBHOOK] Failed to log SMS:', logError);
        }

        return res.json({
          success: false,
          reason: 'Could not extract amount from SMS message',
          receivedMessage: message,
          hint: 'If message shows "%body%" or "{{message}}", your SMS Forwarder variables are not configured correctly'
        });
      }

      console.log(`[SMS-WEBHOOK] Extracted amount: ${extractedAmount}`);

      // ============================================================
      // STEP 0 (NEW): Immediately log SMS to sms_logs for audit history
      // ============================================================
      const smsLogId = crypto.randomUUID();
      let smsStatus: 'received' | 'matched' | 'unmatched' = 'received';

      try {
        await db.insert(smsLogs).values({
          id: smsLogId,
          sender: sender,
          messageContent: message.substring(0, 500),
          extractedAmount: extractedAmount,
          status: 'received',
          createdAt: new Date().toISOString(),
        });
        console.log(`[SMS-WEBHOOK] ✓ SMS logged to sms_logs (ID: ${smsLogId})`);
        console.log("📩 SMS Logged:", { sender: sender, message: message.substring(0, 100) });
      } catch (logError) {
        console.error('[SMS-WEBHOOK] Failed to log SMS:', logError);
      }

      // ============================================================
      // Step 1: Store payment in buffer for manual verification flow
      // ============================================================
      const transactionId = `SMS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      try {
        await db.insert(paymentBuffers).values({
          id: crypto.randomUUID(),
          amount: extractedAmount,
          senderName: sender,
          smsContent: message.substring(0, 500), // Limit message length
          transactionId: transactionId,
          verified: false,
          createdAt: new Date().toISOString(),
        });
        console.log(`[SMS-WEBHOOK] Payment stored in buffer: ${extractedAmount} from ${sender}`);
      } catch (bufferError) {
        console.error('[SMS-WEBHOOK] Failed to store in payment buffer:', bufferError);
        // Continue processing even if buffer insert fails
      }

      // ============================================================
      // Step 2: Emit Socket.IO event for real-time verification
      // ============================================================
      const io = (global as any).io;
      if (io) {
        io.emit('paymentVerified', {
          amount: extractedAmount,
          transactionId: transactionId,
          sender: sender,
          timestamp: new Date().toISOString(),
        });
        io.emit('smsPaymentReceived', {
          amount: extractedAmount,
          transactionId: transactionId,
        });
        console.log(`[SMS-WEBHOOK] Socket.IO events emitted for amount: ${extractedAmount}`);
      }

      // ============================================================
      // Step 3: Query for matching pending/unpaid orders (optional auto-match)
      // ============================================================
      const allSales = await storage.getSales();

      // Find the most recent order where:
      // - status is 'pending' OR paymentStatus is 'unpaid'
      // - total matches the extracted amount exactly
      const matchingOrder = allSales
        .filter(sale =>
          (sale.status === 'pending' || sale.paymentStatus === 'unpaid') &&
          Math.abs(sale.total - extractedAmount!) < 0.01  // Float comparison tolerance
        )
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      [0];  // Get the most recent one

      if (!matchingOrder) {
        console.log(`[SMS-WEBHOOK] No matching order found for amount: ${extractedAmount}`);
        console.log(`[SMS-WEBHOOK] Payment stored in buffer for manual verification`);

        // Update SMS log status to 'unmatched'
        try {
          await db.update(smsLogs)
            .set({ status: 'unmatched' })
            .where(sql`${smsLogs.id} = ${smsLogId}`);
        } catch (e) {
          console.error('[SMS-WEBHOOK] Failed to update SMS log status:', e);
        }

        // Emit socket event for live dashboard
        if (io) {
          io.emit('new_sms_log', {
            id: smsLogId,
            sender: sender,
            amount: extractedAmount,
            status: 'unmatched',
            message: message.substring(0, 100),
            timestamp: new Date().toISOString(),
          });
          console.log('[SMS-WEBHOOK] ✓ new_sms_log event emitted to dashboard');
        }

        return res.json({
          success: true,
          buffered: true,
          amount: extractedAmount,
          transactionId: transactionId,
          message: 'Payment stored in buffer. No matching pending order found for auto-completion.'
        });
      }

      console.log(`[SMS-WEBHOOK] Found matching order: ${matchingOrder.id}`);

      // Update the order status to paid
      await storage.updateSaleStatus(matchingOrder.id, 'completed');

      // Mark buffer as verified
      try {
        await db
          .update(paymentBuffers)
          .set({ verified: true })
          .where(sql`${paymentBuffers.transactionId} = ${transactionId}`);
      } catch (e) {
        console.error('[SMS-WEBHOOK] Failed to mark buffer as verified:', e);
      }

      // Update SMS log status to 'matched' and link to order
      try {
        await db.update(smsLogs)
          .set({ status: 'matched', matchedOrderId: matchingOrder.id })
          .where(sql`${smsLogs.id} = ${smsLogId}`);
      } catch (e) {
        console.error('[SMS-WEBHOOK] Failed to update SMS log status:', e);
      }

      console.log(`[SMS-WEBHOOK] Order ${matchingOrder.id} marked as PAID via SMS`);
      console.log(`[SMS-WEBHOOK] SMS Details - Sender: ${sender}, Amount: ${extractedAmount}, Message: ${message.substring(0, 100)}...`);

      // Emit socket event for live dashboard
      if (io) {
        io.emit('new_sms_log', {
          id: smsLogId,
          sender: sender,
          amount: extractedAmount,
          status: 'matched',
          matchedOrderId: matchingOrder.id,
          message: message.substring(0, 100),
          timestamp: new Date().toISOString(),
        });
        console.log('[SMS-WEBHOOK] ✓ new_sms_log event emitted to dashboard (matched)');
      }

      return res.json({
        success: true,
        matchedOrderId: matchingOrder.id,
        amount: extractedAmount,
        previousStatus: matchingOrder.status,
        newStatus: 'completed'
      });

    } catch (error) {
      console.error('[SMS-WEBHOOK] Error processing SMS:', error);
      return res.status(500).json({ success: false, reason: 'Internal server error' });
    }
  });

  // ============================================================
  // SMS Logs API - View all SMS for Admin/Cashier debugging
  // ============================================================
  app.get('/api/admin/sms-logs', async (req, res) => {
    try {
      const logs = await db
        .select()
        .from(smsLogs)
        .orderBy(desc(smsLogs.createdAt))
        .limit(50);

      console.log(`[SMS-LOGS] Fetched ${logs.length} SMS logs`);
      return res.json(logs);
    } catch (error) {
      console.error('[SMS-LOGS] Error fetching logs:', error);
      return res.status(500).json({ error: 'Failed to fetch SMS logs' });
    }
  });

  // Kitchen role API isolation: block access to non-kitchen endpoints
  app.use((req: any, res: any, next: any) => {
    const user = req.session?.user;
    if (!user) return next();

    if (user.role !== 'kitchen') return next();

    const path = req.path || '';

    // Only isolate API routes; never block client-side routes like /kitchen
    if (!path.startsWith('/api')) return next();

    const allowedPrefixes = ['/api/auth', '/api/health', '/api/kitchen-tickets'];
    const isAllowedPrefix = allowedPrefixes.some((p) => path.startsWith(p));
    if (isAllowedPrefix) return next();

    // Allow kitchen to read tables for kitchen display context
    if (path.startsWith('/api/tables') && req.method === 'GET') return next();

    // Allow kitchen to read business units (scoped) for header/store context
    if (path.startsWith('/api/business-units') && req.method === 'GET') return next();

    return res.status(403).json({ error: 'Permission denied' });
  });

  // Waiter role API isolation: allow POS, tables, orders; block inventory, reports, settings, staff, ledger
  app.use((req: any, res: any, next: any) => {
    const user = req.session?.user;
    if (!user) return next();

    if (user.role !== 'waiter') return next();

    const path = req.path || '';

    // Only isolate API routes
    if (!path.startsWith('/api')) return next();

    // Explicitly allow shift operations for waiters (clock in/out)
    if (path === '/api/shifts/open' || path === '/api/shifts/close' || path === '/api/shifts/current') {
      return next();
    }

    // Allowed API endpoints for waiter role
    const allowedPrefixes = [
      '/api/auth',
      '/api/health',
      '/api/products',       // Read products for POS
      '/api/categories',    // Read categories for menu filtering
      '/api/sales',          // Create/view sales
      '/api/tables',         // Tables management
      '/api/kitchen-tickets', // View/manage orders
      '/api/business-units', // Store context
      '/api/shifts',         // Open/close own shift
      '/api/attendance',     // Clock in/out for shift tracking
      '/api/customers',      // View customers for table orders
      '/api/settings/public', // Read currency settings for formatting
    ];
    const isAllowedPrefix = allowedPrefixes.some((p) => path.startsWith(p));
    if (isAllowedPrefix) return next();

    // Block access to: inventory, reports, settings, staff, ledger, expenses, alerts, admin
    return res.status(403).json({ error: 'Permission denied' });
  });

  // CUSTOMER Role API Isolation: STRICT LOCKDOWN
  // Customers can ONLY access public routes and their own data
  app.use((req: any, res: any, next: any) => {
    const user = req.session?.user;
    if (!user) return next();

    // Only apply to fully authenticated customers
    // Note: Some systems might use 'customer' role, check if that's the case
    if (user.role !== 'customer') return next();

    const path = req.path || '';

    // Only isolate API routes
    if (!path.startsWith('/api')) return next();

    // Explicit Allow List for Customers
    const allowedPrefixes = [
      '/api/auth',          // Login/Logout
      '/api/public',        // Public Menu
      '/api/customer',      // Customer Portal (Profile, Orders)
      '/api/cart',          // Cart operations
      '/api/business-units',// Store context
      '/api/settings/public', // Currency settings
      '/api/delivery',      // Delivery status
      '/api/health',        // Health checks
    ];

    if (allowedPrefixes.some(p => path.startsWith(p))) {
      return next();
    }

    // BLOCK EVERYTHING ELSE (Inventory, Sales, Admin, Reports, etc.)
    console.warn(`[SECURITY] Blocked customer ${user.id} from accessing: ${path}`);
    return res.status(403).json({ error: 'Forbidden: Customers cannot access admin endpoints' });
  });

  app.use('/api/products', productRouter);
  app.use('/api/customers', customerRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/scan', scanRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/shifts', shiftsRouter);
  app.use('/api/credit-ledger', creditLedgerRouter);
  app.use('/api/ledger', ledgerRouter);
  app.use('/api/kitchen-tickets', kitchenTicketsRouter);
  app.use('/api/categories', categoriesRouter);

  app.get('/api/health', async (req, res) => {
    try {
      const hasApiKey = !!(process.env.GEMINI_API_KEY);
      res.json({ ok: true, geminiLoaded: hasApiKey });
    } catch (err) {
      console.error('Health check failed:', err);
      res.status(500).json({ ok: false });
    }
  });

  // Database Health Check - Real DB ping with latency measurement
  app.get('/api/db/health', async (req, res) => {
    try {
      const startTime = Date.now();

      // Execute a simple query to verify database connection
      db.run(sql`SELECT 1`);

      const latencyMs = Date.now() - startTime;

      console.log(`[DB-HEALTH] Database ping successful, latency: ${latencyMs}ms`);

      res.json({
        healthy: true,
        status: 'ok',
        latency: `${latencyMs}ms`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[DB-HEALTH] Database health check failed:', err);
      res.status(500).json({
        healthy: false,
        status: 'error',
        issues: ['Database connection failed'],
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });

  app.get("/api/dashboard/summary", async (req, res) => {
    try {
      res.json(await storage.getDashboardSummary());
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
      res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
  });

  // Analytics Summary Endpoint
  app.get("/api/analytics/summary", isAuthenticated, async (req, res) => {
    try {
      const requestedBusinessUnitId = typeof req.query.businessUnitId === 'string' ? req.query.businessUnitId : null;
      const businessUnitId = requestedBusinessUnitId || req.user?.businessUnitId || null;
      if (!businessUnitId) {
        return res.status(400).json({ error: 'businessUnitId is required' });
      }

      const sales = await storage.getSales();
      const products = await storage.getProducts();
      const customers = await storage.getCustomers();

      // Filter by business unit if provided
      const filteredSales = sales.filter(sale => sale.businessUnitId === businessUnitId);
      const filteredProducts = products.filter(product => product.businessUnitId === businessUnitId);
      // For customers: include those with matching businessUnitId OR those without any businessUnitId (legacy data)
      const filteredCustomers = customers.filter((c: any) =>
        c.businessUnitId === businessUnitId || !c.businessUnitId
      );

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Today's Sales
      const todaySales = filteredSales.filter(s => new Date(s.timestamp) >= todayStart);
      const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);

      // Monthly Sales
      const monthlySales = filteredSales.filter(s => new Date(s.timestamp) >= monthStart);
      const monthlyRevenue = monthlySales.reduce((sum, s) => sum + s.total, 0);

      // Total Orders
      const totalOrders = todaySales.length;

      // Low Stock Items
      const lowStockItems = filteredProducts.filter(p => p.stock <= (p.minStockLevel || 10));

      // Total receivables
      const totalReceivables = filteredCustomers
        .filter((c: any) => (c.status ?? 'active') === 'active')
        .reduce((sum: number, c: any) => sum + (Number(c.currentBalance) || 0), 0);

      // Daily Sales for Last 7 Days
      const chartData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const daySales = filteredSales.filter(s => {
          const saleDate = new Date(s.timestamp);
          return saleDate >= dayStart && saleDate < dayEnd;
        });

        chartData.push({
          date: dayStart.toISOString().split('T')[0],
          sales: daySales.reduce((sum, s) => sum + s.total, 0),
        });
      }

      // Top Products
      const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();

      for (const sale of filteredSales) {
        for (const item of sale.items) {
          const existing = productSales.get(item.productId) || { name: item.productName, quantity: 0, revenue: 0 };
          existing.quantity += item.quantity;
          existing.revenue += item.total;
          productSales.set(item.productId, existing);
        }
      }

      const topProducts = Array.from(productSales.entries())
        .map(([, data]) => ({ ...data }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      res.json({
        todaySales: todayRevenue,
        monthlySales: monthlyRevenue,
        totalOrders,
        lowStockCount: lowStockItems.length,
        totalReceivables,
        chartData,
        topProducts
      });
    } catch (error) {
      console.error("Error fetching analytics summary:", error);
      res.status(500).json({ error: "Failed to fetch analytics summary" });
    }
  });

  // ========================================
  // Restaurant Tables (QR Menu Management)
  // ========================================

  // Get all restaurant tables
  app.get("/api/restaurant-tables", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const tables = await db.select().from(restaurantTables).all();
      res.json(tables);
    } catch (error) {
      // Return empty array instead of 500 to prevent infinite error loops
      console.error('Error fetching restaurant tables (returning empty):', error);
      res.json([]);
    }
  });

  // Create new restaurant table
  app.post("/api/restaurant-tables", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { tableNumber, tableName } = req.body;

      if (!tableNumber) {
        return res.status(400).json({ error: "Table number is required" });
      }

      const newTable = {
        id: crypto.randomUUID(),
        tableNumber: tableNumber.toString(),
        tableName: tableName || null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.insert(restaurantTables).values(newTable);
      res.json(newTable);
    } catch (error: any) {
      console.error('Error creating restaurant table:', error);
      if (error.message?.includes('UNIQUE constraint')) {
        return res.status(400).json({ error: "Table number already exists" });
      }
      res.status(500).json({ error: "Failed to create table" });
    }
  });

  // Update restaurant table
  app.patch("/api/restaurant-tables/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { tableNumber, tableName, isActive } = req.body;
      const updates: any = { updatedAt: new Date().toISOString() };

      if (tableNumber !== undefined) updates.tableNumber = tableNumber.toString();
      if (tableName !== undefined) updates.tableName = tableName;
      if (isActive !== undefined) updates.isActive = isActive;

      await db.update(restaurantTables)
        .set(updates)
        .where(eq(restaurantTables.id, req.params.id));

      const updated = await db.select().from(restaurantTables)
        .where(eq(restaurantTables.id, req.params.id))
        .get();

      if (!updated) {
        return res.status(404).json({ error: "Table not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error updating restaurant table:', error);
      if (error.message?.includes('UNIQUE constraint')) {
        return res.status(400).json({ error: "Table number already exists" });
      }
      res.status(500).json({ error: "Failed to update table" });
    }
  });

  // Delete restaurant table
  app.delete("/api/restaurant-tables/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await db.delete(restaurantTables).where(eq(restaurantTables.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting restaurant table:', error);
      res.status(500).json({ error: "Failed to delete table" });
    }
  });

  // ========================================
  // Restaurant Tables (Old complex system)
  // ========================================

  // Restaurant Tables
  app.get("/api/tables", isAuthenticated, requireRole('owner', 'kitchen', 'waiter', 'cashier', 'manager'), async (req, res) => {
    try {
      const requestedBusinessUnitId = typeof req.query.businessUnitId === 'string' ? req.query.businessUnitId : null;
      const businessUnitId = requestedBusinessUnitId || req.user?.businessUnitId || null;
      const allTables = await storage.getTables();

      // Hybrid safety: without a business unit, do not return cross-store data
      if (!businessUnitId) {
        return res.json([]);
      }

      const filteredTables = allTables.filter(table => table.businessUnitId === businessUnitId);

      // Fetch active sales (pending/unpaid) to detect QR orders
      const allSales = await storage.getSales();
      const activeSalesByTable = new Map<string, any>();

      // CRITICAL FIX: Only consider sales that are BOTH:
      // 1. Not completed/cancelled status
      // 2. Not yet paid (paymentStatus !== 'paid')
      // This prevents "ghost sales" where a paid sale keeps the table stuck in "Ordered"
      allSales
        .filter((sale: any) =>
          sale.businessUnitId === businessUnitId &&
          sale.tableNumber &&
          sale.status !== 'completed' &&
          sale.status !== 'cancelled' &&
          sale.paymentStatus !== 'paid' && // <-- CRITICAL: Exclude paid sales
          sale.orderType === 'dine-in'
        )
        .forEach((sale: any) => {
          const tableNum = String(sale.tableNumber);
          // Keep the most recent active sale for each table
          if (!activeSalesByTable.has(tableNum) ||
            new Date(sale.timestamp) > new Date(activeSalesByTable.get(tableNum).timestamp)) {
            activeSalesByTable.set(tableNum, sale);
          }
        });

      const withOrder = filteredTables.map((t: any) => {
        let orderCart: any[] = [];

        // First check for active QR/POS sale for this table
        const activeSale = activeSalesByTable.get(String(t.number));
        if (activeSale && Array.isArray(activeSale.items) && activeSale.items.length > 0) {
          // Use items from the active sale (QR order or POS order)
          orderCart = activeSale.items.map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            productId: item.productId,
            productName: item.productName,
            name: item.productName,
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            price: Number(item.unitPrice) || 0,
            total: Number(item.total) || (Number(item.unitPrice) * Number(item.quantity)) || 0,
          }));
          console.log(`[TABLE-CART] Table ${t.number} has ACTIVE SALE with ${orderCart.length} items (Sale ID: ${activeSale.id})`);
        }
        // Fallback to table's currentOrder if no active sale
        else if (typeof t.currentOrder === 'string' && t.currentOrder.trim().length > 0) {
          try {
            const parsed = JSON.parse(t.currentOrder);
            if (Array.isArray(parsed)) {
              orderCart = parsed;
            }
            console.log(`[TABLE-CART] Table ${t.number} has ${orderCart.length} items from table.currentOrder`);
          } catch (e) {
            console.error(`Error parsing currentOrder for table ${t.id}:`, e);
            orderCart = [];
          }
        }

        const items = orderCart.map((i: any) => ({
          id: i?.id || crypto.randomUUID(),
          productId: i?.productId,
          productName: i?.productName || i?.name || 'Item',
          name: i?.name || i?.productName || 'Item',
          quantity: Number(i?.quantity) || 0,
          unitPrice: Number(i?.unitPrice ?? i?.price) || 0,
          price: Number(i?.unitPrice ?? i?.price) || 0,
          total: Number(i?.total) || (Number(i?.unitPrice ?? i?.price) * Number(i?.quantity)) || 0,
        }));
        const total = items.reduce((sum: number, i: any) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);

        // Include active sale ID for reference
        const activeSaleId = activeSale?.id || null;

        // Determine effective status based on active sales
        const hasActiveSale = !!activeSale;
        const effectiveStatus = hasActiveSale ? 'occupied' : t.status;
        const effectiveServiceStatus = hasActiveSale ? (activeSale?.status === 'pending' ? 'ordered' : t.serviceStatus) : t.serviceStatus;

        return {
          ...t,
          orderCart,
          currentOrder: items.length > 0 ? { items, total } : null,
          activeSaleId,
          status: effectiveStatus,
          serviceStatus: effectiveServiceStatus,
        };
      });

      res.json(withOrder);
    } catch (error) {
      console.error("Error fetching tables:", error);
      res.status(500).json({ error: "Failed to fetch tables" });
    }
  });

  // Simple endpoint for Settings page - returns all restaurant tables without complex filtering
  app.get("/api/restaurant-tables", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const tables = db.select().from(restaurantTables).all();
      console.log(`📋 Fetched ${tables.length} restaurant tables for settings`);
      res.json(tables);
    } catch (error) {
      console.error("Error fetching restaurant tables:", error);
      res.status(500).json({ error: "Failed to fetch tables" });
    }
  });

  // Create new table
  app.post("/api/tables", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { tableNumber, tableName } = req.body;

      if (!tableNumber) {
        return res.status(400).json({ error: "tableNumber is required" });
      }

      // Check if table already exists in restaurantTables
      const existingTable = db.select()
        .from(restaurantTables)
        .where(eq(restaurantTables.tableNumber, String(tableNumber)))
        .get();

      if (existingTable) {
        return res.status(409).json({ error: `Table ${tableNumber} already exists` });
      }

      // Insert new table (using schema-compliant fields only)
      const newTable = db.insert(restaurantTables).values({
        tableNumber: String(tableNumber),
        tableName: tableName || null,
        isActive: true,
      }).returning().get();

      console.log(`✅ Created table: ${tableNumber} (${tableName || 'No name'})`);
      res.status(201).json(newTable);
    } catch (error) {
      console.error("Error creating table:", error);
      res.status(500).json({ error: "Failed to create table" });
    }
  });

  // Delete table
  app.delete("/api/tables/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const tableId = req.params.id; // ID is a string UUID in this schema

      if (!tableId) {
        return res.status(400).json({ error: "Invalid table ID" });
      }

      // Delete the table
      db.delete(restaurantTables).where(eq(restaurantTables.id, tableId)).run();

      console.log(`🗑️ Deleted table ID: ${tableId}`);
      res.json({ success: true, deletedId: tableId });
    } catch (error) {
      console.error("Error deleting table:", error);
      res.status(500).json({ error: "Failed to delete table" });
    }
  });

  app.patch("/api/tables/:id/status", isAuthenticated, async (req, res) => {
    try {
      const businessUnitId = typeof req.query.businessUnitId === 'string' ? req.query.businessUnitId : '';
      if (!businessUnitId) {
        return res.status(400).json({ error: 'businessUnitId is required' });
      }

      const userBusinessUnitId = req.user?.businessUnitId;
      const userRole = (req.user as any)?.role;
      if (userRole !== 'owner') {
        if (!userBusinessUnitId) {
          return res.status(403).json({ error: 'User has no assigned business unit' });
        }
        if (businessUnitId !== userBusinessUnitId) {
          return res.status(403).json({ error: 'Business unit mismatch' });
        }
      }

      const status = req.body?.status;
      if (status !== 'available' && status !== 'occupied' && status !== 'reserved') {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const allTables = await storage.getTables();
      const existing = allTables.find((t: any) => t.id === req.params.id);
      if (!existing || existing.businessUnitId !== businessUnitId) {
        return res.status(404).json({ error: 'Table not found' });
      }

      const updated = await storage.updateTableStatus(req.params.id, status);
      if (!updated) {
        return res.status(500).json({ error: 'Failed to update table status' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating table status:', error);
      res.status(500).json({ error: 'Failed to update table status' });
    }
  });

  app.patch("/api/tables/:id/order", isAuthenticated, async (req, res) => {
    try {
      const businessUnitId = typeof req.query.businessUnitId === 'string' ? req.query.businessUnitId : '';
      if (!businessUnitId) {
        return res.status(400).json({ error: 'businessUnitId is required' });
      }

      const userBusinessUnitId = req.user?.businessUnitId;
      const userRole = (req.user as any)?.role;
      if (userRole !== 'owner') {
        if (!userBusinessUnitId) {
          return res.status(403).json({ error: 'User has no assigned business unit' });
        }
        if (businessUnitId !== userBusinessUnitId) {
          return res.status(403).json({ error: 'Business unit mismatch' });
        }
      }

      const cart = req.body?.cart;
      if (cart !== null && cart !== undefined && !Array.isArray(cart)) {
        return res.status(400).json({ error: 'Invalid cart' });
      }

      const allTables = await storage.getTables();
      const existing = allTables.find((t: any) => t.id === req.params.id);
      if (!existing || existing.businessUnitId !== businessUnitId) {
        return res.status(404).json({ error: 'Table not found' });
      }

      const serialized = Array.isArray(cart) ? JSON.stringify(cart) : null;
      const updated = await storage.updateTableOrder(req.params.id, serialized);
      if (!updated) {
        return res.status(500).json({ error: 'Failed to update table order' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating table order:', error);
      res.status(500).json({ error: 'Failed to update table order' });
    }
  });

  app.post("/api/tables/:id/order", isAuthenticated, async (req, res) => {
    try {
      const businessUnitId = typeof req.query.businessUnitId === 'string' ? req.query.businessUnitId : '';
      if (!businessUnitId) {
        return res.status(400).json({ error: 'businessUnitId is required' });
      }

      const userBusinessUnitId = req.user?.businessUnitId;
      const userRole = (req.user as any)?.role;
      if (userRole !== 'owner') {
        if (!userBusinessUnitId) {
          return res.status(403).json({ error: 'User has no assigned business unit' });
        }
        if (businessUnitId !== userBusinessUnitId) {
          return res.status(403).json({ error: 'Business unit mismatch' });
        }
      }

      const cart = req.body?.cart;
      const tableNumber = typeof req.body?.tableNumber === 'string' ? req.body.tableNumber : null;
      if (!Array.isArray(cart)) {
        return res.status(400).json({ error: 'Invalid cart' });
      }

      const allTables = await storage.getTables();
      const existing = allTables.find((t: any) => t.id === req.params.id);
      if (!existing || existing.businessUnitId !== businessUnitId) {
        return res.status(404).json({ error: 'Table not found' });
      }

      const result = await storage.orderTableAndCreateKitchenTicket({
        businessUnitId,
        tableId: req.params.id,
        tableNumber: tableNumber ?? existing.number ?? null,
        cart,
      });

      // Emit socket events for real-time POS updates
      const io = (global as any).io;
      if (io) {
        // Notify about order update
        io.emit('tableOrderUpdated', {
          tableId: req.params.id,
          tableNumber: tableNumber ?? existing.number,
          businessUnitId,
          orderSource: 'pos',
          items: cart,
          timestamp: new Date().toISOString()
        });

        // ✅ CRITICAL: Broadcast table status change to 'occupied'
        io.emit('tableStatusUpdated', {
          tableId: req.params.id,
          tableNumber: tableNumber ?? existing.number,
          businessUnitId,
          status: 'occupied',
          serviceStatus: 'ordered',
          timestamp: new Date().toISOString()
        });

        console.log('[SOCKET] Emitted tableOrderUpdated + tableStatusUpdated for table:', tableNumber ?? existing.number);
      }

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to order table';
      const status = message === 'No new items to order' ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.patch("/api/tables/:id/service-status", isAuthenticated, async (req, res) => {
    try {
      const businessUnitId = typeof req.query.businessUnitId === 'string' ? req.query.businessUnitId : '';
      if (!businessUnitId) {
        return res.status(400).json({ error: 'businessUnitId is required' });
      }

      const userBusinessUnitId = req.user?.businessUnitId;
      const userRole = (req.user as any)?.role;
      if (userRole !== 'owner') {
        if (!userBusinessUnitId) {
          return res.status(403).json({ error: 'User has no assigned business unit' });
        }
        if (businessUnitId !== userBusinessUnitId) {
          return res.status(403).json({ error: 'Business unit mismatch' });
        }
      }

      const statusVal = req.body?.serviceStatus;
      if (statusVal !== null && statusVal !== undefined && statusVal !== 'ordered' && statusVal !== 'served' && statusVal !== 'billing') {
        return res.status(400).json({ error: 'Invalid serviceStatus' });
      }

      const allTables = await storage.getTables();
      const existing = allTables.find((t: any) => t.id === req.params.id);
      if (!existing || existing.businessUnitId !== businessUnitId) {
        return res.status(404).json({ error: 'Table not found' });
      }

      const updated = await storage.updateTableServiceStatus(req.params.id, (statusVal ?? null) as any);

      // Emit socket event for real-time POS updates
      const io = (global as any).io;
      if (io) {
        io.emit('tableServiceStatusUpdated', {
          tableId: req.params.id,
          tableNumber: existing.number,
          businessUnitId,
          serviceStatus: statusVal,
          timestamp: new Date().toISOString()
        });
        console.log('[SOCKET] Emitted tableServiceStatusUpdated for table:', existing.number);
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating table service status:', error);
      res.status(500).json({ error: 'Failed to update table service status' });
    }
  });

  // ========================================
  // SYNC TABLE STATUS - Force-refresh all table statuses
  // This fixes "stuck" tables by checking actual unpaid sales
  // ========================================
  app.post("/api/tables/sync-status", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const businessUnitId = typeof req.query.businessUnitId === 'string' ? req.query.businessUnitId : req.body?.businessUnitId;

      if (!businessUnitId) {
        return res.status(400).json({ error: 'businessUnitId is required' });
      }

      console.log('[SYNC-STATUS] Starting table status sync for businessUnitId:', businessUnitId);

      // 1. Get all tables for this business unit
      const allTables = await storage.getTables();
      const businessTables = allTables.filter((t: any) => t.businessUnitId === businessUnitId);

      // 2. Get all sales to check for truly unpaid orders
      const allSales = await storage.getSales();

      // 3. Build a map of tables with TRULY active (unpaid) orders
      const tablesWithActiveOrders = new Set<string>();
      allSales
        .filter((sale: any) =>
          sale.businessUnitId === businessUnitId &&
          sale.tableNumber &&
          sale.status !== 'completed' &&
          sale.status !== 'cancelled' &&
          sale.paymentStatus !== 'paid' &&
          sale.orderType === 'dine-in'
        )
        .forEach((sale: any) => {
          tablesWithActiveOrders.add(String(sale.tableNumber));
        });

      console.log('[SYNC-STATUS] Tables with active orders:', Array.from(tablesWithActiveOrders));

      // 4. Update each table's status based on actual order state
      const updates: { tableNumber: string; oldStatus: string; newStatus: string; cleared: boolean }[] = [];

      for (const table of businessTables) {
        const hasActiveOrder = tablesWithActiveOrders.has(String(table.number));
        const shouldBeAvailable = !hasActiveOrder;
        const isCurrentlyOccupied = table.status === 'occupied' || table.serviceStatus;

        // If table shows occupied/ordered but has no unpaid orders, clear it
        if (shouldBeAvailable && isCurrentlyOccupied) {
          console.log(`[SYNC-STATUS] Clearing stuck table ${table.number} (ID: ${table.id})`);

          await storage.updateTableStatus(table.id, 'available');
          await storage.updateTableOrder(table.id, null);
          await storage.updateTableServiceStatus(table.id, null);

          updates.push({
            tableNumber: table.number,
            oldStatus: table.status || 'unknown',
            newStatus: 'available',
            cleared: true
          });

          // Emit socket event for real-time UI update
          const io = (global as any).io;
          if (io) {
            io.emit('tableStatusUpdated', {
              tableId: table.id,
              tableNumber: table.number,
              status: 'available',
              businessUnitId,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      console.log('[SYNC-STATUS] Sync complete. Updated tables:', updates.length);

      res.json({
        success: true,
        message: `Synced ${updates.length} table(s)`,
        updates,
        tablesWithActiveOrders: Array.from(tablesWithActiveOrders)
      });

    } catch (error) {
      console.error('[SYNC-STATUS] Error:', error);
      res.status(500).json({ error: 'Failed to sync table status' });
    }
  });

  // ========================================
  // DATABASE HEALTH CHECK - Audit and sanitize orphaned records
  // ========================================
  app.get("/api/admin/db-health", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      console.log('[DB-HEALTH] Starting database health check...');

      const issues: string[] = [];
      const stats: Record<string, any> = {};

      // 1. Check for orphaned sales (no valid business unit)
      const allSales = await storage.getSales();
      const allBusinessUnits = await storage.getBusinessUnits();
      const validBuIds = new Set(allBusinessUnits.map((bu: any) => bu.id));

      const orphanedSales = allSales.filter((s: any) => !validBuIds.has(s.businessUnitId));
      if (orphanedSales.length > 0) {
        issues.push(`${orphanedSales.length} sales with invalid businessUnitId`);
      }
      stats.totalSales = allSales.length;
      stats.orphanedSales = orphanedSales.length;

      // 2. Check for duplicate table entries
      const allTables = await storage.getTables();
      const tablesByBu: Record<string, Record<string, number>> = {};
      allTables.forEach((t: any) => {
        if (!tablesByBu[t.businessUnitId]) tablesByBu[t.businessUnitId] = {};
        if (!tablesByBu[t.businessUnitId][t.number]) tablesByBu[t.businessUnitId][t.number] = 0;
        tablesByBu[t.businessUnitId][t.number]++;
      });

      let duplicateTables = 0;
      for (const buId of Object.keys(tablesByBu)) {
        for (const tableNum of Object.keys(tablesByBu[buId])) {
          if (tablesByBu[buId][tableNum] > 1) {
            duplicateTables += tablesByBu[buId][tableNum] - 1;
            issues.push(`Duplicate table ${tableNum} in business unit ${buId}`);
          }
        }
      }
      stats.totalTables = allTables.length;
      stats.duplicateTables = duplicateTables;

      // 3. Check for ghost sales (unpaid but old)
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const ghostSales = allSales.filter((s: any) => {
        const saleDate = new Date(s.timestamp);
        return s.paymentStatus === 'unpaid' && saleDate < oneDayAgo;
      });
      if (ghostSales.length > 0) {
        issues.push(`${ghostSales.length} unpaid sales older than 24 hours`);
      }
      stats.ghostSales = ghostSales.length;

      // 4. Check for stuck tables (occupied but no active sale)
      const activeSalesTableNumbers = new Set(
        allSales
          .filter((s: any) => s.paymentStatus !== 'paid' && s.status !== 'completed' && s.status !== 'cancelled')
          .map((s: any) => String(s.tableNumber))
      );

      const stuckTables = allTables.filter((t: any) =>
        (t.status === 'occupied' || t.serviceStatus) &&
        !activeSalesTableNumbers.has(String(t.number))
      );
      if (stuckTables.length > 0) {
        issues.push(`${stuckTables.length} tables marked occupied but have no active sales`);
      }
      stats.stuckTables = stuckTables.length;

      // 5. Summary
      const isHealthy = issues.length === 0;

      console.log('[DB-HEALTH] Check complete:', { isHealthy, issues: issues.length });

      res.json({
        healthy: isHealthy,
        issues,
        stats,
        stuckTableNumbers: stuckTables.map((t: any) => t.number),
        ghostSaleIds: ghostSales.map((s: any) => s.id),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[DB-HEALTH] Error:', error);
      res.status(500).json({ error: 'Failed to check database health' });
    }
  });

  // Business Units
  app.get("/api/business-units", isAuthenticated, async (req, res) => {
    try {
      const businessUnits = await storage.getBusinessUnits();
      const role = (req.user as any)?.role;
      if (role === 'kitchen') {
        const buId = req.user?.businessUnitId;
        const scoped = buId ? businessUnits.filter((bu: any) => bu.id === buId) : [];
        return res.json(scoped);
      }

      res.json(businessUnits);
    } catch (error) {
      console.error("Error fetching business units:", error);
      res.status(500).json({ error: "Failed to fetch business units" });
    }
  });

  app.post("/api/business-units", isAuthenticated, async (req, res) => {
    try {
      const businessUnit = await storage.createBusinessUnit(req.body);
      res.json(businessUnit);
    } catch (error) {
      console.error("Error creating business unit:", error);
      res.status(500).json({ error: "Failed to create business unit" });
    }
  });

  app.put("/api/business-units/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const businessUnit = await storage.updateBusinessUnit(id, req.body);
      if (!businessUnit) {
        return res.status(404).json({ error: "Business unit not found" });
      }
      res.json(businessUnit);
    } catch (error) {
      console.error("Error updating business unit:", error);
      res.status(500).json({ error: "Failed to update business unit" });
    }
  });

  app.delete("/api/business-units/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteBusinessUnit(id);
      if (!success) {
        return res.status(404).json({ error: "Business unit not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting business unit:", error);
      res.status(500).json({ error: "Failed to delete business unit" });
    }
  });

  // File Upload
  app.post("/api/upload", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      res.status(200).json({
        url: fileUrl,
        filename: req.file.filename,
        path: req.file.path
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Expenses Management
  app.get("/api/expenses", isAuthenticated, async (req, res) => {
    try {
      res.json(await storage.getExpenses());
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", isAuthenticated, async (req, res) => {
    try {
      const parsed = insertExpenseSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid expense data", details: parsed.error.errors });
      res.status(201).json(await storage.createExpense(parsed.data));
    } catch (error) {
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.patch("/api/expenses/:id", isAuthenticated, async (req, res) => {
    try {
      const expense = await storage.updateExpense(req.params.id, req.body);
      if (!expense) return res.status(404).json({ error: "Expense not found" });
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      if (!await storage.deleteExpense(req.params.id)) return res.status(404).json({ error: "Expense not found" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // Settings (PUBLIC - no auth required for currency info)
  app.get("/api/settings/public", async (req, res) => {
    try {
      // Use cache for public settings - very long TTL since these rarely change
      const settings = await cache.getOrFetch(
        CACHE_KEYS.APP_SETTINGS,
        () => storage.getAppSettings(),
        CACHE_TTL.VERY_LONG // 10 minutes
      );
      res.json({
        currencyCode: settings?.currencyCode,
        currencySymbol: settings?.currencySymbol,
        currencyPosition: settings?.currencyPosition,
        riderPin: settings?.riderPin || "8888", // Exposed for Rider App authentication
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.get("/api/settings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      // Use cache for settings
      const settings = await cache.getOrFetch(
        CACHE_KEYS.APP_SETTINGS,
        () => storage.getAppSettings(),
        CACHE_TTL.VERY_LONG
      );
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const parsed = appSettingsSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid settings data", details: parsed.error.errors });
      const updated = await storage.updateAppSettings(parsed.data);
      // Invalidate settings cache after update
      cache.invalidate(CACHE_KEYS.APP_SETTINGS);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.post("/api/settings/upload-qr", isAuthenticated, requireAdmin, uploadMemory.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      if (!req.file.mimetype?.startsWith('image/')) {
        return res.status(400).json({ error: "Invalid file type" });
      }

      const qrDir = path.join(process.cwd(), 'public', 'qrcodes');
      await fs.mkdir(qrDir, { recursive: true });

      const filename = 'kpay_qr.png';
      const filePath = path.join(qrDir, filename);
      await fs.writeFile(filePath, req.file.buffer);

      const urlPath = `/qrcodes/${filename}`;
      const updated = await storage.updateAppSettings({ mobilePaymentQrUrl: urlPath });

      res.json({
        success: true,
        url: urlPath,
        settings: updated,
        cacheBuster: Date.now(),
      });
    } catch (error) {
      console.error('QR upload error:', error);
      res.status(500).json({ error: "Failed to upload QR code" });
    }
  });

  // Alerts
  app.get("/api/alerts", async (req, res) => {
    try {
      res.json(await storage.getAlerts());
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.patch("/api/alerts/:id/read", async (req, res) => {
    try {
      const alert = await storage.markAlertAsRead(req.params.id);
      if (!alert) return res.status(404).json({ error: "Alert not found" });
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark alert as read" });
    }
  });

  // Gemini AI Routes
  app.post("/api/ai/verify-payment", uploadMemory.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Image file is required." });
      const result = await verifyPaymentSlip(req.file.buffer, req.file.mimetype);
      res.json(result);
    } catch (error) {
      console.error("Error in /api/ai/verify-payment:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  });

  app.post("/api/ai/ask-business", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required." });

      const settings = await storage.getAppSettings();
      const hasGeminiKey = settings.geminiApiKey && settings.geminiApiKey.trim() !== '';
      const hasGroqKey = settings.groqApiKey && settings.groqApiKey.trim() !== '';

      if (!hasGeminiKey && !hasGroqKey) {
        return res.status(400).json({
          error: "No AI API Key configured. Please save your Gemini or Groq API Key in Settings first.",
          settingsLink: true
        });
      }

      const contextData = await storage.getAIContextData();
      const response = await askGeminiAboutBusiness(prompt, contextData);

      res.json({ response });
    } catch (error) {
      console.error("Error in /api/ai/ask-business:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  });

  // Reports Routes
  app.get("/api/reports/pnl", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const report = await getProfitLossReport(startDate as string, endDate as string);
      res.json(report);
    } catch (error) {
      console.error("Error fetching P&L report:", error);
      res.status(500).json({ error: "Failed to fetch P&L report" });
    }
  });

  // AI Risk Analysis
  app.get("/api/ai/risk-analysis", async (req, res) => {
    try {
      const analysis = await getAllCustomerRiskAnalysis();
      res.json(analysis);
    } catch (error) {
      console.error("Error fetching risk analysis:", error);
      res.status(500).json({ error: "Failed to fetch risk analysis" });
    }
  });

  // Gemini P&L Summary
  app.get("/api/gemini/pnl-summary", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const pnlReport = await getProfitLossReport(startDate as string, endDate as string);
      const prompt = `Analyze this Profit & Loss report and provide a concise executive summary with key insights and recommendations:`;
      const summary = await generateReportSummary(prompt, JSON.stringify(pnlReport, null, 2));
      res.json({ summary });
    } catch (error) {
      console.error("Error generating P&L summary:", error);
      res.status(500).json({ error: "Failed to generate P&L summary" });
    }
  });

  // Gemini AI Chat - Context-Aware Business Assistant
  app.post("/api/gemini/ask", async (req, res) => {
    try {
      const { question } = req.body;
      if (!question) {
        return res.status(400).json({ error: "Question is required" });
      }

      const settings = await storage.getAppSettings();
      const hasGeminiKey = settings.geminiApiKey && settings.geminiApiKey.trim() !== '';
      const hasGroqKey = settings.groqApiKey && settings.groqApiKey.trim() !== '';

      if (!hasGeminiKey && !hasGroqKey) {
        return res.status(400).json({
          error: "No AI API Key configured. Please save your Gemini or Groq API Key in Settings first.",
          settingsLink: true
        });
      }

      const contextData = await storage.getAIContextData();
      const response = await askGeminiAboutBusiness(question, contextData);

      res.json({ response });
    } catch (error) {
      console.error("Error in /api/gemini/ask:", error);
      res.status(500).json({ error: "Failed to process AI request" });
    }
  });

  // AI System Doctor - Analyze business & system health with AI
  app.post("/api/gemini/system-doctor", async (req, res) => {
    try {
      const { systemLogs } = req.body;

      if (!systemLogs) {
        return res.status(400).json({ error: "systemLogs is required" });
      }

      // Perform real DB health check to add to logs
      let dbHealthy = true;
      let dbLatency = "0ms";
      try {
        const startTime = Date.now();
        db.run(sql`SELECT 1`);
        dbLatency = `${Date.now() - startTime}ms`;
      } catch (dbError) {
        dbHealthy = false;
        dbLatency = "timeout";
        console.error('[SYSTEM-DOCTOR] DB health check failed:', dbError);
      }

      // Merge real DB metrics with frontend-provided logs
      const enrichedLogs = {
        ...systemLogs,
        dbHealthy,
        dbLatency,
      };

      // --- FETCH BUSINESS DATA FOR CFO CONTEXT ---
      const today = new Date().toISOString().split('T')[0];

      // 1. Get Today's Sales
      // SQLite text comparison for ISO dates works for 'startsWith' logic
      const todaySalesData = await db.select().from(sales)
        .where(sql`${sales.timestamp} LIKE ${today + '%'}`);

      const todaySalesTotal = todaySalesData.reduce((sum, s) => sum + s.total, 0);

      // 2. Get Today's Expenses
      const todayExpensesData = await db.select().from(expenses)
        .where(sql`${expenses.date} LIKE ${today + '%'}`); // Handle both YYYY-MM-DD and ISO

      const todayExpensesTotal = todayExpensesData.reduce((sum, e) => sum + e.amount, 0);

      // 3. Get Low Stock Items
      // Assuming minStockLevel > 0 to filter out things that don't need tracking
      const lowStockProducts = await db.select({
        name: products.name,
        stock: products.stock,
        minStockLevel: products.minStockLevel
      }).from(products)
        .where(sql`${products.stock} <= ${products.minStockLevel} AND ${products.status} = 'active'`)
        .limit(10); // Limit to top 10 to avoid payload explosion for AI

      // 4. Calculate Guest Order Percentage (New CFO Metric)
      const totalOrdersToday = todaySalesData.length;
      const guestOrdersToday = todaySalesData.filter(s => s.guestId !== null).length;
      const guestOrderPercent = totalOrdersToday > 0
        ? Math.round((guestOrdersToday / totalOrdersToday) * 100)
        : 0;

      const businessData = {
        todaySales: todaySalesTotal,
        totalExpenses: todayExpensesTotal, // Using today's expenses as proxy for "Total Expenses" in daily context
        netProfit: todaySalesTotal - todayExpensesTotal,
        lowStockCount: lowStockProducts.length,
        lowStockItems: lowStockProducts.map(p => `${p.name} (${p.stock})`),
        guestOrderPercent // Pass to AI
      };

      console.log('[SYSTEM-DOCTOR] Analyzing system health with CFO data:', { enrichedLogs, businessData });

      // Pass both logs and business data to the AI
      const diagnosis = await analyzeSystemHealth(enrichedLogs, businessData);

      console.log('[SYSTEM-DOCTOR] Diagnosis result:', diagnosis);

      res.json(diagnosis);
    } catch (error) {
      console.error("Error in /api/gemini/system-doctor:", error);
      res.status(500).json({
        status: 'critical',
        message: 'စနစ်စစ်ဆေးမှု မအောင်မြင်ပါ။',
        fix: 'Please try again later or contact support.'
      });
    }
  });

  // Database Backup & Restore Routes (PostgreSQL - backup not supported via file download)
  app.get("/api/admin/backup", isAuthenticated, requireAdmin, async (req, res) => {
    // PostgreSQL backups should be done via pg_dump or Supabase dashboard
    res.status(501).json({
      error: "Database backup not available for PostgreSQL via this endpoint",
      message: "Please use Supabase dashboard or pg_dump for database backups"
    });
  });

  app.post("/api/admin/restore", isAuthenticated, requireAdmin, upload.single('file'), async (req, res) => {
    // PostgreSQL restores should be done via psql or Supabase dashboard
    res.status(501).json({
      error: "Database restore not available for PostgreSQL via this endpoint",
      message: "Please use Supabase dashboard or psql for database restores"
    });
  });

  // --- Customer Feedback Route ---
  app.post("/api/feedback", async (req, res) => {
    try {
      // Check for either legacy staff session or explicit customerId
      const customerId = (req.session as any).customerId || (req.session as any).staffId;

      if (!customerId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { orderId, rating, comment } = req.body;

      if (!orderId || !rating) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Verify order belongs to customer (check both customerId and guestId)
      const existingOrder = await storage.getSale(orderId);

      // We need to check if ANY of the ID fields match the logged-in user
      const isOwner = existingOrder && (
        existingOrder.customerId === customerId ||
        existingOrder.guestId === customerId ||
        existingOrder.staffId === customerId
      );

      if (!isOwner) {
        return res.status(403).json({ error: "Invalid order permission" });
      }

      // Create feedback
      const newFeedback: InsertFeedback = {
        customerId,
        orderId,
        rating,
        comment: comment || null,
      };

      const feedbackRecord = await storage.createFeedback(newFeedback);
      res.json(feedbackRecord);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  return httpServer;
}