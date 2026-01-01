import Database from "@replit/database";
import type {
  Product,
  Customer,
  Sale,
  CreditLedger,
  Staff,
  Attendance,
  CurrentShift,
  InventoryLog,
  InsertProduct,
  InsertCustomer,
  InsertSale,
  InsertCreditLedger,
  InsertStaff,
  InsertAttendance,
  InsertInventoryLog,
} from "@shared/schema";
import { randomUUID } from "crypto";

const db = new Database();

// Key prefixes for organizing data
const KEYS = {
  PRODUCTS: "products",
  CUSTOMERS: "customers",
  SALES: "sales",
  CREDIT_LEDGER: "creditLedger",
  STAFF: "staff",
  ATTENDANCE: "attendance",
  INVENTORY_LOG: "inventoryLog",
  INITIALIZED: "initialized",
};

// Helper to get all items from a collection
async function getCollection<T>(key: string): Promise<T[]> {
  try {
    const result = await db.get(key);
    if (!result.ok) return [];
    const data = result.value;
    if (!data) return [];
    if (Array.isArray(data)) return data as T[];
    return [];
  } catch (error) {
    console.error(`Error getting collection ${key}:`, error);
    return [];
  }
}

// Helper to set a collection
async function setCollection<T>(key: string, data: T[]): Promise<void> {
  await db.set(key, data);
}

// Products CRUD
export async function getProducts(): Promise<Product[]> {
  return getCollection<Product>(KEYS.PRODUCTS);
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((p) => p.id === id);
}

export async function createProduct(product: InsertProduct): Promise<Product> {
  const products = await getProducts();
  const newProduct: Product = { ...product, id: randomUUID() };
  products.push(newProduct);
  await setCollection(KEYS.PRODUCTS, products);
  return newProduct;
}

export async function updateProduct(
  id: string,
  updates: Partial<InsertProduct>
): Promise<Product | undefined> {
  const products = await getProducts();
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) return undefined;
  products[index] = { ...products[index], ...updates };
  await setCollection(KEYS.PRODUCTS, products);
  return products[index];
}

export async function deleteProduct(id: string): Promise<boolean> {
  const products = await getProducts();
  const filtered = products.filter((p) => p.id !== id);
  if (filtered.length === products.length) return false;
  await setCollection(KEYS.PRODUCTS, filtered);
  return true;
}

// Customers CRUD
export async function getCustomers(): Promise<Customer[]> {
  return getCollection<Customer>(KEYS.CUSTOMERS);
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  const customers = await getCustomers();
  return customers.find((c) => c.id === id);
}

export async function createCustomer(
  customer: InsertCustomer
): Promise<Customer> {
  const customers = await getCustomers();
  const newCustomer: Customer = { ...customer, id: randomUUID() };
  customers.push(newCustomer);
  await setCollection(KEYS.CUSTOMERS, customers);
  return newCustomer;
}

export async function updateCustomer(
  id: string,
  updates: Partial<InsertCustomer>
): Promise<Customer | undefined> {
  const customers = await getCustomers();
  const index = customers.findIndex((c) => c.id === id);
  if (index === -1) return undefined;
  customers[index] = { ...customers[index], ...updates };
  await setCollection(KEYS.CUSTOMERS, customers);
  return customers[index];
}

// Sales CRUD
export async function getSales(): Promise<Sale[]> {
  return getCollection<Sale>(KEYS.SALES);
}

export async function getSale(id: string): Promise<Sale | undefined> {
  const sales = await getSales();
  return sales.find((s) => s.id === id);
}

export async function createSale(sale: InsertSale): Promise<Sale> {
  const sales = await getSales();
  const newSale: Sale = { ...sale, id: randomUUID() };
  sales.push(newSale);
  await setCollection(KEYS.SALES, sales);
  return newSale;
}

// Credit Ledger CRUD
export async function getCreditLedger(): Promise<CreditLedger[]> {
  return getCollection<CreditLedger>(KEYS.CREDIT_LEDGER);
}

export async function createCreditLedgerEntry(
  entry: InsertCreditLedger
): Promise<CreditLedger> {
  const ledger = await getCreditLedger();
  const newEntry: CreditLedger = { ...entry, id: randomUUID() };
  ledger.push(newEntry);
  await setCollection(KEYS.CREDIT_LEDGER, ledger);
  return newEntry;
}

// Dashboard helpers
export async function getTodaySales(): Promise<Sale[]> {
  const sales = await getSales();
  const today = new Date().toISOString().split("T")[0];
  return sales.filter((s) => s.timestamp.startsWith(today));
}

export async function getTotalReceivables(): Promise<number> {
  const customers = await getCustomers();
  return customers.reduce((sum, c) => sum + (c.currentBalance || 0), 0);
}

export async function getLowStockProducts(): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((p) => p.stock <= p.minStockLevel);
}

// Staff CRUD
export async function getStaff(): Promise<Staff[]> {
  return getCollection<Staff>(KEYS.STAFF);
}

