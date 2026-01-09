import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";
import { z } from "zod";

// --- Drizzle Table Definitions ---

// Products
export const products = sqliteTable("products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  price: real("price").notNull(),
  cost: real("cost").default(0),
  barcode: text("barcode").unique(),
  imageData: text("image_data"),
  imageUrl: text("image_url"),
  stock: integer("stock").notNull().default(0),
  minStockLevel: integer("min_stock_level").notNull().default(0),
  unit: text("unit").notNull().default("pcs"),
  category: text("category"),
  status: text("status").notNull().default("active"),
});

// Customers
export const customers = sqliteTable("customers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  barcode: text("barcode").unique(),
  memberId: text("member_id").unique(), // Customer member ID (e.g., "C-001")
  imageUrl: text("image_url"),
  status: text("status").notNull().default("active"),
  creditLimit: real("credit_limit").notNull().default(0),
  currentBalance: real("current_balance").notNull().default(0),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  riskTag: text("risk_tag", { enum: ["low", "high"] }).notNull().default("low"),
});

// Staff
export const staff = sqliteTable("staff", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  pin: text("pin").notNull(),
  role: text("role", { enum: ["owner", "manager", "cashier"] }).notNull(),
  barcode: text("barcode").unique(),
  status: text("status", { enum: ["active", "suspended"] }).notNull().default("active"),
});

// Sales
export const sales = sqliteTable("sales", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subtotal: real("subtotal").notNull(),
  discount: real("discount").notNull().default(0),
  tax: real("tax").notNull(),
  total: real("total").notNull(),
  paymentMethod: text("payment_method", { enum: ["cash", "card", "credit", "mobile"] }).notNull(),
  paymentStatus: text("payment_status", { enum: ["paid", "unpaid"] }).notNull().default("paid"),
  customerId: text("customer_id").references(() => customers.id),
  storeId: text("store_id"),
  timestamp: text("timestamp").notNull(),
  createdBy: text("created_by"),
  paymentSlipUrl: text("payment_slip_url"),
});

// Sale Items (for detailed tracking)
export const saleItems = sqliteTable("sale_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  saleId: text("sale_id").notNull().references(() => sales.id),
  productId: text("product_id").notNull().references(() => products.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  total: real("total").notNull(),
});

// Credit Ledger
export const creditLedger = sqliteTable("credit_ledger", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  customerId: text("customer_id").notNull().references(() => customers.id),
  customerName: text("customer_name").notNull(),
  type: text("type", { enum: ["charge", "payment", "repayment"] }).notNull(),
  amount: real("amount").notNull(),
  balanceAfter: real("balance_after").notNull(),
  description: text("description"),
  saleId: text("sale_id").references(() => sales.id),
  voucherImageUrl: text("voucher_image_url"),
  timestamp: text("timestamp").notNull(),
  createdBy: text("created_by"),
});

// Attendance
export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  clockInTime: text("clock_in_time").notNull(), // ISO timestamp
  clockOutTime: text("clock_out_time"), // ISO timestamp or null if still working
  totalHours: real("total_hours"), // Calculated on clock out
  openingCash: real("opening_cash").notNull().default(0),
  totalSales: real("total_sales").notNull().default(0),
  cashSales: real("cash_sales").notNull().default(0),
  cardSales: real("card_sales").notNull().default(0),
  creditSales: real("credit_sales").notNull().default(0),
  mobileSales: real("mobile_sales").notNull().default(0),
});

// Inventory Logs
export const inventoryLogs = sqliteTable("inventory_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id").notNull().references(() => products.id),
  productName: text("product_name").notNull(),
  type: text("type", { enum: ["stock-in", "sale", "adjustment"] }).notNull(),
  quantityChanged: integer("quantity_changed").notNull(), // Positive for additions, negative for deductions
  previousStock: integer("previous_stock").notNull(),
  currentStock: integer("current_stock").notNull(),
  staffId: text("staff_id").references(() => staff.id),
  staffName: text("staff_name"),
  reason: text("reason"),
  timestamp: text("timestamp").notNull(),
});

