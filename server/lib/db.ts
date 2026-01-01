import Database from "@replit/database";
import type {
  Product,
  Customer,
  Sale,
  CreditLedger,
  InsertProduct,
  InsertCustomer,
  InsertSale,
  InsertCreditLedger,
} from "@shared/schema";
import { randomUUID } from "crypto";

const db = new Database();

// Key prefixes for organizing data
const KEYS = {
  PRODUCTS: "products",
  CUSTOMERS: "customers",
  SALES: "sales",
  CREDIT_LEDGER: "creditLedger",
  INITIALIZED: "initialized",
};

// Helper to get all items from a collection
async function getCollection<T>(key: string): Promise<T[]> {
  try {
    const data = await db.get(key);
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

export async function getTotalCreditBalance(): Promise<number> {
  const customers = await getCustomers();
  return customers.reduce((sum, c) => sum + (c.creditBalance || 0), 0);
}

export async function getLowStockProducts(): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((p) => p.stock <= p.reorderLevel);
}

// Clear all data (for reset)
export async function clearAllData(): Promise<void> {
  await db.delete(KEYS.PRODUCTS);
  await db.delete(KEYS.CUSTOMERS);
  await db.delete(KEYS.SALES);
  await db.delete(KEYS.CREDIT_LEDGER);
  await db.delete(KEYS.INITIALIZED);
}

// Initialize with mock data
export async function initializeMockData(): Promise<void> {
  const initialized = await db.get(KEYS.INITIALIZED);
  
  // Check if data exists and is valid
  const products = await getProducts();
  const sales = await getSales();
  
  // If already initialized with valid data, skip
  if (initialized === "v3" && products.length > 0) return;
  
  // Clear any existing data and reinitialize
  await clearAllData();

  // Create sample products
  const sampleProducts: InsertProduct[] = [
    {
      name: "Coffee (Large)",
      price: 4.99,
      stock: 50,
      reorderLevel: 10,
      category: "Beverages",
    },
    {
      name: "Bread (Whole Wheat)",
      price: 3.49,
      stock: 5,
      reorderLevel: 10,
      category: "Bakery",
    },
    {
      name: "Milk (1 Gallon)",
      price: 5.99,
      stock: 3,
      reorderLevel: 8,
      category: "Dairy",
    },
  ];

  for (const product of sampleProducts) {
    await createProduct(product);
  }

  // Create sample customer
  await createCustomer({
    name: "John Smith",
    phone: "+1 555-0123",
    email: "john.smith@email.com",
    creditBalance: 45.50,
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
      tax: createdProducts[0].price * 2 * 0.08,
      total: createdProducts[0].price * 2 * 1.08,
      paymentMethod: "cash",
      timestamp: new Date().toISOString(),
    });
  }

  await db.set(KEYS.INITIALIZED, "v3");
}

export default db;