export async function getStaffMember(id: string): Promise<Staff | undefined> {
  const staff = await getStaff();
  return staff.find((s) => s.id === id);
}

export async function getStaffByPin(pin: string): Promise<Staff | undefined> {
  const staff = await getStaff();
  return staff.find((s) => s.pin === pin && s.status === "active");
}

export async function getStaffByBarcode(barcode: string): Promise<Staff | undefined> {
  const staff = await getStaff();
  return staff.find((s) => s.barcode === barcode && s.status === "active");
}

export async function suspendStaff(id: string): Promise<Staff | undefined> {
  const staff = await getStaff();
  const index = staff.findIndex((s) => s.id === id);
  if (index === -1) return undefined;
  staff[index] = { ...staff[index], status: "suspended" };
  await setCollection(KEYS.STAFF, staff);
  return staff[index];
}

export async function activateStaff(id: string): Promise<Staff | undefined> {
  const staff = await getStaff();
  const index = staff.findIndex((s) => s.id === id);
  if (index === -1) return undefined;
  staff[index] = { ...staff[index], status: "active" };
  await setCollection(KEYS.STAFF, staff);
  return staff[index];
}

export async function createStaff(staffMember: InsertStaff): Promise<Staff> {
  const staff = await getStaff();
  const newStaff: Staff = { ...staffMember, id: randomUUID() };
  staff.push(newStaff);
  await setCollection(KEYS.STAFF, staff);
  return newStaff;
}

export async function updateStaff(
  id: string,
  updates: Partial<InsertStaff>
): Promise<Staff | undefined> {
  const staff = await getStaff();
  const index = staff.findIndex((s) => s.id === id);
  if (index === -1) return undefined;
  staff[index] = { ...staff[index], ...updates };
  await setCollection(KEYS.STAFF, staff);
  return staff[index];
}

export async function deleteStaff(id: string): Promise<boolean> {
  const staff = await getStaff();
  const filtered = staff.filter((s) => s.id !== id);
  if (filtered.length === staff.length) return false;
  await setCollection(KEYS.STAFF, filtered);
  return true;
}

// Attendance CRUD
export async function getAttendance(): Promise<Attendance[]> {
  return getCollection<Attendance>(KEYS.ATTENDANCE);
}

export async function getAttendanceByDate(date: string): Promise<Attendance[]> {
  const attendance = await getAttendance();
  return attendance.filter((a) => a.date === date);
}

export async function getAttendanceByStaff(staffId: string): Promise<Attendance[]> {
  const attendance = await getAttendance();
  return attendance.filter((a) => a.staffId === staffId);
}

export async function getCurrentShift(): Promise<CurrentShift> {
  const today = new Date().toISOString().split("T")[0];
  const attendance = await getAttendance();
  const activeShift = attendance.find(
    (a) => a.date === today && a.clockOutTime === null
  );

  if (activeShift) {
    return {
      isActive: true,
      staffId: activeShift.staffId,
      staffName: activeShift.staffName,
      clockInTime: activeShift.clockInTime,
      attendanceId: activeShift.id,
    };
  }

  return {
    isActive: false,
    staffId: null,
    staffName: null,
    clockInTime: null,
    attendanceId: null,
  };
}

export async function clockIn(staffId: string, staffName: string): Promise<Attendance> {
  const attendance = await getAttendance();
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  const newAttendance: Attendance = {
    id: randomUUID(),
    staffId,
    staffName,
    date: today,
    clockInTime: now,
    clockOutTime: null,
    totalHours: null,
  };

  attendance.push(newAttendance);
  await setCollection(KEYS.ATTENDANCE, attendance);
  return newAttendance;
}

export async function clockOut(attendanceId: string): Promise<Attendance | undefined> {
  const attendance = await getAttendance();
  const index = attendance.findIndex((a) => a.id === attendanceId);
  if (index === -1) return undefined;

  const now = new Date();
  const clockInTime = new Date(attendance[index].clockInTime);
  const totalHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

  attendance[index] = {
    ...attendance[index],
    clockOutTime: now.toISOString(),
    totalHours: Math.round(totalHours * 100) / 100,
  };

  await setCollection(KEYS.ATTENDANCE, attendance);
  return attendance[index];
}

export async function getAttendanceReport(startDate: string, endDate: string): Promise<Attendance[]> {
  const attendance = await getAttendance();
  return attendance.filter((a) => a.date >= startDate && a.date <= endDate);
}

// Clear all data (for reset)
export async function clearAllData(): Promise<void> {
  await db.delete(KEYS.PRODUCTS);
  await db.delete(KEYS.CUSTOMERS);
  await db.delete(KEYS.SALES);
  await db.delete(KEYS.CREDIT_LEDGER);
  await db.delete(KEYS.STAFF);
  await db.delete(KEYS.ATTENDANCE);
  await db.delete(KEYS.INVENTORY_LOG);
  await db.delete(KEYS.INITIALIZED);
}