// Expenses
export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  category: text("category", { enum: ["Rent", "Electricity", "Fuel", "Internet", "Taxes", "Other"] }).notNull(),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  description: text("description"),
  receiptImageUrl: text("receipt_image_url"),
  note: text("note"),
  timestamp: text("timestamp").notNull(),
});

// App Settings
export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  storeName: text("store_name").notNull().default("My Store"),
  storeAddress: text("store_address"),
  storePhone: text("store_phone"),
  storeLogoUrl: text("store_logo_url"),
  aiImageRecognitionEnabled: integer("ai_image_recognition_enabled", { mode: "boolean" }).notNull().default(false),
  enableTax: integer("enable_tax", { mode: "boolean" }).notNull().default(false),
  taxPercentage: real("tax_percentage").notNull().default(0),
  geminiApiKey: text("gemini_api_key"),
  groqApiKey: text("groq_api_key"),
  enableMobileScanner: integer("enable_mobile_scanner", { mode: "boolean" }).notNull().default(true),
  enablePhotoCapture: integer("enable_photo_capture", { mode: "boolean" }).notNull().default(true),
  currencyCode: text("currency_code").notNull().default("MMK"),
  currencySymbol: text("currency_symbol").notNull().default("K"),
  currencyPosition: text("currency_position", { enum: ["before", "after"] }).notNull().default("after"),
  updatedAt: text("updated_at"),
});

// Alerts
export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type", { enum: ["shift_discrepancy", "low_stock", "high_debt", "system"] }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  staffId: text("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  shiftId: text("shift_id"),
  amount: real("amount"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

// Shifts
export const shifts = sqliteTable("shifts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  openingCash: real("opening_cash").notNull(),
  closingCash: real("closing_cash"),
  status: text("status", { enum: ["open", "closed"] }).notNull(),
  totalSales: real("total_sales").notNull().default(0),
  cashSales: real("cash_sales").notNull().default(0),
  cardSales: real("card_sales").notNull().default(0),
  creditSales: real("credit_sales").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// --- Relations ---

export const salesRelations = relations(sales, ({ many }) => ({
	items: many(saleItems),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
	sale: one(sales, {
		fields: [saleItems.saleId],
		references: [sales.id],
	}),
}));

// --- Zod Schemas & Types ---

// Product schema
export const productSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Product name is required"),
  price: z.number().positive("Price must be greater than 0"),
  cost: z.number().min(0).nullable().optional(), // Cost price for profit margin calculation
  barcode: z.string().nullable().optional(), // Optional - will be auto-generated if not provided
  // Optional base64-encoded image data (data URI) for product photo
  imageData: z.string().nullable().optional(),
  // Optional URL to a hosted product image
  imageUrl: z.string().nullable().optional(),
  stock: z.number().int().min(0).default(0),
  minStockLevel: z.number().int().min(0).default(0),
  unit: z.string().default("pcs"), // pcs, bag, box, kg, etc.
  category: z.string().nullable().optional().default(null), // Optional - defaults to null
  status: z.string().optional().default("active"), // active or archived - optional for inserts
});

export type Product = z.infer<typeof productSchema>;
export type InsertProduct = Omit<Product, "id" | "status"> & { status?: string }; // Make status optional for inserts

// Inventory log schema for audit trail
export const inventoryLogTypeSchema = z.enum(["stock-in", "sale", "adjustment"]);
export type InventoryLogType = z.infer<typeof inventoryLogTypeSchema>;

export const inventoryLogSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  type: inventoryLogTypeSchema,
  quantityChanged: z.number().int(), // Positive for additions, negative for deductions
  previousStock: z.number().int(),
  currentStock: z.number().int(),
  staffId: z.string().optional(),
  staffName: z.string().optional(),
  reason: z.string().optional(),
  timestamp: z.string(),
});

export type InventoryLog = z.infer<typeof inventoryLogSchema>;
export type InsertInventoryLog = Omit<InventoryLog, "id">;

