import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { productSchema, customerSchema, saleSchema, creditLedgerSchema, staffSchema, expenseSchema } from "@shared/schema";
import { getAIInsights, getAllCustomerRiskAnalysis, analyzeCustomerRisk, getProfitLossReport, getExpenseInsights } from "./lib/ai-engine";
import { findProductByBarcode, findCustomerByBarcode, getCustomerLedger, addCustomerPayment, processSale, POSError } from "./lib/pos-engine";

// Validation schemas for attendance
const pinSchema = z.object({
  pin: z.string().length(4).regex(/^\d+$/, "PIN must be 4 digits"),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize storage with mock data
  await storage.initialize();

  // Dashboard
  app.get("/api/dashboard/summary", async (req, res) => {
    try {
      const summary = await storage.getDashboardSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
      res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const parsed = productSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid product data", details: parsed.error.errors });
      }
      const product = await storage.createProduct(parsed.data);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Customers
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const parsed = customerSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid customer data", details: parsed.error.errors });
      }
      const customer = await storage.createCustomer(parsed.data);
      res.status(201).json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.updateCustomer(req.params.id, req.body);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error updating customer:", error);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // Sales
  app.get("/api/sales", async (req, res) => {
    try {
      const sales = await storage.getSales();
      res.json(sales);
    } catch (error) {
      console.error("Error fetching sales:", error);
      res.status(500).json({ error: "Failed to fetch sales" });
    }
  });

  app.get("/api/sales/:id", async (req, res) => {
    try {
      const sale = await storage.getSale(req.params.id);
      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }
      res.json(sale);
    } catch (error) {
      console.error("Error fetching sale:", error);
      res.status(500).json({ error: "Failed to fetch sale" });
    }
  });

  app.post("/api/sales", async (req, res) => {
    try {
      const parsed = saleSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid sale data", details: parsed.error.errors });
      }
      const sale = await storage.createSale(parsed.data);
      res.status(201).json(sale);
    } catch (error) {
      console.error("Error creating sale:", error);
      res.status(500).json({ error: "Failed to create sale" });
    }
  });

  // Credit Ledger
  app.get("/api/credit-ledger", async (req, res) => {
    try {
      const ledger = await storage.getCreditLedger();
      res.json(ledger);
    } catch (error) {
      console.error("Error fetching credit ledger:", error);
      res.status(500).json({ error: "Failed to fetch credit ledger" });
    }
  });

  app.post("/api/credit-ledger", async (req, res) => {
    try {
      const parsed = creditLedgerSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid credit ledger data", details: parsed.error.errors });
      }
      const entry = await storage.createCreditLedgerEntry(parsed.data);
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating credit ledger entry:", error);
      res.status(500).json({ error: "Failed to create credit ledger entry" });
    }
  });

  // Barcode scanning - Products (uses POS Engine)
  app.get("/api/scan/product/:barcode", async (req, res) => {
    try {
      const product = await findProductByBarcode(req.params.barcode);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error scanning product:", error);
      res.status(500).json({ error: "Failed to scan product" });
    }
  });

  // Barcode scanning - Customers (uses POS Engine)
  app.get("/api/scan/customer/:barcode", async (req, res) => {
    try {
      const customer = await findCustomerByBarcode(req.params.barcode);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error scanning customer:", error);
      res.status(500).json({ error: "Failed to scan customer" });
    }
  });

  // Get customer's credit ledger entries
  app.get("/api/customers/:id/ledger", async (req, res) => {
    try {
      const entries = await getCustomerLedger(req.params.id);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching customer ledger:", error);
      res.status(500).json({ error: "Failed to fetch customer ledger" });
    }
  });

  // Add payment to customer account
  app.post("/api/customers/:id/payment", async (req, res) => {
    try {
      const { amount, description, createdBy } = req.body;
      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ error: "Invalid payment amount" });
      }
      try {
        await addCustomerPayment(req.params.id, amount, description, createdBy);
        res.json({ success: true });
      } catch (error) {
        if (error instanceof POSError) {
          return res.status(400).json({ error: error.message, code: error.code });
        }
        throw error;
      }
    } catch (error) {
      console.error("Error adding payment:", error);
      res.status(500).json({ error: "Failed to add payment" });
    }
  });

  // AI Insights endpoints
  app.get("/api/ai/insights", async (req, res) => {
    try {
      const insights = await getAIInsights();
      res.json(insights);
    } catch (error) {
      console.error("Error fetching AI insights:", error);
      res.status(500).json({ error: "Failed to fetch AI insights" });
    }
  });

  app.get("/api/ai/risk-analysis", async (req, res) => {
    try {
      const analyses = await getAllCustomerRiskAnalysis();
      res.json(analyses);
    } catch (error) {
      console.error("Error fetching risk analysis:", error);
      res.status(500).json({ error: "Failed to fetch risk analysis" });
    }
  });

  app.get("/api/ai/risk-analysis/:customerId", async (req, res) => {
    try {
      const analysis = await analyzeCustomerRisk(req.params.customerId);
      if (!analysis) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing customer risk:", error);
      res.status(500).json({ error: "Failed to analyze customer risk" });
    }
  });

  // Complete sale with stock updates and credit handling (uses POS Engine)
  app.post("/api/sales/complete", async (req, res) => {
    try {
      const parsed = saleSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid sale data", details: parsed.error.errors });
      }

      const saleData = parsed.data;

      try {
        const result = await processSale(saleData);
        res.status(201).json({ id: result.saleId, success: result.success });
      } catch (error) {
        if (error instanceof POSError) {
          return res.status(400).json({ error: error.message, code: error.code });
        }
        throw error;
      }
    } catch (error) {
      console.error("Error completing sale:", error);
      res.status(500).json({ error: "Failed to complete sale" });
    }
  });

  // Staff Management
  app.get("/api/staff", async (req, res) => {
    try {
      const staff = await storage.getStaff();
      // Don't expose PINs in the list
      const safeStaff = staff.map(({ pin, ...rest }) => rest);
      res.json(safeStaff);
    } catch (error) {
      console.error("Error fetching staff:", error);
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });

  app.get("/api/staff/:id", async (req, res) => {
    try {
      const staffMember = await storage.getStaffMember(req.params.id);
      if (!staffMember) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      // Don't expose PIN
      const { pin, ...safeStaff } = staffMember;
      res.json(safeStaff);
    } catch (error) {
      console.error("Error fetching staff member:", error);
      res.status(500).json({ error: "Failed to fetch staff member" });
    }
  });

  app.post("/api/staff", async (req, res) => {
    try {
      const parsed = staffSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid staff data", details: parsed.error.errors });
      }
      const staffMember = await storage.createStaff(parsed.data);
      const { pin, ...safeStaff } = staffMember;
      res.status(201).json(safeStaff);
    } catch (error) {
      console.error("Error creating staff member:", error);
      res.status(500).json({ error: "Failed to create staff member" });
    }
  });

  app.patch("/api/staff/:id", async (req, res) => {
    try {
      const staffMember = await storage.updateStaff(req.params.id, req.body);
      if (!staffMember) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      const { pin, ...safeStaff } = staffMember;
      res.json(safeStaff);
    } catch (error) {
      console.error("Error updating staff member:", error);
      res.status(500).json({ error: "Failed to update staff member" });
    }
  });

  app.delete("/api/staff/:id", async (req, res) => {
    try {
      const success = await storage.deleteStaff(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting staff member:", error);
      res.status(500).json({ error: "Failed to delete staff member" });
    }
  });

  app.post("/api/staff/:id/suspend", async (req, res) => {
    try {
      const staffMember = await storage.suspendStaff(req.params.id);
      if (!staffMember) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      const { pin, ...safeStaff } = staffMember;
      res.json(safeStaff);
    } catch (error) {
      console.error("Error suspending staff member:", error);
      res.status(500).json({ error: "Failed to suspend staff member" });
    }
  });

  app.post("/api/staff/:id/activate", async (req, res) => {
    try {
      const staffMember = await storage.activateStaff(req.params.id);
      if (!staffMember) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      const { pin, ...safeStaff } = staffMember;
      res.json(safeStaff);
    } catch (error) {
      console.error("Error activating staff member:", error);
      res.status(500).json({ error: "Failed to activate staff member" });
    }
  });

  // Attendance Management
  app.get("/api/attendance/current", async (req, res) => {
    try {
      const shift = await storage.getCurrentShift();
      res.json(shift);
    } catch (error) {
      console.error("Error getting current shift:", error);
      res.status(500).json({ error: "Failed to get current shift" });
    }
  });

  app.post("/api/attendance/clock-in", async (req, res) => {
    try {
      const parsed = pinSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "PIN must be exactly 4 digits" });
      }
      const { pin } = parsed.data;

      const staffMember = await storage.getStaffByPin(pin);
      if (!staffMember) {
        return res.status(401).json({ error: "Invalid PIN" });
      }

      if (staffMember.status === "suspended") {
        return res.status(401).json({ error: "Staff account is suspended" });
      }

      // Check if someone is already clocked in
      const currentShift = await storage.getCurrentShift();
      if (currentShift.isActive) {
        return res.status(400).json({ 
          error: `${currentShift.staffName} is already clocked in. Clock out first.` 
        });
      }

      const attendance = await storage.clockIn(staffMember.id, staffMember.name);
      res.json({ 
        success: true, 
        attendance,
        staffName: staffMember.name
      });
    } catch (error) {
      console.error("Error clocking in:", error);
      res.status(500).json({ error: "Failed to clock in" });
    }
  });

  app.post("/api/attendance/clock-out", async (req, res) => {
    try {
      const parsed = pinSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "PIN must be exactly 4 digits" });
      }
      const { pin } = parsed.data;

      const staffMember = await storage.getStaffByPin(pin);
      if (!staffMember) {
        return res.status(401).json({ error: "Invalid PIN" });
      }

      // Get current shift
      const currentShift = await storage.getCurrentShift();
      if (!currentShift.isActive) {
        return res.status(400).json({ error: "No active shift to clock out" });
      }

      // Verify the person clocking out is the one who clocked in
      if (currentShift.staffId !== staffMember.id) {
        return res.status(400).json({ 
          error: `Only ${currentShift.staffName} can clock out this shift` 
        });
      }

      const attendance = await storage.clockOut(currentShift.attendanceId!);
      res.json({ 
        success: true, 
        attendance,
        totalHours: attendance?.totalHours
      });
    } catch (error) {
      console.error("Error clocking out:", error);
      res.status(500).json({ error: "Failed to clock out" });
    }
  });

  app.get("/api/attendance/report", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        // Default to today
        const today = new Date().toISOString().split("T")[0];
        const attendance = await storage.getAttendanceByDate(today);
        return res.json(attendance);
      }
      const attendance = await storage.getAttendanceReport(
        startDate as string, 
        endDate as string
      );
      res.json(attendance);
    } catch (error) {
      console.error("Error getting attendance report:", error);
      res.status(500).json({ error: "Failed to get attendance report" });
    }
  });

  app.get("/api/attendance", async (req, res) => {
    try {
      const attendance = await storage.getAttendance();
      res.json(attendance);
    } catch (error) {
      console.error("Error getting attendance:", error);
      res.status(500).json({ error: "Failed to get attendance" });
    }
  });

  // Inventory Management
  app.get("/api/inventory/logs", async (req, res) => {
    try {
      const logs = await storage.getInventoryLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error getting inventory logs:", error);
      res.status(500).json({ error: "Failed to get inventory logs" });
    }
  });

  app.get("/api/inventory/logs/:productId", async (req, res) => {
    try {
      const logs = await storage.getInventoryLogsByProduct(req.params.productId);
      res.json(logs);
    } catch (error) {
      console.error("Error getting product inventory logs:", error);
      res.status(500).json({ error: "Failed to get product inventory logs" });
    }
  });

  // Stock adjustment schema for validation
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
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parsed.error.errors 
        });
      }

      const { quantityChange, type, reason, staffId, staffName } = parsed.data;
      const result = await storage.adjustStock(
        req.params.productId,
        quantityChange,
        type,
        staffId,
        staffName,
        reason
      );

      if (!result) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error adjusting stock:", error);
      res.status(500).json({ error: "Failed to adjust stock" });
    }
  });

  // Staff Authentication
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { pin, barcode } = req.body;
      
      let staffMember = null;
      if (pin) {
        staffMember = await storage.getStaffByPin(pin);
      } else if (barcode) {
        staffMember = await storage.getStaffByBarcode(barcode);
      }

      if (!staffMember) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (staffMember.status === "suspended") {
        return res.status(401).json({ error: "Staff account is suspended" });
      }

      // Return staff info without PIN
      const { pin: _, ...safeStaff } = staffMember;
      res.json({
        staff: safeStaff,
        loginTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ error: "Failed to authenticate" });
    }
  });

  // Expenses Management
  app.get("/api/expenses", async (req, res) => {
    try {
      const { startDate, endDate, category } = req.query;
      let expenses;
      
      if (startDate && endDate) {
        expenses = await storage.getExpensesByDateRange(startDate as string, endDate as string);
      } else if (category) {
        expenses = await storage.getExpensesByCategory(category as string);
      } else {
        expenses = await storage.getExpenses();
      }
      
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.get("/api/expenses/:id", async (req, res) => {
    try {
      const expense = await storage.getExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      console.error("Error fetching expense:", error);
      res.status(500).json({ error: "Failed to fetch expense" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const parsed = expenseSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid expense data", details: parsed.error.errors });
      }
      const expense = await storage.createExpense(parsed.data);
      res.status(201).json(expense);
    } catch (error) {
      console.error("Error creating expense:", error);
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.patch("/api/expenses/:id", async (req, res) => {
    try {
      const parsed = expenseSchema.omit({ id: true }).partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid expense data", details: parsed.error.errors });
      }
      const expense = await storage.updateExpense(req.params.id, parsed.data);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      console.error("Error updating expense:", error);
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteExpense(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // Profit & Loss Report
  app.get("/api/reports/pnl", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const report = await getProfitLossReport(
        startDate as string | undefined,
        endDate as string | undefined
      );
      res.json(report);
    } catch (error) {
      console.error("Error fetching P&L report:", error);
      res.status(500).json({ error: "Failed to fetch P&L report" });
    }
  });

  // Expense insights for AI CFO
  app.get("/api/ai/expense-insights", async (req, res) => {
    try {
      const insights = await getExpenseInsights();
      res.json(insights);
    } catch (error) {
      console.error("Error fetching expense insights:", error);
      res.status(500).json({ error: "Failed to fetch expense insights" });
    }
  });

  return httpServer;
}
