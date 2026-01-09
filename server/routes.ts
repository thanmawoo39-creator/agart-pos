import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { productSchema, customerSchema, saleSchema, creditLedgerSchema, staffSchema, expenseSchema, insertExpenseSchema, appSettingsSchema, shiftSchema, alertSchema, type Sale, type Shift, type InsertShift, type Alert, type InsertAlert, type Attendance } from "../shared/schema";
import { getAIInsights, getAllCustomerRiskAnalysis, analyzeCustomerRisk, getProfitLossReport, getExpenseInsights } from "./lib/ai-engine";
import { askGeminiAboutBusiness, verifyPaymentSlip, identifyGroceryItem, generateReportSummary } from "./lib/gemini";
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import aiRouter from './routes/ai';
import { isAuthenticated, requireAdmin, requireManager } from './middleware/auth';

const storageConfig = multer.diskStorage({
  destination: async (req, file, cb) => {
    // FIX: Use process.cwd() for consistent path resolution
    const uploadPath = path.join(process.cwd(), 'public/uploads');
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedOriginalName}`);
  }
});

const upload = multer({ storage: storageConfig });
const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const pinSchema = z.object({
  pin: z.string().length(4).regex(/^\d+$/, "PIN must be 4 digits"),
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await storage.initialize();

  if (process.env.NODE_ENV !== 'production') {
    try {
      const current = await storage.getCurrentShift();
      if (!current.isActive) {
        const staff = await storage.getStaff();
        const admin = staff.find((s) => s.pin === '0000' || s.role === 'owner');
        if (admin) {
          await storage.clockIn(admin.id, admin.name);
          console.log('Dev: auto clocked in', admin.name);
        }
      }
    } catch (err) {
      console.error('Dev auto-clock-in failed:', err);
    }
  }

  app.use('/api/ai', aiRouter);

  app.get('/api/health', async (req, res) => {
    try {
      const hasApiKey = !!(process.env.GEMINI_API_KEY);
      res.json({ ok: true, geminiLoaded: hasApiKey });
    } catch (err) {
      console.error('Health check failed:', err);
      res.status(500).json({ ok: false });
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
      const sales = await storage.getSales();
      const products = await storage.getProducts();

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Today's Sales
      const todaySales = sales.filter(s => new Date(s.timestamp) >= todayStart);
      const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);

      // Monthly Sales
      const monthlySales = sales.filter(s => new Date(s.timestamp) >= monthStart);
      const monthlyRevenue = monthlySales.reduce((sum, s) => sum + s.total, 0);

      // Total Orders
      const totalOrders = sales.length;

      // Low Stock Items
      const lowStockItems = products.filter(p => p.stock <= (p.minStockLevel || 10));

      // Daily Sales for Last 7 Days
      const dailySales = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const daySales = sales.filter(s => {
          const saleDate = new Date(s.timestamp);
          return saleDate >= dayStart && saleDate < dayEnd;
        });

        dailySales.push({
          date: dayStart.toISOString().split('T')[0],
          revenue: daySales.reduce((sum, s) => sum + s.total, 0),
          orders: daySales.length
        });
      }

      // Top Products (from sale_items)
      const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();

      for (const sale of sales) {
        for (const item of sale.items) {
          const existing = productSales.get(item.productId) || { name: item.productName, quantity: 0, revenue: 0 };
          existing.quantity += item.quantity;
          existing.revenue += item.total;
          productSales.set(item.productId, existing);
        }
      }

      const topProducts = Array.from(productSales.entries())
        .map(([id, data]) => ({ productId: id, ...data }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      res.json({
        todayRevenue,
        todayOrders: todaySales.length,
        monthlyRevenue,
        monthlyOrders: monthlySales.length,
        totalOrders,
        lowStockCount: lowStockItems.length,
        lowStockItems: lowStockItems.map(p => ({ id: p.id, name: p.name, stock: p.stock, minStockLevel: p.minStockLevel })),
        dailySales,
        topProducts
      });
    } catch (error) {
      console.error("Error fetching analytics summary:", error);
      res.status(500).json({ error: "Failed to fetch analytics summary" });
    }
  });

  // Products
  app.get("/api/products", isAuthenticated, async (req, res) => {
    try {
      res.json(await storage.getProducts());
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", isAuthenticated, requireManager, upload.single('image'), async (req, res) => {
    try {
      // Manual parsing to handle FormData with proper null handling
      const body: any = {
        ...req.body,
        price: parseFloat(req.body.price),
        stock: req.body.stock ? parseInt(req.body.stock, 10) : 0,
        minStockLevel: req.body.minStockLevel ? parseInt(req.body.minStockLevel, 10) : 0,
      };

      // Only include optional fields if they have values
      if (req.body.cost) body.cost = parseFloat(req.body.cost);
      if (req.body.barcode) body.barcode = req.body.barcode;
      if (req.body.category) body.category = req.body.category;
      if (req.body.imageData) body.imageData = req.body.imageData;
      if (req.body.unit) body.unit = req.body.unit;

      const parsed = productSchema.omit({ id: true }).safeParse(body);
      if (!parsed.success) {
        console.error("Product validation failed:", parsed.error.errors);
        return res.status(400).json({ error: "Invalid product data", details: parsed.error.errors });
      }

      const productData = parsed.data as any;
      if (req.file) productData.imageUrl = req.file.filename;

      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", upload.single('image'), async (req, res) => {
    try {
      const updateData: any = { ...req.body };
       if (req.body.price) updateData.price = parseFloat(req.body.price);
       if (req.body.stock) updateData.stock = parseInt(req.body.stock, 10);
       if (req.body.cost) updateData.cost = parseFloat(req.body.cost);

      if (req.file) updateData.imageUrl = req.file.filename;
      
      const product = await storage.updateProduct(req.params.id, updateData);
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Product not found" });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Customers
  app.get("/api/customers", isAuthenticated, async (req, res) => {
    try {
      res.json(await storage.getCustomers());
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const parsed = customerSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid customer data", details: parsed.error.errors });
      res.status(201).json(await storage.createCustomer(parsed.data));
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      // Clean up the request body - convert empty strings to null for optional fields
      const cleanedData: any = { ...req.body };
      if (cleanedData.email === '') cleanedData.email = null;
      if (cleanedData.phone === '') cleanedData.phone = null;
      if (cleanedData.barcode === '') cleanedData.barcode = null;
      if (cleanedData.imageUrl === '') cleanedData.imageUrl = null;

      // Validate using partial schema (all fields optional for updates)
      const parsed = customerSchema.partial().safeParse(cleanedData);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid customer data",
          details: parsed.error.errors
        });
      }

      const customer = await storage.updateCustomer(req.params.id, parsed.data);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      res.json(customer);
    } catch (error) {
      console.error("Error updating customer:", error);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCustomer(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Customer not found" });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  // Sales
  app.get("/api/sales", isAuthenticated, async (req, res) => {
    try {
      const { date, startDate, endDate } = req.query;
      const sales = await storage.getSales();
      let filteredSales = sales;
      if (date) {
        filteredSales = sales.filter((sale: any) => new Date(sale.timestamp).toISOString().split('T')[0] === date);
      } else if (startDate && endDate) {
        filteredSales = sales.filter((sale: any) => {
          const saleDate = new Date(sale.timestamp).toISOString().split('T')[0];
          return saleDate >= (startDate as string) && saleDate <= (endDate as string);
        });
      }
      filteredSales.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json(filteredSales);
    } catch (error) {
      console.error('Error fetching sales:', error);
      res.status(500).json({ error: 'Failed to fetch sales' });
    }
  });

  app.get("/api/sales/:id", async (req, res) => {
    try {
      const sale = await storage.getSale(req.params.id);
      if (!sale) return res.status(404).json({ error: "Sale not found" });
      res.json(sale);
    } catch (error) {
      console.error("Error fetching sale:", error);
      res.status(500).json({ error: "Failed to fetch sale" });
    }
  });

  // POST /api/sales - Non-Blocking Sale Creation with Fail-Safe Shift Update
  app.post("/api/sales", isAuthenticated, async (req, res) => {
    try {
      // Helper function to ensure numbers are valid
      const safeNumber = (value: any): number => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return !isNaN(num) && isFinite(num) ? num : 0;
      };

      // Step 1: Validate sale data
      const parsed = saleSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid sale data",
          details: parsed.error.errors
        });
      }

      const saleData = parsed.data;

      // Step 2: Validate that a shift is active
      const currentShift = await storage.getCurrentShift();
      if (!currentShift.isActive || !currentShift.attendanceId) {
        return res.status(400).json({
          error: "No active shift found. Please open a shift before making sales."
        });
      }

      // Step 3: Sanitize all monetary values to prevent NaN issues
      const sanitizedSale = {
        ...saleData,
        total: safeNumber(saleData.total),
        subtotal: safeNumber(saleData.subtotal),
        tax: safeNumber(saleData.tax),
        discount: safeNumber(saleData.discount),
      };

      // Step 4: Record the sale in the database (CRITICAL - Must succeed)
      const createdSale = await storage.createSale(sanitizedSale);

      // Step 5: Update Shift Totals (NON-BLOCKING / FAIL-SAFE)
      // This must NOT prevent the voucher from being printed
      try {
        // Fetch current attendance record to get existing totals
        const allAttendance = await storage.getAttendance();
        const currentAttendance = allAttendance.find(a => a.id === currentShift.attendanceId);

        if (!currentAttendance) {
          console.error("[SHIFT-UPDATE-WARN] Sale created but attendance record not found:", currentShift.attendanceId);
        } else {
          // Calculate new totals based on payment method
          const saleTotal = safeNumber(sanitizedSale.total);
          const currentTotalSales = safeNumber(currentAttendance.totalSales);
          const currentCashSales = safeNumber(currentAttendance.cashSales);
          const currentCardSales = safeNumber(currentAttendance.cardSales);
          const currentCreditSales = safeNumber(currentAttendance.creditSales);
          const currentMobileSales = safeNumber(currentAttendance.mobileSales);

          // Determine which payment type to increment
          const updates: Partial<Attendance> = {
            totalSales: currentTotalSales + saleTotal,
          };

          switch (sanitizedSale.paymentMethod) {
            case 'cash':
              updates.cashSales = currentCashSales + saleTotal;
              break;
            case 'card':
              updates.cardSales = currentCardSales + saleTotal;
              break;
            case 'credit':
              updates.creditSales = currentCreditSales + saleTotal;
              break;
            case 'mobile':
              updates.mobileSales = currentMobileSales + saleTotal;
              break;
          }

          // Update the attendance record with new totals
          const updatedAttendance = await storage.updateAttendance(
            currentShift.attendanceId,
            updates
          );

          if (!updatedAttendance) {
            console.error("[SHIFT-UPDATE-WARN] Failed to update shift totals for sale:", createdSale.id);
          } else {
            console.log(`[SHIFT-UPDATE-OK] Sale ${createdSale.id}: Updated shift totals - Total: ${updates.totalSales}, Payment: ${sanitizedSale.paymentMethod}`);
          }
        }
      } catch (updateError) {
        // CRITICAL: Log error but DO NOT crash the request
        // The voucher must still be printed
        console.error("[SHIFT-UPDATE-ERROR] Failed to update shift totals (sale still recorded):", updateError);
      }

      // Step 6: ALWAYS return the sale to the frontend (for voucher printing)
      // CRITICAL FIX: Construct response explicitly to ensure 'items' is an Array, not a DB string
      // The database may return items as a JSON string, which crashes the frontend modal
      const responseData = {
        ...sanitizedSale,              // Use the original clean data (items is definitely an array here)
        id: createdSale.id,            // Include the generated ID from database
        timestamp: createdSale.timestamp || sanitizedSale.timestamp // Use confirmed timestamp
      };

      // DOUBLE CHECK: Ensure items is definitely an array (defense against DB serialization)
      if (typeof responseData.items === 'string') {
        try {
          responseData.items = JSON.parse(responseData.items);
          console.warn('[SALE-RESPONSE] Items was a string, parsed to array');
        } catch (parseError) {
          console.error('[SALE-RESPONSE] Failed to parse items string, using empty array:', parseError);
          responseData.items = []; // Fallback to prevent frontend crash
        }
      }

      console.log('[SALE-RESPONSE] Sending response with items array of length:', Array.isArray(responseData.items) ? responseData.items.length : 'NOT AN ARRAY');
      res.status(201).json(responseData);
    } catch (error) {
      console.error("[SALE-CREATE-ERROR] Fatal error creating sale:", error);
      res.status(500).json({ error: "Failed to create sale" });
    }
  });

  // Credit Ledger
  app.get("/api/credit-ledger", async (req, res) => {
    try {
      res.json(await storage.getCreditLedger());
    } catch (error) {
      console.error("Error fetching credit ledger:", error);
      res.status(500).json({ error: "Failed to fetch credit ledger" });
    }
  });

  app.post("/api/credit-ledger", async (req, res) => {
    try {
      const parsed = creditLedgerSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid credit ledger data", details: parsed.error.errors });
      res.status(201).json(await storage.createCreditLedgerEntry(parsed.data));
    } catch (error) {
      console.error("Error creating credit ledger entry:", error);
      res.status(500).json({ error: "Failed to create credit ledger entry" });
    }
  });

  // POS Engine Routes - Now using storage directly
  app.get("/api/scan/product/:barcode", async (req, res) => {
    try {
      const products = await storage.getProducts();
      const product = products.find(p => p.barcode === req.params.barcode);
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(product);
    } catch (error) {
      console.error("Error scanning product:", error);
      res.status(500).json({ error: "Failed to scan product" });
    }
  });

  app.get("/api/scan/customer/:barcode", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      const customer = customers.find(c => c.barcode === req.params.barcode);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      res.json(customer);
    } catch (error) {
      console.error("Error scanning customer:", error);
      res.status(500).json({ error: "Failed to scan customer" });
    }
  });

  app.get("/api/customers/:id/ledger", async (req, res) => {
    try {
      const ledger = await storage.getCreditLedger();
      const customerLedger = ledger.filter(entry => entry.customerId === req.params.id);
      res.json(customerLedger);
    } catch (error) {
      console.error("Error fetching customer ledger:", error);
      res.status(500).json({ error: "Failed to fetch customer ledger" });
    }
  });

  app.post("/api/customers/:id/payment", async (req, res) => {
    try {
      const { amount, description, createdBy } = req.body;
      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ error: "Invalid payment amount" });
      }

      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const newBalance = Math.max(0, customer.currentBalance - amount);

      // Create ledger entry
      await storage.createCreditLedgerEntry({
        customerId: customer.id,
        customerName: customer.name,
        type: "payment",
        amount: amount,
        balanceAfter: newBalance,
        description: description || "Payment received",
        timestamp: new Date().toISOString(),
        createdBy: createdBy,
      });

      // Update customer balance
      await storage.updateCustomer(req.params.id, {
        currentBalance: newBalance,
      });

      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error adding payment:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to add payment" });
    }
  });

  app.post("/api/customers/:id/repay", async (req, res) => {
    try {
      const { amount, description, createdBy } = req.body;
      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ error: "Invalid repayment amount" });
      }

      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const newBalance = customer.currentBalance - amount;

      // Create ledger entry
      await storage.createCreditLedgerEntry({
        customerId: customer.id,
        customerName: customer.name,
        type: "repayment",
        amount: -amount,
        balanceAfter: newBalance,
        description: description || "Debt Repayment",
        timestamp: new Date().toISOString(),
        createdBy: createdBy,
      });

      // Update customer balance
      await storage.updateCustomer(req.params.id, {
        currentBalance: newBalance,
      });

      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error adding repayment:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to add repayment" });
    }
  });

  // POST /api/sales/complete - Legacy endpoint with Fail-Safe Shift Update
  app.post("/api/sales/complete", async (req, res) => {
    try {
      console.log('[SALE-COMPLETE] Starting sale completion...');

      const parsed = saleSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) {
        console.error('[SALE-COMPLETE] Validation failed:', parsed.error.errors);
        return res.status(400).json({ error: "Invalid sale data", details: parsed.error.errors });
      }

      console.log('[SALE-COMPLETE] Calling storage.createSale...');
      const sale = await storage.createSale(parsed.data);
      console.log('[SALE-COMPLETE] Sale created:', sale.id);

      // Try to update shift totals (NON-BLOCKING / FAIL-SAFE)
      try {
        const currentShift = await storage.getCurrentShift();
        if (currentShift && currentShift.isActive && currentShift.attendanceId) {
          const allAttendance = await storage.getAttendance();
          const currentAttendance = allAttendance.find(a => a.id === currentShift.attendanceId);

          if (currentAttendance) {
            const safeNumber = (value: any): number => {
              const num = typeof value === 'number' ? value : parseFloat(value);
              return !isNaN(num) && isFinite(num) ? num : 0;
            };

            const saleTotal = safeNumber(parsed.data.total);
            const currentTotalSales = safeNumber(currentAttendance.totalSales);
            const currentCashSales = safeNumber(currentAttendance.cashSales);
            const currentCardSales = safeNumber(currentAttendance.cardSales);
            const currentCreditSales = safeNumber(currentAttendance.creditSales);
            const currentMobileSales = safeNumber(currentAttendance.mobileSales);

            const updates: Partial<Attendance> = {
              totalSales: currentTotalSales + saleTotal,
            };

            switch (parsed.data.paymentMethod) {
              case 'cash':
                updates.cashSales = currentCashSales + saleTotal;
                break;
              case 'card':
                updates.cardSales = currentCardSales + saleTotal;
                break;
              case 'credit':
                updates.creditSales = currentCreditSales + saleTotal;
                break;
              case 'mobile':
                updates.mobileSales = currentMobileSales + saleTotal;
                break;
            }

            await storage.updateAttendance(currentShift.attendanceId, updates);
            console.log('[SALE-COMPLETE] Shift totals updated successfully');
          }
        } else {
          console.warn('[SALE-COMPLETE] No active shift found, skipping shift update');
        }
      } catch (shiftError) {
        console.error('[SALE-COMPLETE] Shift update failed (non-blocking):', shiftError);
      }

      // ALWAYS return success response
      console.log('[SALE-COMPLETE] Returning success response with sale ID:', sale.id);
      res.status(201).json({ id: sale.id, success: true });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("[SALE-COMPLETE] Error:", err.message);
      res.status(500).json({ error: err.message || "Failed to complete sale." });
    }
  });

  // Staff Management
  app.get("/api/staff", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const staff = await storage.getStaff();
      res.json(staff.map(({ pin, ...rest }) => rest));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });

  app.get("/api/staff/:id", async (req, res) => {
    try {
      const staffMember = await storage.getStaffMember(req.params.id);
      if (!staffMember) return res.status(404).json({ error: "Staff member not found" });
      const { pin, ...safeStaff } = staffMember;
      res.json(safeStaff);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff member" });
    }
  });

  app.post("/api/staff", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const parsed = staffSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid staff data", details: parsed.error.errors });
      const staffMember = await storage.createStaff(parsed.data);
      const { pin, ...safeStaff } = staffMember;
      res.status(201).json(safeStaff);
    } catch (error) {
      res.status(500).json({ error: "Failed to create staff member" });
    }
  });

  app.patch("/api/staff/:id", async (req, res) => {
    try {
      const staffMember = await storage.updateStaff(req.params.id, req.body);
      if (!staffMember) return res.status(404).json({ error: "Staff member not found" });
      const { pin, ...safeStaff } = staffMember;
      res.json(safeStaff);
    } catch (error) {
      res.status(500).json({ error: "Failed to update staff member" });
    }
  });

  app.delete("/api/staff/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      if (!await storage.deleteStaff(req.params.id)) return res.status(404).json({ error: "Staff member not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete staff member" });
    }
  });

  app.post("/api/staff/:id/suspend", async (req, res) => {
    try {
      const staffMember = await storage.suspendStaff(req.params.id);
      if (!staffMember) return res.status(404).json({ error: "Staff member not found" });
      const { pin, ...safeStaff } = staffMember;
      res.json(safeStaff);
    } catch (error) {
      res.status(500).json({ error: "Failed to suspend staff member" });
    }
  });

  app.post("/api/staff/:id/activate", async (req, res) => {
    try {
      const staffMember = await storage.activateStaff(req.params.id);
      if (!staffMember) return res.status(404).json({ error: "Staff member not found" });
      const { pin, ...safeStaff } = staffMember;
      res.json(safeStaff);
    } catch (error) {
      res.status(500).json({ error: "Failed to activate staff member" });
    }
  });
    // Attendance Management
  app.get("/api/attendance/current", async (req, res) => {
    try {
      res.json(await storage.getCurrentShift());
    } catch (error) {
      res.status(500).json({ error: "Failed to get current shift" });
    }
  });

  app.post("/api/attendance/clock-in", async (req, res) => {
    try {
      const parsed = pinSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "PIN must be 4 digits" });
      const { pin } = parsed.data;
      const staffMember = await storage.getStaffByPin(pin);
      if (!staffMember) return res.status(401).json({ error: "Invalid PIN" });
      if (staffMember.status === "suspended") return res.status(401).json({ error: "Staff account is suspended" });

      const currentShift = await storage.getCurrentShift();
      if (currentShift.isActive) return res.status(400).json({ error: `${currentShift.staffName} is already clocked in.` });

      const attendance = await storage.clockIn(staffMember.id, staffMember.name);
      res.json({ success: true, attendance, staffName: staffMember.name });
    } catch (error) {
      res.status(500).json({ error: "Failed to clock in" });
    }
  });

  app.post("/api/attendance/clock-out", async (req, res) => {
    try {
      const parsed = pinSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "PIN must be 4 digits" });
      const { pin } = parsed.data;
      const staffMember = await storage.getStaffByPin(pin);
      if (!staffMember) return res.status(401).json({ error: "Invalid PIN" });

      const currentShift = await storage.getCurrentShift();
      if (!currentShift.isActive) return res.status(400).json({ error: "No active shift" });
      if (currentShift.staffId !== staffMember.id) return res.status(400).json({ error: `Only ${currentShift.staffName} can clock out` });

      const attendance = await storage.clockOut(currentShift.attendanceId!);
      res.json({ success: true, attendance, totalHours: attendance?.totalHours });
    } catch (error) {
      res.status(500).json({ error: "Failed to clock out" });
    }
  });

  app.get("/api/attendance/report", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        const today = new Date().toISOString().split("T")[0];
        return res.json(await storage.getAttendanceByDate(today));
      }
      res.json(await storage.getAttendanceReport(startDate as string, endDate as string));
    } catch (error) {
      res.status(500).json({ error: "Failed to get attendance report" });
    }
  });

  app.get("/api/attendance", async (req, res) => {
    try {
      res.json(await storage.getAttendance());
    } catch (error) {
      res.status(500).json({ error: "Failed to get attendance" });
    }
  });

  // Inventory Management
  const stockAdjustmentSchema = z.object({
    quantityChange: z.number().int(),
    type: z.enum(["stock-in", "adjustment"]),
    reason: z.string().min(1, "Reason is required"),
    staffId: z.string().optional(),
    staffName: z.string().optional(),
  });

  app.post("/api/inventory/adjust/:productId", async (req, res) => {
    try {
      const parsed = stockAdjustmentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      const { quantityChange, type, reason, staffId, staffName } = parsed.data;
      const result = await storage.adjustStock(req.params.productId, quantityChange, type, staffId, staffName, reason);
      if (!result) return res.status(404).json({ error: "Product not found" });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to adjust stock" });
    }
  });

  // Staff Authentication
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { pin, barcode } = req.body;
      let staffMember = null;
      if (pin) staffMember = await storage.getStaffByPin(pin);
      else if (barcode) staffMember = await storage.getStaffByBarcode(barcode);

      if (!staffMember) return res.status(401).json({ error: "Invalid credentials" });
      if (staffMember.status === "suspended") return res.status(401).json({ error: "Staff account is suspended" });

      // Create session
      req.session.user = {
        id: staffMember.id,
        name: staffMember.name,
        role: staffMember.role,
      };

      const { pin: _, ...safeStaff } = staffMember;
      res.json({ staff: safeStaff, loginTime: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ error: "Failed to authenticate" });
    }
  });

  // Session verification route
  app.get("/api/auth/verify", (req, res) => {
    if (req.session.user) {
      res.json({ valid: true, user: req.session.user });
    } else {
      res.status(401).json({ valid: false });
    }
  });

  // Logout route
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  // File Upload - Generic upload endpoint for images
  app.post("/api/upload", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Construct the URL path to the uploaded file
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

  app.post("/api/expenses", async (req, res) => {
    try {
      const parsed = insertExpenseSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid expense data", details: parsed.error.errors });
      res.status(201).json(await storage.createExpense(parsed.data));
    } catch (error) {
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.patch("/api/expenses/:id", async (req, res) => {
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

  // Settings
  app.get("/api/settings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      res.json(await storage.getAppSettings());
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const parsed = appSettingsSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid settings data", details: parsed.error.errors });
      res.json(await storage.updateAppSettings(parsed.data));
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Analytics Summary
  app.get("/api/analytics/summary", async (req, res) => {
    try {
      res.json(await storage.getAnalyticsSummary());
    } catch (error) {
      console.error("Error fetching analytics summary:", error);
      res.status(500).json({ error: "Failed to fetch analytics summary" });
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
  app.post("/api/ai/identify-item", uploadMemory.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Image file is required." });
      const result = await identifyGroceryItem(req.file.buffer, req.file.mimetype);
      if (!result.success) return res.status(404).json({ error: 'Could not identify item', details: result.warnings });
      
      const returnedName = result.data?.name;
      if (!returnedName) return res.status(404).json({ error: 'AI did not return a name' });
      const products = await storage.getProducts();
      
      // NEW: Improved Fuzzy Matching (Case insensitive, partial match)
      const normalizedReturn = returnedName.trim().toLowerCase();
      const match = products.find(p => {
        const pName = p.name.trim().toLowerCase();
        return pName === normalizedReturn || pName.includes(normalizedReturn) || normalizedReturn.includes(pName);
      });
      
      if (match) return res.json(match);

      res.status(404).json({ error: 'No product match found for AI result', returnedName });
    } catch (error) {
      console.error("Error in /api/ai/identify-item:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  });

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

      // Step 1: Verify at least one API Key is configured (Gemini or Groq)
      const settings = await storage.getAppSettings();
      const hasGeminiKey = settings.geminiApiKey && settings.geminiApiKey.trim() !== '';
      const hasGroqKey = settings.groqApiKey && settings.groqApiKey.trim() !== '';

      if (!hasGeminiKey && !hasGroqKey) {
        return res.status(400).json({
          error: "No AI API Key configured. Please save your Gemini or Groq API Key in Settings first.",
          settingsLink: true
        });
      }

      // Step 2: Gather Real-Time Context from Database
      const contextData = await storage.getAIContextData();

      // Step 3: Call AI with Rich Context (uses failover: Gemini → Groq → Fallback)
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

      // Get the P&L report first
      const pnlReport = await getProfitLossReport(startDate as string, endDate as string);

      // Create a prompt to summarize the P&L
      const prompt = `Analyze this Profit & Loss report and provide a concise executive summary with key insights and recommendations:`;

      // Call Gemini to generate the summary
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

      // Step 1: Verify at least one API Key is configured (Gemini or Groq)
      const settings = await storage.getAppSettings();
      const hasGeminiKey = settings.geminiApiKey && settings.geminiApiKey.trim() !== '';
      const hasGroqKey = settings.groqApiKey && settings.groqApiKey.trim() !== '';

      if (!hasGeminiKey && !hasGroqKey) {
        return res.status(400).json({
          error: "No AI API Key configured. Please save your Gemini or Groq API Key in Settings first.",
          settingsLink: true
        });
      }

      // Step 2: Gather Real-Time Context from Database
      const contextData = await storage.getAIContextData();

      // Step 3: Call AI with Rich Context (uses failover: Gemini → Groq → Fallback)
      const response = await askGeminiAboutBusiness(question, contextData);

      // Return response as JSON
      res.json({ response });
    } catch (error) {
      console.error("Error in /api/gemini/ask:", error);
      res.status(500).json({ error: "Failed to process AI request" });
    }
  });

  // --- SHIFT MANAGEMENT ROUTES (Refactored to use DB Storage) ---

  // 1. Get Current Active Shift
  app.get("/api/shifts/current", async (req, res) => {
    try {
      // Use DB storage source of truth
      const currentShift = await storage.getCurrentShift();

      // Only return if it's actually active
      if (currentShift && currentShift.isActive && currentShift.attendanceId) {
        // Fetch the full attendance record to get financial data
        const allAttendance = await storage.getAttendance();
        const fullAttendance = allAttendance.find(a => a.id === currentShift.attendanceId);

        if (!fullAttendance) {
          return res.status(404).json({ error: "Attendance record not found" });
        }

        // Helper to ensure numbers are valid
        const safeNumber = (value: any): number => {
          const num = typeof value === 'number' ? value : parseFloat(value);
          return !isNaN(num) && isFinite(num) ? num : 0;
        };

        const mappedShift = {
          ...currentShift,
          // 1. Time & ID mappings
          startTime: currentShift.clockInTime,
          shiftId: currentShift.attendanceId,

          // 2. State flags
          isOpen: true,
          status: 'open' as const,
          isActive: true,

          // 3. CRITICAL: Financial Data from Attendance Record
          // These values are now tracked in the database and updated with each sale
          openingCash: safeNumber(fullAttendance.openingCash),
          totalSales: safeNumber(fullAttendance.totalSales),
          cashSales: safeNumber(fullAttendance.cashSales),
          cardSales: safeNumber(fullAttendance.cardSales),
          creditSales: safeNumber(fullAttendance.creditSales),
          mobileSales: safeNumber(fullAttendance.mobileSales),
          // Calculate expected cash (opening cash + cash sales)
          expectedCash: safeNumber(fullAttendance.openingCash) + safeNumber(fullAttendance.cashSales),
          actualCash: safeNumber(fullAttendance.openingCash) + safeNumber(fullAttendance.cashSales),
        };
        res.json(mappedShift);
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Get current shift error:", error);
      res.status(500).json({ error: "Failed to fetch current shift" });
    }
  });

  // 2. Open a New Shift
  app.post("/api/shifts/open", async (req, res) => {
    try {
      const { staffId, staffName, openingCash } = req.body;

      // Check via DB storage
      const currentShift = await storage.getCurrentShift();
      if (currentShift.isActive) {
        return res.status(400).json({ error: `A shift is already open by ${currentShift.staffName}.` });
      }

      // Validate and sanitize openingCash
      const sanitizedOpeningCash = typeof openingCash === 'number' && !isNaN(openingCash) && isFinite(openingCash)
        ? openingCash
        : 0;

      // Use storage.clockIn which creates the attendance/shift record with financial tracking
      const newShift = await storage.clockIn(staffId, staffName, sanitizedOpeningCash);

      // Map DB fields to frontend expectations and add compatibility flags
      res.json({
        ...newShift,
        // 1. Time & ID mappings
        startTime: newShift.clockInTime,
        shiftId: newShift.id, // Explicitly provide shiftId

        // 2. State flags
        isOpen: true,
        status: 'open',
        isActive: true,

        // 3. Financial Data (now properly tracked in DB)
        expectedCash: sanitizedOpeningCash,
        actualCash: sanitizedOpeningCash,
      });
    } catch (error) {
      console.error("Open shift error:", error);
      res.status(500).json({ error: "Failed to open shift" });
    }
  });

  // 3. Close Shift
  app.post("/api/shifts/close", async (req, res) => {
    try {
      const { shiftId, actualCash } = req.body; 
      
      // Verify shift exists via DB
      const currentShift = await storage.getCurrentShift();
      if (!currentShift.isActive) {
        return res.status(404).json({ error: "No active shift found to close." });
      }

      // Perform Clock Out via DB
      const result = await storage.clockOut(currentShift.attendanceId!);
      
      if (!result) {
         return res.status(500).json({ error: "Failed to close shift record." });
      }

      res.json(result);
    } catch (error) {
      console.error("Close shift error:", error);
      res.status(500).json({ error: "Failed to close shift" });
    }
  });

  // 4. Shift History
  app.get("/api/shifts/history", async (req, res) => {
    try {
      // Use existing attendance report from DB
      const history = await storage.getAttendance();
      history.sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime());

      // Helper to ensure numbers are valid
      const safeNumber = (value: any): number => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return !isNaN(num) && isFinite(num) ? num : 0;
      };

      // Map DB fields to frontend expectations
      const historyForFrontend = history.map(shift => ({
        ...shift,
        startTime: shift.clockInTime,
        // Ensure all financial fields are valid numbers
        openingCash: safeNumber(shift.openingCash),
        totalSales: safeNumber(shift.totalSales),
        cashSales: safeNumber(shift.cashSales),
        cardSales: safeNumber(shift.cardSales),
        creditSales: safeNumber(shift.creditSales),
        mobileSales: safeNumber(shift.mobileSales),
      }));

      res.json(historyForFrontend);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shift history" });
    }
  });

  // 5. Get ALL Active Shifts (For the Overview Widget)
  app.get("/api/shifts", async (req, res) => {
    try {
      // Get all records
      const allShifts = await storage.getAttendance();

      // Filter: Only keep shifts that are NOT clocked out yet
      const activeShifts = allShifts.filter(s => !s.clockOutTime);

      // Helper to ensure numbers are valid
      const safeNumber = (value: any): number => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return !isNaN(num) && isFinite(num) ? num : 0;
      };

      // Map fields for Frontend
      const mappedActive = activeShifts.map(s => ({
        ...s,
        startTime: s.clockInTime,
        // Ensure all financial fields are valid numbers
        openingCash: safeNumber(s.openingCash),
        totalSales: safeNumber(s.totalSales),
        cashSales: safeNumber(s.cashSales),
        cardSales: safeNumber(s.cardSales),
        creditSales: safeNumber(s.creditSales),
        mobileSales: safeNumber(s.mobileSales),
        isActive: true
      }));

      res.json(mappedActive);
    } catch (error) {
      console.error("Get all shifts error:", error);
      res.status(500).json({ error: "Failed to fetch active shifts" });
    }
  });
  // --- SHIFT MANAGEMENT ROUTES (END) ---

  // Database Backup & Restore Routes
  app.get("/api/admin/backup", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const dbPath = path.join(process.cwd(), 'sqlite.db');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
      const backupFileName = `POS_Backup_${timestamp}.db`;
      
      // Create backup copy
      const backupPath = path.join(process.cwd(), backupFileName);
      await fs.copyFile(dbPath, backupPath);
      
      // Send file as download
      res.download(backupPath, backupFileName, (err) => {
        if (err) {
          console.error("Backup download error:", err);
          res.status(500).json({ error: "Failed to download backup" });
        } else {
          // Clean up temporary backup file
          fs.unlink(backupPath).catch(() => {}); // Ignore cleanup errors
        }
      });
    } catch (error) {
      console.error("Backup error:", error);
      res.status(500).json({ error: "Failed to create backup" });
    }
  });

  app.post("/api/admin/restore", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      // For now, just return success - actual restore would need careful implementation
      // to prevent data loss and ensure proper validation
      res.json({ 
        success: true, 
        message: "Restore endpoint ready - requires careful implementation to prevent data loss" 
      });
    } catch (error) {
      console.error("Restore error:", error);
      res.status(500).json({ error: "Failed to process restore" });
    }
  });

return httpServer;
}