// Initialize with mock data
export async function initializeMockData(): Promise<void> {
  const initializedResult = await db.get(KEYS.INITIALIZED);
  const initialized = initializedResult.ok ? initializedResult.value : null;
  
  // Check if data exists and is valid
  const products = await getProducts();
  
  // If already initialized with valid data, skip
  if (initialized === "v9" && products.length > 0) return;
  
  // Clear any existing data and reinitialize
  await clearAllData();

  // Create sample products
  const sampleProducts: InsertProduct[] = [
    {
      name: "Coffee (Large)",
      price: 4.99,
      cost: 2.50,
      barcode: "1234567890123",
      stock: 50,
      minStockLevel: 10,
      unit: "pcs",
      category: "Beverages",
    },
    {
      name: "Bread (Whole Wheat)",
      price: 3.49,
      cost: 1.80,
      barcode: "1234567890124",
      stock: 5,
      minStockLevel: 10,
      unit: "loaf",
      category: "Bakery",
    },
    {
      name: "Milk (1 Gallon)",
      price: 5.99,
      cost: 3.50,
      barcode: "1234567890125",
      stock: 3,
      minStockLevel: 8,
      unit: "gallon",
      category: "Dairy",
    },
    {
      name: "Orange Juice",
      price: 6.49,
      cost: 3.20,
      barcode: "1234567890126",
      stock: 25,
      minStockLevel: 5,
      unit: "bottle",
      category: "Beverages",
    },
  ];

  for (const product of sampleProducts) {
    await createProduct(product);
  }

  // Create sample customers
  await createCustomer({
    name: "John Smith",
    phone: "+1 555-0123",
    email: "john.smith@email.com",
    barcode: "CUST001",
    creditLimit: 500,
    currentBalance: 45.50,
    loyaltyPoints: 150,
    riskTag: "low",
  });

  await createCustomer({
    name: "Jane Doe",
    phone: "+1 555-0456",
    email: "jane.doe@email.com",
    barcode: "CUST002",
    creditLimit: 200,
    currentBalance: 180.00,
    loyaltyPoints: 50,
    riskTag: "high",
  });

  // Create a sample sale for today
  const createdProducts = await getProducts();
  if (createdProducts.length > 0) {
    await createSale({
      items: [
        {
          productId: createdProducts[0].id,
          productName: createdProducts[0].name,
          quantity: 2,
          unitPrice: createdProducts[0].price,
          total: createdProducts[0].price * 2,
        },
      ],
      subtotal: createdProducts[0].price * 2,
      discount: 0,
      tax: createdProducts[0].price * 2 * 0.08,
      total: createdProducts[0].price * 2 * 1.08,
      paymentMethod: "cash",
      storeId: "store-001",
      timestamp: new Date().toISOString(),
      createdBy: "System",
    });
  }

  // Create sample staff members
  await createStaff({
    name: "Admin Owner",
    pin: "1234",
    role: "owner",
    barcode: "STAFF001",
    status: "active",
  });

  await createStaff({
    name: "Sarah Manager",
    pin: "2345",
    role: "manager",
    barcode: "STAFF002",
    status: "active",
  });

  await createStaff({
    name: "Mike Cashier",
    pin: "3456",
    role: "cashier",
    barcode: "STAFF003",
    status: "active",
  });

  await db.set(KEYS.INITIALIZED, "v9");
}

// Inventory Log CRUD
export async function getInventoryLogs(): Promise<InventoryLog[]> {
  return getCollection<InventoryLog>(KEYS.INVENTORY_LOG);
}

export async function getInventoryLogsByProduct(productId: string): Promise<InventoryLog[]> {
  const logs = await getInventoryLogs();
  return logs.filter((log) => log.productId === productId);
}

export async function createInventoryLog(log: InsertInventoryLog): Promise<InventoryLog> {
  const logs = await getInventoryLogs();
  const newLog: InventoryLog = { ...log, id: randomUUID() };
  logs.push(newLog);
  await setCollection(KEYS.INVENTORY_LOG, logs);
  return newLog;
}

// Stock adjustment with audit trail
export async function adjustStock(
  productId: string,
  quantityChange: number,
  type: "stock-in" | "sale" | "adjustment",
  staffId?: string,
  staffName?: string,
  reason?: string
): Promise<{ product: Product; log: InventoryLog } | undefined> {
  const product = await getProduct(productId);
  if (!product) return undefined;

  const previousStock = product.stock;
  const currentStock = Math.max(0, previousStock + quantityChange);

  // Update product stock
  const updatedProduct = await updateProduct(productId, { stock: currentStock });
  if (!updatedProduct) return undefined;

  // Create audit log
  const log = await createInventoryLog({
    productId,
    productName: product.name,
    type,
    quantityChanged: quantityChange,
    previousStock,
    currentStock,
    staffId,
    staffName,
    reason,
    timestamp: new Date().toISOString(),
  });

  return { product: updatedProduct, log };
}

export default db;
