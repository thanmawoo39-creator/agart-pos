import { z } from "zod";

// Product schema
export const productSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  price: z.number().positive(),
  barcode: z.string().optional(),
  stock: z.number().int().min(0),
  minStockLevel: z.number().int().min(0),
  category: z.string().optional(),
});

export type Product = z.infer<typeof productSchema>;
export type InsertProduct = Omit<Product, "id">;

// Customer schema
export const customerSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  barcode: z.string().optional(),
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
  paymentMethod: z.enum(["cash", "card", "credit"]),
  customerId: z.string().optional(),
  storeId: z.string().optional(),
  timestamp: z.string(),
  createdBy: z.string().optional(),
});

export type Sale = z.infer<typeof saleSchema>;
export type InsertSale = Omit<Sale, "id">;

// Credit ledger entry schema
export const creditLedgerSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  type: z.enum(["charge", "payment"]),
  amount: z.number(),
  balanceAfter: z.number(),
  description: z.string().optional(),
  timestamp: z.string(),
  createdBy: z.string().optional(),
});

export type CreditLedger = z.infer<typeof creditLedgerSchema>;
export type InsertCreditLedger = Omit<CreditLedger, "id">;

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
  barcode: z.string().optional(),
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
  totalSalesToday: number;
  totalReceivables: number;
  lowStockCount: number;
  lowStockItems: Product[];
  aiInsight: string;
}

// Cart item type for Zustand store
export interface CartItem extends SaleItem {
  product: Product;
}