// Customer schema
export const customerSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Customer name is required"),
  phone: z.string().optional().nullable(),
  email: z.string().email({ message: "Invalid email address" }).optional().or(z.literal("")).nullable(),
  barcode: z.string().optional().nullable(),
  memberId: z.string().optional().nullable(), // Customer member ID (e.g., "C-001")
  imageUrl: z.string().optional().nullable(), // Removed URL validation to allow empty strings
  status: z.string().default("active"),
  creditLimit: z.number().min(0).default(0),
  currentBalance: z.number().default(0),
  loyaltyPoints: z.number().int().min(0).default(0),
  riskTag: z.enum(["low", "high"]).default("low"),
});

export type Customer = z.infer<typeof customerSchema>;
export type InsertCustomer = Omit<Customer, "id">;

// Sale item schema
export const saleItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  total: z.number().positive(),
});

export type SaleItem = z.infer<typeof saleItemSchema>;

// Sale schema
export const saleSchema = z.object({
  id: z.string(),
  items: z.array(saleItemSchema),
  subtotal: z.number().min(0),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0),
  total: z.number().positive(),
  paymentMethod: z.enum(["cash", "card", "credit", "mobile"]),
  paymentStatus: z.enum(["paid", "unpaid"]).default("paid"),
  customerId: z.string().optional(),
  storeId: z.string().optional(),
  timestamp: z.string(),
  createdBy: z.string().optional(),
  paymentSlipUrl: z.string().optional(),
});

export type Sale = z.infer<typeof saleSchema>;
export type InsertSale = Omit<Sale, "id">;

// Credit ledger entry schema
export const creditLedgerSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  type: z.enum(["charge", "payment", "repayment"]),
  amount: z.number(),
  balanceAfter: z.number(),
  description: z.string().nullable(),
  saleId: z.string().optional(), // Reference to the sale
  voucherImageUrl: z.string().optional(), // Optional URL to a voucher photo
  timestamp: z.string(),
  createdBy: z.string().nullable(),
});

export type CreditLedger = z.infer<typeof creditLedgerSchema>;
export type InsertCreditLedger = Omit<CreditLedger, "id">;

// Enriched Credit Ledger type for UI/display purposes
export interface EnrichedCreditLedger extends CreditLedger {
  saleItems?: SaleItem[];
}

// Staff schema with roles
export const staffRoleSchema = z.enum(["owner", "manager", "cashier"]);
export type StaffRole = z.infer<typeof staffRoleSchema>;

export const staffStatusSchema = z.enum(["active", "suspended"]);
export type StaffStatus = z.infer<typeof staffStatusSchema>;

export const staffSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  pin: z.string().length(4),
  role: staffRoleSchema,
  barcode: z.string().nullable(),
  status: staffStatusSchema.default("active"),
});

export type Staff = z.infer<typeof staffSchema>;
export type InsertStaff = Omit<Staff, "id">;

// Staff session for auth context
export interface StaffSession {
  staff: Staff;
  loginTime: string;
}

// Store schema
export const storeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  address: z.string().optional(),
});

export type Store = z.infer<typeof storeSchema>;

// Dashboard summary types
export interface DashboardSummary {
  todaySales: number;
  totalSalesToday: number;
  totalOrdersToday: number;
  totalReceivables: number;
  lowStockProducts: number;
  lowStockCount: number;
  lowStockItems: Product[];
  aiInsight: string;
}

// Cart item type for Zustand store
export interface CartItem extends SaleItem {
  product: Product;
}

// Attendance schema for clock-in/clock-out
export const attendanceSchema = z.object({
  id: z.string(),
  staffId: z.string(),
  staffName: z.string(),
  date: z.string(), // YYYY-MM-DD format
  clockInTime: z.string(), // ISO timestamp
  clockOutTime: z.string().nullable(), // ISO timestamp or null if still working
  totalHours: z.number().nullable(), // Calculated on clock out
  // Shift financial tracking
  openingCash: z.number().min(0).default(0),
  totalSales: z.number().min(0).default(0),
  cashSales: z.number().min(0).default(0),
  cardSales: z.number().min(0).default(0),
  creditSales: z.number().min(0).default(0),
  mobileSales: z.number().min(0).default(0),
});

export type Attendance = z.infer<typeof attendanceSchema>;
export type InsertAttendance = Omit<Attendance, "id">;

