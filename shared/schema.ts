import { pgTable, text, integer, real, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";
import { z } from "zod";

// --- Drizzle Table Definitions ---

// Products
export const products = pgTable("products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  translatedName: text("translated_name"), // Auto-translated Burmese name via Gemini AI
  price: real("price").notNull(),
  cost: real("cost").default(0),
  barcode: text("barcode").unique(),
  imageData: text("image_data"),
  imageUrl: text("image_url"),
  stock: integer("stock").notNull().default(0),
  specialStock: integer("special_stock").notNull().default(0), // Dedicated stock for daily specials
  minStockLevel: integer("min_stock_level").notNull().default(0),
  unit: text("unit").notNull().default("pcs"),
  category: text("category"),
  status: text("status").notNull().default("active"),
  isDailySpecial: boolean("is_daily_special").notNull().default(false),
  isStandardMenu: boolean("is_standard_menu").notNull().default(false),
  isShared: boolean("is_shared").notNull().default(false),
  businessUnitId: text("business_unit_id").references(() => businessUnits.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  // Optimistic locking for concurrent inventory updates
  version: integer("version").notNull().default(1),
});

// Customers
export const customers = pgTable("customers", {
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
  dueDate: text("due_date"),
  creditDueDate: text("credit_due_date"),
  monthlyClosingDay: integer("monthly_closing_day"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  riskTag: text("risk_tag").notNull().default("low"),
  businessUnitId: text("business_unit_id").references(() => businessUnits.id),
  // originUnit tracks where the customer was originally created (for segmentation)
  // Restaurant customers (originUnit='2') should be separate from Grocery customers
  originUnit: text("origin_unit").references(() => businessUnits.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Staff
export const staff = pgTable("staff", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  pin: text("pin").notNull(),
  password: text("password"), // For owner/admin authentication (nullable - cashiers use PIN only)
  role: text("role").notNull(),
  barcode: text("barcode").unique(),
  status: text("status").notNull().default("active"),
  isGuest: boolean("is_guest").notNull().default(false), // Guest user flag
  businessUnitId: text("business_unit_id").references(() => businessUnits.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Business Units (Dynamic Store Management)
export const businessUnits = pgTable("business_units", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  type: text("type").notNull(),
  settings: text("settings"), // JSON string for store-specific settings
  isActive: text("is_active").notNull().default("true"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Business Unit schema for dynamic store management
export const businessUnitTypeSchema = z.preprocess((val) => {
  if (typeof val !== "string") return val;
  const normalized = val.toLowerCase();
  if (
    normalized === "grocery" ||
    normalized === "restaurant" ||
    normalized === "pharmacy" ||
    normalized === "electronics" ||
    normalized === "clothing"
  ) {
    return normalized;
  }
  return val;
}, z.enum(["grocery", "restaurant", "pharmacy", "electronics", "clothing"]));
export type BusinessUnitType = z.infer<typeof businessUnitTypeSchema>;

export const businessUnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: businessUnitTypeSchema,
  settings: z.string().nullable().optional(),
  isActive: z.enum(["true", "false"]).default("true"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BusinessUnit = z.infer<typeof businessUnitSchema>;
export type InsertBusinessUnit = Omit<BusinessUnit, "id" | "createdAt" | "updatedAt">;

// Restaurant Tables (for QR Menu Management)
export const restaurantTables = pgTable("restaurant_tables", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tableNumber: text("table_number").notNull().unique(),
  tableName: text("table_name"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type RestaurantTable = typeof restaurantTables.$inferSelect;
export type InsertRestaurantTable = typeof restaurantTables.$inferInsert;

// Restaurant Tables (Old schema - for complex table management)
export const tables = pgTable("tables", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull(),
  capacity: integer("capacity").notNull(),
  status: text("status").notNull().default("available"),
  currentOrder: text("current_order"),
  lastOrdered: text("last_ordered"),
  serviceStatus: text("service_status"),
  businessUnitId: text("business_unit_id").notNull().references(() => businessUnits.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type Table = typeof tables.$inferSelect;


// Kitchen Tickets (KOT / Kitchen View)
export const kitchenTickets = pgTable("kitchen_tickets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  businessUnitId: text("business_unit_id").notNull().references(() => businessUnits.id),
  tableId: text("table_id").references(() => tables.id),
  tableNumber: text("table_number"),
  items: text("items"), // JSON string
  status: text("status").notNull().default("in_preparation"),
  // Kanban workflow timestamps
  startedAt: text("started_at"), // When chef clicks "Accept & Cook"
  readyAt: text("ready_at"),     // When chef clicks "Mark Ready"
  servedAt: text("served_at"),   // When chef clicks "Mark Served"
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  // Optimistic locking for concurrent access (multi-waiter/kitchen)
  version: integer("version").notNull().default(1),
});

// Sales
export const sales = pgTable("sales", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subtotal: real("subtotal").notNull(),
  discount: real("discount").notNull().default(0),
  tax: real("tax").notNull(),
  total: real("total").notNull(),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method").notNull(),
  // Payment tracking
  paymentStatus: text("payment_status").default('paid').notNull(),

  // Order source tracking
  orderSource: text("order_source").default('pos').notNull(),
  orderType: text("order_type").notNull().default("dine-in"),
  tableNumber: text("table_number"),
  customerId: text("customer_id").references(() => customers.id),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  deliveryAddress: text("delivery_address"),
  requestedDeliveryTime: text("requested_delivery_time"),
  paymentProofUrl: text("payment_proof_url"),
  storeId: text("store_id"),
  businessUnitId: text("business_unit_id").notNull().references(() => businessUnits.id),
  staffId: text("staff_id"),
  createdBy: text("created_by"),
  paymentSlipUrl: text("payment_slip_url"),
  timestamp: text("timestamp").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  // Driver GPS tracking
  driverLat: real("driver_lat"),
  driverLng: real("driver_lng"),
  locationUpdatedAt: text("location_updated_at"),
  // Guest ordering support
  phoneVerified: boolean("phone_verified").default(false),
  guestId: text("guest_id"),
  // Optimistic locking for concurrent access (multi-cashier)
  version: integer("version").notNull().default(1),
});

// Sale Items (for detailed tracking)
export const saleItems = pgTable("sale_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  saleId: text("sale_id").notNull().references(() => sales.id),
  productId: text("product_id").notNull().references(() => products.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  total: real("total").notNull(),
});

// Credit Ledger
export const creditLedger = pgTable("credit_ledger", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  customerId: text("customer_id").notNull().references(() => customers.id),
  customerName: text("customer_name").notNull(),
  type: text("type").notNull(),
  transactionType: text("transaction_type"),
  amount: real("amount").notNull(),
  balanceAfter: real("balance_after").notNull(),
  description: text("description"),
  saleId: text("sale_id").references(() => sales.id),
  voucherImageUrl: text("voucher_image_url"),
  timestamp: text("timestamp").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

// Attendance
export const attendance = pgTable("attendance", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  businessUnitId: text("business_unit_id").references(() => businessUnits.id),
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
export const inventoryLogs = pgTable("inventory_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id").notNull().references(() => products.id),
  productName: text("product_name").notNull(),
  type: text("type").notNull(),
  quantityChanged: integer("quantity_changed").notNull(), // Positive for additions, negative for deductions
  previousStock: integer("previous_stock").notNull(),
  currentStock: integer("current_stock").notNull(),
  staffId: text("staff_id").references(() => staff.id),
  staffName: text("staff_name"),
  reason: text("reason"),
  timestamp: text("timestamp").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Expenses
export const expenses = pgTable("expenses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  category: text("category").notNull(),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  description: text("description"),
  receiptImageUrl: text("receipt_image_url"),
  note: text("note"),
  timestamp: text("timestamp").notNull(),
});

// Payment Buffers - Stores SMS payments temporarily for verification
export const paymentBuffers = pgTable("payment_buffers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  amount: real("amount").notNull(),
  transactionId: text("transaction_id"),
  senderName: text("sender_name"),
  smsContent: text("sms_content"),
  verified: boolean("verified").default(false).notNull(),
  verifiedAt: text("verified_at"),
  orderId: text("order_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// SMS Logs - Stores ALL incoming SMS for audit history
export const smsLogs = pgTable("sms_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sender: text("sender"),
  messageContent: text("message_content"),
  extractedAmount: real("extracted_amount"),
  status: text("status").default("received").notNull(),
  matchedOrderId: text("matched_order_id"),
  bufferRecordId: text("buffer_record_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// App Settings
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  storeName: text("store_name").notNull().default("My Store"),
  storeAddress: text("store_address"),
  storePhone: text("store_phone"),
  storeLogoUrl: text("store_logo_url"),
  mobilePaymentQrUrl: text("mobile_payment_qr_url"),
  aiImageRecognitionEnabled: boolean("ai_image_recognition_enabled").notNull().default(false),
  enableTax: boolean("enable_tax").notNull().default(false),
  taxPercentage: real("tax_percentage").notNull().default(0),
  enableLocalAi: boolean("enable_local_ai").notNull().default(false),
  localAiUrl: text("local_ai_url"),
  localAiModel: text("local_ai_model"),
  geminiApiKey: text("gemini_api_key"),
  groqApiKey: text("groq_api_key"),
  enableMobileScanner: boolean("enable_mobile_scanner").notNull().default(true),
  enablePhotoCapture: boolean("enable_photo_capture").notNull().default(true),
  currencyCode: text("currency_code").notNull().default("THB"),
  currencySymbol: text("currency_symbol").notNull().default("฿"),
  currencyPosition: text("currency_position").notNull().default("before"),
  riderPin: text("delivery_rider_pin").default("8888"),
  updatedAt: text("updated_at"),
});

// Alerts
export const alerts = pgTable("alerts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  staffId: text("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  shiftId: text("shift_id"),
  amount: real("amount"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

// Shifts
export const shifts = pgTable("shifts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  businessUnitId: text("business_unit_id").notNull().references(() => businessUnits.id),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  openingCash: real("opening_cash").notNull(),
  closingCash: real("closing_cash"),
  status: text("status").notNull(),
  totalSales: real("total_sales").notNull().default(0),
  cashSales: real("cash_sales").notNull().default(0),
  cardSales: real("card_sales").notNull().default(0),
  creditSales: real("credit_sales").notNull().default(0),
  mobileSales: real("mobile_sales").notNull().default(0),
  createdAt: text("created_at").notNull(),
  // Optimistic locking for concurrent shift close attempts
  version: integer("version").notNull().default(1),
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
  translatedName: z.string().nullable().optional(), // Auto-translated Burmese name
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
  isDailySpecial: z.boolean().default(false), // For public lunch menu - featured items
  isStandardMenu: z.boolean().default(false), // For public lunch menu - regular add-ons
  businessUnitId: z.string().nullable().optional(),
});

export type Product = z.infer<typeof productSchema>;
// InsertProduct omits 'id' and makes 'status', 'businessUnitId', 'isDailySpecial', 'isStandardMenu' optional for inserts
export type InsertProduct = Omit<Product, "id" | "status" | "isDailySpecial" | "isStandardMenu"> & {
  status?: string;
  businessUnitId?: string;
  isDailySpecial?: boolean;
  isStandardMenu?: boolean;
};

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
  creditLimit: z.coerce.number().min(0).default(0),
  currentBalance: z.coerce.number().default(0),
  dueDate: z.string().optional().nullable(),
  creditDueDate: z.string().optional().nullable(),
  monthlyClosingDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  loyaltyPoints: z.coerce.number().int().min(0).default(0),
  riskTag: z.enum(["low", "high"]).default("low"),
  businessUnitId: z.string().nullable().optional(),
  // originUnit tracks where the customer was originally created (for segmentation)
  originUnit: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
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

// Order type schema
export const orderTypeSchema = z.enum(["dine-in", "delivery", "takeout"]);
export type OrderType = z.infer<typeof orderTypeSchema>;

// Sale schema
export const saleSchema = z.object({
  id: z.string(),
  items: z.array(saleItemSchema),
  subtotal: z.number().min(0),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0),
  total: z.number().positive(),
  status: z.string().optional().default("pending"),
  paymentMethod: z.enum(["cash", "card", "credit", "mobile"]),
  paymentStatus: z.enum(["paid", "unpaid", "pending_verification"]).default("paid"),
  orderType: orderTypeSchema.default("dine-in"),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  deliveryAddress: z.string().optional(),
  requestedDeliveryTime: z.string().optional(),
  paymentProofUrl: z.string().optional(),
  storeId: z.string().optional(),
  businessUnitId: z.string(),
  staffId: z.string().optional(),
  timestamp: z.string(),
  createdBy: z.string().optional(),
  paymentSlipUrl: z.string().optional(),
  tableNumber: z.string().optional().nullable(),
});

export type Sale = z.infer<typeof saleSchema>;
export type InsertSale = Omit<Sale, "id"> & { businessUnitId?: string };

// Credit ledger entry schema
export const creditLedgerSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  type: z.enum(["sale", "repayment"]),
  transactionType: z.enum(["sale", "repayment"]).optional().nullable(),
  amount: z.number(),
  balanceAfter: z.number(),
  description: z.string().nullable(),
  saleId: z.string().optional(), // Reference to the sale
  voucherImageUrl: z.string().optional(), // Optional URL to a voucher photo
  timestamp: z.string(),
  createdBy: z.string().nullable(),
});

export const kitchenTicketStatusSchema = z.enum(["in_preparation", "ready", "served", "cancelled"]);
export type KitchenTicketStatus = z.infer<typeof kitchenTicketStatusSchema>;

export const kitchenTicketSchema = z.object({
  id: z.string(),
  businessUnitId: z.string(),
  tableId: z.string().nullable().optional(),
  tableNumber: z.string().nullable().optional(),
  items: z.string().nullable().optional(),
  status: kitchenTicketStatusSchema,
  startedAt: z.string().nullable().optional(), // Kanban: When cooking started
  readyAt: z.string().nullable().optional(),    // Kanban: When marked ready
  servedAt: z.string().nullable().optional(),   // Kanban: When marked served
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().default(1), // Optimistic locking
});

export type KitchenTicket = z.infer<typeof kitchenTicketSchema>;
export type InsertKitchenTicket = Omit<KitchenTicket, "id" | "createdAt" | "updatedAt">;

export type CreditLedger = z.infer<typeof creditLedgerSchema>;
export type InsertCreditLedger = Omit<CreditLedger, "id">;

// Enriched Credit Ledger type for UI/display purposes
export interface EnrichedCreditLedger extends CreditLedger {
  saleItems?: SaleItem[];
}

// Staff schema with roles
export const staffRoleSchema = z.enum(["owner", "manager", "cashier", "waiter", "kitchen"]);
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
  businessUnitId: z.string().nullable(),
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
export interface CartItem {
  id: string;
  productId: Product['id'];
  productName: Product['name'];
  quantity: number;
  unitPrice: Product['price'];
  total: number;
  // Product properties for direct access
  name: Product['name'];
  price: Product['price'];
  product: Product;
}

// Attendance schema for clock-in/clock-out
export const attendanceSchema = z.object({
  id: z.string(),
  staffId: z.string(),
  staffName: z.string(),
  businessUnitId: z.string().nullable().optional(),
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
  businessUnitId: string | null;
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
  mobilePaymentQrUrl: z.string().nullable(),
  aiImageRecognitionEnabled: z.boolean().default(false),
  enableTax: z.boolean().default(false),
  taxPercentage: z.number().min(0).max(100).default(0),
  enableLocalAi: z.boolean().default(false),
  localAiUrl: z.string().nullable(),
  localAiModel: z.string().nullable(),
  geminiApiKey: z.string().nullable(),
  groqApiKey: z.string().nullable(),
  enableMobileScanner: z.boolean().default(true),
  enablePhotoCapture: z.boolean().default(true),
  currencyCode: z.string().default("THB"),
  currencySymbol: z.string().default("฿"),
  currencyPosition: currencyPositionSchema.default("before"),
  riderPin: z.string().default("8888"),
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
  businessUnitId: z.string(),
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
  version: z.number().int().default(1), // Optimistic locking
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

// Public Order schema for online ordering (lunch menu)
export const publicOrderItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  total: z.number().positive(),
});

export type PublicOrderItem = z.infer<typeof publicOrderItemSchema>;

export const publicOrderSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().optional(), // Optional for dine-in orders
  deliveryAddress: z.string().optional(), // Optional for dine-in orders
  items: z.array(publicOrderItemSchema).min(1, "At least one item is required"),
  paymentProofUrl: z.string().optional(),
  businessUnitId: z.string(),
  orderType: z.enum(["dine-in", "delivery", "takeout"]).optional().default("delivery"),
  tableNumber: z.string().optional(), // Table number for dine-in orders
});

export type PublicOrder = z.infer<typeof publicOrderSchema>;

// --- Catering Module Schema ---

export const cateringOrders = pgTable("catering_orders", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  deliveryDate: text("delivery_date").notNull(), // ISO Timestamp
  deliveryAddress: text("delivery_address"),
  totalAmount: integer("total_amount"),
  depositPaid: integer("deposit_paid").default(0),
  status: text("status").default('confirmed'),
  createdByUserId: integer("created_by_user_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  // Driver GPS tracking
  driverLat: real("driver_lat"),
  driverLng: real("driver_lng"),
  locationUpdatedAt: text("location_updated_at"),
  // Proof of Delivery
  proofImageUrl: text("proof_image_url"),
  paymentSlipUrl: text("payment_slip_url"),
});

export const cateringItems = pgTable("catering_items", {
  id: serial("id").primaryKey(),
  cateringOrderId: integer("catering_order_id").references(() => cateringOrders.id),
  itemName: text("item_name"),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price"),
  totalPrice: integer("total_price"),
  isAddon: boolean("is_addon").default(false),
});

// --- Feedback Module ---
export const feedback = pgTable("feedback", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  customerId: text("customer_id").notNull().references(() => customers.id),
  orderId: text("order_id").notNull().references(() => sales.id),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const feedbackRelations = relations(feedback, ({ one }) => ({
  customer: one(customers, {
    fields: [feedback.customerId],
    references: [customers.id],
  }),
  order: one(sales, {
    fields: [feedback.orderId],
    references: [sales.id],
  }),
}));

export const feedbackSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  orderId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type Feedback = z.infer<typeof feedbackSchema>;
export type InsertFeedback = Omit<Feedback, "id" | "createdAt">;

// Relations
export const cateringOrdersRelations = relations(cateringOrders, ({ many }) => ({
  items: many(cateringItems),
}));

export const cateringItemsRelations = relations(cateringItems, ({ one }) => ({
  order: one(cateringOrders, {
    fields: [cateringItems.cateringOrderId],
    references: [cateringOrders.id],
  }),
}));

export const cateringProducts = pgTable("catering_products", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // e.g. "standard_set"
  label: text("label").notNull(),      // e.g. "Standard Set (Rice+Curry)"
  price: integer("price").notNull(),   // e.g. 60
  isActive: boolean("is_active").default(true),
  isShared: boolean("is_shared").default(false),
});

export const insertCateringProductSchema = createInsertSchema(cateringProducts);
export const selectCateringProductSchema = createSelectSchema(cateringProducts);

// Schemas & Types
export const insertCateringOrderSchema = createInsertSchema(cateringOrders);
export const selectCateringOrderSchema = createInsertSchema(cateringOrders);
export type InsertCateringOrder = typeof cateringOrders.$inferInsert;
export type SelectCateringOrder = typeof cateringOrders.$inferSelect;

export const insertCateringItemSchema = createInsertSchema(cateringItems);
export const selectCateringItemSchema = createInsertSchema(cateringItems);
export type InsertCateringItem = typeof cateringItems.$inferInsert;
export type SelectCateringItem = typeof cateringItems.$inferSelect;
