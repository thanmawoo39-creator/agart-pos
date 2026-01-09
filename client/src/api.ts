import {
  Product,
  Customer,
  Sale,
  CreditLedger,
  Staff,
  Attendance,
  InventoryLog,
  Expense,
  DashboardSummary,
} from "@shared/schema";

export const api = {
  getProducts: async (): Promise<Product[]> => {
    const res = await fetch("/api/products");
    return res.json();
  },
  // Other API functions here
};