// Current shift info for UI
export interface CurrentShift {
  isActive: boolean;
  staffId: string | null;
  staffName: string | null;
  clockInTime: string | null;
  attendanceId: string | null;
}

// Expense schema for business expense tracking
export const expenseCategorySchema = z.enum(["Rent", "Electricity", "Fuel", "Internet", "Taxes", "Other"]);
export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;

export const expenseSchema = z.object({
  id: z.string(),
  category: expenseCategorySchema,
  amount: z.number().positive(),
  date: z.string(),
  description: z.string().nullable().optional(),
  receiptImageUrl: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  timestamp: z.string(), // ISO timestamp when created
});

// Schema for inserting expenses - timestamp is optional and will be auto-generated
export const insertExpenseSchema = z.object({
  category: expenseCategorySchema,
  amount: z.number().positive(),
  date: z.string(),
  description: z.string().nullable().optional(),
  receiptImageUrl: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  timestamp: z.string().optional(), // Optional - will be auto-generated if not provided
});

export type Expense = z.infer<typeof expenseSchema>;
export type InsertExpense = Omit<Expense, "id" | "timestamp">;

// P&L Report types
export interface ProfitLossReport {
  period: string;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  totalExpenses: number;
  expensesByCategory: Record<ExpenseCategory, number>;
  taxExpenses: number;
  netProfit: number;
  netProfitMargin: number;
}

// App Settings schema
export const currencyPositionSchema = z.enum(["before", "after"]);
export type CurrencyPosition = z.infer<typeof currencyPositionSchema>;

export const appSettingsSchema = z.object({
  id: z.number().default(1),
  storeName: z.string().min(1).default("My Store"),
  storeAddress: z.string().nullable(),
  storePhone: z.string().nullable(),
  storeLogoUrl: z.string().nullable().refine((val) => {
    if (!val || val === "") return true; // Allow empty strings and null
    try {
      new URL(val);
      return true;
    } catch {
      return false; // Only validate URL if string is not empty
    }
  }, { message: "Must be a valid URL or empty" }),
  aiImageRecognitionEnabled: z.boolean().default(false),
  enableTax: z.boolean().default(false),
  taxPercentage: z.number().min(0).max(100).default(0),
  geminiApiKey: z.string().nullable(),
  groqApiKey: z.string().nullable(),
  enableMobileScanner: z.boolean().default(true),
  enablePhotoCapture: z.boolean().default(true),
  currencyCode: z.string().default("MMK"),
  currencySymbol: z.string().default("K"),
  currencyPosition: currencyPositionSchema.default("after"),
  updatedAt: z.string().nullable(),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;
export type UpdateAppSettings = Partial<Omit<AppSettings, "id">>;

// Shift schema
export const shiftStatusSchema = z.enum(["open", "closed"]);
export type ShiftStatus = z.infer<typeof shiftStatusSchema>;

export const shiftSchema = z.object({
  id: z.string(),
  staffId: z.string(),
  staffName: z.string(),
  startTime: z.string(),
  endTime: z.string().nullable().optional(),
  openingCash: z.number().min(0),
  closingCash: z.number().min(0).nullable().optional(),
  status: shiftStatusSchema,
  totalSales: z.number().min(0).default(0),
  cashSales: z.number().min(0).default(0),
  cardSales: z.number().min(0).default(0),
  creditSales: z.number().min(0).default(0),
  createdAt: z.string(),
});

export type Shift = z.infer<typeof shiftSchema>;
export type InsertShift = Omit<Shift, "id" | "createdAt">;

// Alert schema for shift discrepancies
export const alertTypeSchema = z.enum(["shift_discrepancy", "low_stock", "high_debt", "system"]);
export type AlertType = z.infer<typeof alertTypeSchema>;

export const alertSchema = z.object({
  id: z.string(),
  type: alertTypeSchema,
  title: z.string(),
  message: z.string(),
  staffId: z.string(),
  staffName: z.string(),
  shiftId: z.string().nullable(),
  amount: z.number().nullable(),
  isRead: z.boolean().default(false),
  createdAt: z.string(),
});

export type Alert = z.infer<typeof alertSchema>;
export type InsertAlert = Omit<Alert, "id" | "createdAt">;
