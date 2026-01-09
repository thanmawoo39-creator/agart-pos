import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Products
export const products = sqliteTable("products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  stock: integer("stock").notNull().default(0),
  category: text("category").notNull(),
  barcode: text("barcode").unique(),
  image: text("image"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});

// Customers
export const customers = sqliteTable("customers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  loyaltyPoints: integer("loyalty_points").default(0),
  totalSpent: real("total_spent").default(0),
  creditBalance: real("credit_balance").default(0),
});

// Staff
export const staff = sqliteTable("staff", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'admin', 'manager', 'cashier'
  pin: text("pin").notNull(),
  barcode: text("barcode").unique(),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  hourlyRate: real("hourly_rate"),
});

// Sales
export const sales = sqliteTable("sales", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  receiptNumber: text("receipt_number").notNull().unique(),
  totalAmount: real("total_amount").notNull(),
  paymentMethod: text("payment_method").notNull(), // 'cash', 'card', 'credit'
  date: integer("date", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  customerId: text("customer_id").references(() => customers.id),
  staffId: text("staff_id").references(() => staff.id),
});

// Sale Items
export const saleItems = sqliteTable("sale_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  saleId: text("sale_id").notNull().references(() => sales.id),
  productId: text("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: real("price").notNull(), // Price at time of sale
  productName: text("product_name").notNull(), // Snapshot of name
});

// Relations
export const salesRelations = relations(sales, ({ many, one }) => ({
  items: many(saleItems),
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  staff: one(staff, {
    fields: [sales.staffId],
    references: [staff.id],
  }),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
}));

// Inventory Logs
export const inventoryLogs = sqliteTable("inventory_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id").notNull().references(() => products.id),
  change: integer("change").notNull(),
  type: text("type").notNull(), // 'stock-in', 'sale', 'adjustment'
  reason: text("reason"),
  staffId: text("staff_id").references(() => staff.id),
  date: integer("date", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Expenses
export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  category: text("category").notNull(),
  date: integer("date", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  receiptImage: text("receipt_image"),
  recordedBy: text("recorded_by").references(() => staff.id),
});

// Attendance
export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  clockIn: integer("clock_in", { mode: "timestamp" }).notNull(),
  clockOut: integer("clock_out", { mode: "timestamp" }),
  openingCash: real("opening_cash"),
  closingCash: real("closing_cash"),
  notes: text("notes"),
});

// Credit Ledger
export const creditLedger = sqliteTable("credit_ledger", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  customerId: text("customer_id").notNull().references(() => customers.id),
  amount: real("amount").notNull(),
  type: text("type").notNull(), // 'credit', 'payment'
  date: integer("date", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  description: text("description"),
  saleId: text("sale_id").references(() => sales.id),
});

// App Settings
export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  storeName: text("store_name").default("My POS"),
  address: text("address"),
  phone: text("phone"),
  currency: text("currency").default("USD"),
  taxRate: real("tax_rate").default(0),
  lowStockThreshold: integer("low_stock_threshold").default(5),
  enableLocalAi: integer("enable_local_ai", { mode: "boolean" }).notNull().default(false),
  localAiUrl: text("local_ai_url"),
});

// Alerts
export const alerts = sqliteTable("alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  message: text("message").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Zod Schemas & Types
export const insertProductSchema = createInsertSchema(products);
export const insertCustomerSchema = createInsertSchema(customers);
export const insertStaffSchema = createInsertSchema(staff);
export const insertExpenseSchema = createInsertSchema(expenses);
export const insertInventoryLogSchema = createInsertSchema(inventoryLogs);
export const insertCreditLedgerSchema = createInsertSchema(creditLedger);
export const insertAttendanceSchema = createInsertSchema(attendance);

export const insertSaleItemSchema = createInsertSchema(saleItems).omit({ id: true, saleId: true });
export const insertSaleSchema = createInsertSchema(sales).extend({
  items: z.array(insertSaleItemSchema),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

export type Staff = typeof staff.$inferSelect;
export type InsertStaff = typeof staff.$inferInsert;

export type Sale = typeof sales.$inferSelect & { items?: (typeof saleItems.$inferSelect)[] };
export type InsertSale = z.infer<typeof insertSaleSchema>;

export type SaleItem = typeof saleItems.$inferSelect;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

export type InventoryLog = typeof inventoryLogs.$inferSelect;
export type InsertInventoryLog = typeof inventoryLogs.$inferInsert;

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = typeof attendance.$inferInsert;

export type CreditLedger = typeof creditLedger.$inferSelect;
export type InsertCreditLedger = typeof creditLedger.$inferInsert;

export type AppSettings = typeof appSettings.$inferSelect;
export type UpdateAppSettings = Partial<AppSettings>;

export type Alert = typeof alerts.$inferSelect;

export type CurrentShift = {
  staffId: string;
  clockIn: Date;
} | null;

export type DashboardSummary = {
  totalSalesToday: number;
  totalReceivables: number;
  lowStockCount: number;
  lowStockItems: Product[];
  aiInsight: string;
};