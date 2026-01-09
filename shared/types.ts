export type Product = {
  id: string;
  name: string;
  barcode?: string | undefined;
  price: number;
  cost: number;
  stock: number;
  minStockLevel: number;
  category?: string | undefined;
  unit: "pcs" | "kg" | "g" | "l" | "ml";
  imageData?: string | undefined;
  createdAt: string;
  updatedAt: string;
};

export type Customer = {
  id: string;
  name: string;
  phone?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
  creditLimit: number;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
};

export type Sale = {
  id: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: "cash" | "card" | "mobile" | "credit";
  customerId?: string | undefined;
  staffId: string;
  createdAt: string;
};

export type SaleItem = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
};

export type CreditLedger = {
  id: string;
  customerId: string;
  saleId?: string | undefined;
  paymentId?: string | undefined;
  amount: number;
  balance: number;
  type: "sale" | "payment";
  createdAt: string;
};

export type Staff = {
  id: string;
  name: string;
  pin: string;
  role: "cashier" | "manager" | "admin";
  barcode?: string | undefined;
  suspended: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Attendance = {
  id: string;
  staffId: string;
  staffName: string;
  clockIn: string;
  clockOut?: string | undefined;
};

export type CurrentShift = {
  active: boolean;
  staffId?: string | undefined;
  staffName?: string | undefined;
  clockInTime?: string | undefined;
};

export type InventoryLog = {
  id: string;
  productId: string;
  productName: string;
  quantityChange: number;
  reason: string;
  type: "stock-in" | "sale" | "adjustment";
  staffId?: string | undefined;
  staffName?: string | undefined;
  createdAt: string;
};

export type Expense = {
  id: string;
  category: string;
  amount: number;
  date: string;
  description?: string | null;
  note?: string | null;
  receiptImageUrl?: string | null;
  timestamp: string;
};

export type InsertProduct = Omit<Product, "id" | "createdAt" | "updatedAt">;
export type InsertCustomer = Omit<
  Customer,
  "id" | "createdAt" | "updatedAt" | "currentBalance"
>;
export type InsertSale = Omit<Sale, "id" | "createdAt">;
export type InsertCreditLedger = Omit<CreditLedger, "id" | "createdAt">;
export type InsertStaff = Omit<
  Staff,
  "id" | "createdAt" | "updatedAt" | "suspended"
>;
export type InsertAttendance = Omit<Attendance, "id">;
export type InsertInventoryLog = Omit<InventoryLog, "id" | "createdAt">;
export type InsertExpense = Omit<Expense, "id" | "timestamp">;

export type DashboardSummary = {
  todaySales: number;
  totalOrdersToday: number;
  totalReceivables: number;
  lowStockProducts: number;
  lowStockCount: number;
  lowStockItems: any[];
  aiInsight: string;
};

export type AppSettings = {
  id: number;
  storeName: string;
  storeAddress: string | null;
  storePhone: string | null;
  storeLogoUrl: string | null;
  aiImageRecognitionEnabled: boolean;
  enableTax: boolean;
  taxPercentage: number;
  geminiApiKey: string | null;
  groqApiKey: string | null;
  enableMobileScanner: boolean;
  enablePhotoCapture: boolean;
  currencyCode: string;
  currencySymbol: string;
  currencyPosition: "before" | "after";
  updatedAt: string | null;
};

export type UpdateAppSettings = Partial<Omit<AppSettings, "id">>;

export type Alert = {
  id: string;
  type: "shift_discrepancy" | "low_stock" | "high_debt" | "system";
  title: string;
  message: string;
  staffId: string;
  staffName: string;
  shiftId?: string | null;
  amount?: number | null;
  isRead: boolean;
  createdAt: string;
};

export type InsertAlert = Omit<Alert, "id" | "createdAt" | "isRead">;

export type Shift = {
  id: string;
  staffId: string;
  staffName: string;
  clockIn: string;
  clockOut?: string | null;
  openingCash: number;
  closingCash?: number | null;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  creditSales: number;
  mobileSales: number;
  isActive: boolean;
};

export type InsertShift = Omit<Shift, "id" | "clockOut" | "closingCash" | "totalSales" | "cashSales" | "cardSales" | "creditSales" | "mobileSales" | "isActive">;