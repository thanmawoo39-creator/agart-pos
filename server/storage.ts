import type {
  Product,
  Customer,
  Sale,
  CreditLedger,
  Staff,
  InsertProduct,
  InsertCustomer,
  InsertSale,
  InsertCreditLedger,
  InsertStaff,
  DashboardSummary,
} from "@shared/schema";
import * as db from "./lib/db";

export interface IStorage {
  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Customers
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer | undefined>;

  // Sales
  getSales(): Promise<Sale[]>;
  getSale(id: string): Promise<Sale | undefined>;
  createSale(sale: InsertSale): Promise<Sale>;

  // Credit Ledger
  getCreditLedger(): Promise<CreditLedger[]>;
  createCreditLedgerEntry(entry: InsertCreditLedger): Promise<CreditLedger>;

  // Staff
  getStaff(): Promise<Staff[]>;
  getStaffMember(id: string): Promise<Staff | undefined>;
  getStaffByPin(pin: string): Promise<Staff | undefined>;
  getStaffByBarcode(barcode: string): Promise<Staff | undefined>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  updateStaff(id: string, updates: Partial<InsertStaff>): Promise<Staff | undefined>;
  deleteStaff(id: string): Promise<boolean>;
  suspendStaff(id: string): Promise<Staff | undefined>;
  activateStaff(id: string): Promise<Staff | undefined>;

  // Dashboard
  getDashboardSummary(): Promise<DashboardSummary>;

  // Initialization
  initialize(): Promise<void>;
}

export class POSStorage implements IStorage {
  // Products
  async getProducts(): Promise<Product[]> {
    return db.getProducts();
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return db.getProduct(id);
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    return db.createProduct(product);
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    return db.updateProduct(id, updates);
  }

  async deleteProduct(id: string): Promise<boolean> {
    return db.deleteProduct(id);
  }

  // Customers
  async getCustomers(): Promise<Customer[]> {
    return db.getCustomers();
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    return db.getCustomer(id);
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    return db.createCustomer(customer);
  }

  async updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer | undefined> {
    return db.updateCustomer(id, updates);
  }

  // Sales
  async getSales(): Promise<Sale[]> {
    return db.getSales();
  }

  async getSale(id: string): Promise<Sale | undefined> {
    return db.getSale(id);
  }

  async createSale(sale: InsertSale): Promise<Sale> {
    return db.createSale(sale);
  }

  // Credit Ledger
  async getCreditLedger(): Promise<CreditLedger[]> {
    return db.getCreditLedger();
  }

  async createCreditLedgerEntry(entry: InsertCreditLedger): Promise<CreditLedger> {
    return db.createCreditLedgerEntry(entry);
  }

  // Staff
  async getStaff(): Promise<Staff[]> {
    return db.getStaff();
  }

  async getStaffMember(id: string): Promise<Staff | undefined> {
    return db.getStaffMember(id);
  }

  async getStaffByPin(pin: string): Promise<Staff | undefined> {
    return db.getStaffByPin(pin);
  }

  async getStaffByBarcode(barcode: string): Promise<Staff | undefined> {
    return db.getStaffByBarcode(barcode);
  }

  async createStaff(staff: InsertStaff): Promise<Staff> {
    return db.createStaff(staff);
  }

  async updateStaff(id: string, updates: Partial<InsertStaff>): Promise<Staff | undefined> {
    return db.updateStaff(id, updates);
  }

  async deleteStaff(id: string): Promise<boolean> {
    return db.deleteStaff(id);
  }

  async suspendStaff(id: string): Promise<Staff | undefined> {
    return db.suspendStaff(id);
  }

  async activateStaff(id: string): Promise<Staff | undefined> {
    return db.activateStaff(id);
  }

  // Dashboard
  async getDashboardSummary(): Promise<DashboardSummary> {
    const todaySales = await db.getTodaySales();
    const totalSalesToday = todaySales.reduce((sum, sale) => sum + sale.total, 0);
    const totalReceivables = await db.getTotalReceivables();
    const lowStockItems = await db.getLowStockProducts();

    // Simple AI insight based on data
    let aiInsight = "Welcome! Everything looks stable today.";
    if (lowStockItems.length > 2) {
      aiInsight = `Alert: ${lowStockItems.length} items are running low. Consider restocking soon.`;
    } else if (totalReceivables > 200) {
      aiInsight = "Tip: You have significant outstanding receivables. Consider following up on payments.";
    } else if (totalSalesToday > 50) {
      aiInsight = "Great job! Sales are performing well today. Keep up the momentum!";
    }

    return {
      totalSalesToday,
      totalReceivables,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      aiInsight,
    };
  }

  // Initialize with mock data
  async initialize(): Promise<void> {
    await db.initializeMockData();
  }
}

export const storage = new POSStorage();
