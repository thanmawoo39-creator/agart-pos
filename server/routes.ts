import type { Express } from "express";
import { type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { db, sqlite } from "./lib/db";
import {
  insertExpenseSchema,
  appSettingsSchema,
  type Alert
} from "../shared/schema";
import {
  getAllCustomerRiskAnalysis,
  getProfitLossReport
} from "./lib/ai-engine";
import {
  askGeminiAboutBusiness,
  verifyPaymentSlip,
  generateReportSummary
} from "./lib/gemini";
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

  // Mount Modular Routers
  app.use('/api/ai', aiRouter);
  app.use('/api/auth', authRouter);

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

  // Restaurant Tables
  app.get("/api/tables", isAuthenticated, requireRole('kitchen', 'cashier', 'manager'), async (req, res) => {
    try {
      const requestedBusinessUnitId = typeof req.query.businessUnitId === 'string' ? req.query.businessUnitId : null;
      const businessUnitId = requestedBusinessUnitId || req.user?.businessUnitId || null;
      const tables = await storage.getTables();

      // Hybrid safety: without a business unit, do not return cross-store data
      if (!businessUnitId) {
        return res.json([]);
      }

      const filteredTables = tables.filter(table => table.businessUnitId === businessUnitId);

      const withOrder = filteredTables.map((t: any) => {
        let orderCart: any[] = [];
        if (typeof t.currentOrder === 'string' && t.currentOrder.trim().length > 0) {
          try {
            const parsed = JSON.parse(t.currentOrder);
            if (Array.isArray(parsed)) {
              orderCart = parsed;
            }
          } catch (e) {
            console.error(`Error parsing currentOrder for table ${t.id}:`, e);
            orderCart = [];
          }
        }

        const items = orderCart.map((i: any) => ({
          id: i?.id || crypto.randomUUID(),
          name: i?.name || i?.productName || 'Item',
          quantity: Number(i?.quantity) || 0,
          price: Number(i?.unitPrice ?? i?.price) || 0,
        }));
        const total = items.reduce((sum: number, i: any) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);

        return {
          ...t,
          orderCart,
          currentOrder: items.length > 0 ? { items, total } : null,
        };
      });

      res.json(withOrder);
    } catch (error) {
      console.error("Error fetching tables:", error);
      res.status(500).json({ error: "Failed to fetch tables" });
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
      res.json(updated);
    } catch (error) {
      console.error('Error updating table service status:', error);
      res.status(500).json({ error: 'Failed to update table service status' });
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

  // Database Backup & Restore Routes
  app.get("/api/admin/backup", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const dbPath = path.join(process.cwd(), 'sqlite.db');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
      const backupFileName = `POS_Backup_${timestamp}.db`;
      const backupPath = path.join(process.cwd(), backupFileName);
      await fs.copyFile(dbPath, backupPath);

      res.download(backupPath, backupFileName, (err) => {
        if (err) {
          console.error("Backup download error:", err);
          res.status(500).json({ error: "Failed to download backup" });
        } else {
          fs.unlink(backupPath).catch(() => { });
        }
      });
    } catch (error) {
      console.error("Backup error:", error);
      res.status(500).json({ error: "Failed to create backup" });
    }
  });

  app.post("/api/admin/restore", isAuthenticated, requireAdmin, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No backup file uploaded" });
      }

      const backupPath = req.file.path;
      const dbPath = path.join(process.cwd(), 'database.sqlite');

      console.log('Starting database restore...');

      // Close the database connection to release the file lock
      sqlite.close();

      // Replace the current database with the backup
      await fs.copyFile(backupPath, dbPath);

      console.log('Database restored from backup.');

      // Send success response before exiting
      res.json({
        success: true,
        message: "Database restored successfully. The server will restart now to apply changes."
      });

      // Exit the process to force a restart (assuming a process manager is in place)
      // Delay slightly to ensure response is sent
      setTimeout(() => {
        console.log('Restarting server...');
        process.exit(0);
      }, 1000);

    } catch (error) {
      console.error("Restore error:", error);
      // Try to re-open if we failed? Difficult since sqlite object is closed.
      // At this point the server might be unstable if sqlite was closed but copy failed.
      res.status(500).json({ error: "Failed to process restore. Server may need restart." });
    }
  });

  return httpServer;
}