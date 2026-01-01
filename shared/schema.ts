import { z } from "zod";

// Product schema
export const productSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  price: z.number().positive(),
  stock: z.number().int().min(0),
  reorderLevel: z.number().int().min(0),
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
  creditBalance: z.number().default(0),
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
  subtotal: z.number().positive(),
  tax: z.number().min(0),
  total: z.number().positive(),
  paymentMethod: z.enum(["cash", "card", "credit"]),
  customerId: z.string().optional(),
  timestamp: z.string(),
});

export type Sale = z.infer<typeof saleSchema>;
export type InsertSale = Omit<Sale, "id">;

// Credit ledger entry schema
export const creditLedgerSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  amount: z.number(),
  type: z.enum(["credit", "payment"]),
  description: z.string(),
  timestamp: z.string(),
  balanceAfter: z.number(),
});

export type CreditLedger = z.infer<typeof creditLedgerSchema>;
export type InsertCreditLedger = Omit<CreditLedger, "id">;

// Dashboard summary types
export interface DashboardSummary {
  totalSalesToday: number;
  totalCreditBalance: number;
  lowStockItems: Product[];
}
