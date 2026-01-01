import type {
  Product,
  Customer,
  InsertSale,
  InsertCreditLedger,
  SaleItem,
} from "@shared/schema";
import * as db from "./db";

// Domain Error Types
export class POSError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "POSError";
  }
}

export class ProductNotFoundError extends POSError {
  constructor(barcode: string) {
    super(`Product not found with barcode: ${barcode}`, "PRODUCT_NOT_FOUND");
  }
}

export class CustomerNotFoundError extends POSError {
  constructor(identifier: string) {
    super(`Customer not found: ${identifier}`, "CUSTOMER_NOT_FOUND");
  }
}

export class CustomerRequiredError extends POSError {
  constructor() {
    super("Credit sale requires a linked customer", "CUSTOMER_REQUIRED");
  }
}

export class CreditLimitExceededError extends POSError {
  constructor(customerName: string, limit: number, newBalance: number) {
    super(
      `Credit limit exceeded for ${customerName}. Limit: $${limit.toFixed(2)}, New balance would be: $${newBalance.toFixed(2)}`,
      "CREDIT_LIMIT_EXCEEDED"
    );
  }
}

export class InsufficientStockError extends POSError {
  constructor(productName: string, available: number, requested: number) {
    super(
      `Insufficient stock for ${productName}. Available: ${available}, Requested: ${requested}`,
      "INSUFFICIENT_STOCK"
    );
  }
}

// Find product by barcode
export async function findProductByBarcode(
  barcode: string
): Promise<Product | null> {
  const products = await db.getProducts();
  return products.find((p) => p.barcode === barcode) || null;
}

// Find customer by barcode
export async function findCustomerByBarcode(
  barcode: string
): Promise<Customer | null> {
  const customers = await db.getCustomers();
  return customers.find((c) => c.barcode === barcode) || null;
}

// Validate credit sale
export function validateCreditSale(
  customer: Customer | null,
  saleTotal: number
): void {
  if (!customer) {
    throw new CustomerRequiredError();
  }

  const newBalance = customer.currentBalance + saleTotal;
  if (customer.creditLimit > 0 && newBalance > customer.creditLimit) {
    throw new CreditLimitExceededError(
      customer.name,
      customer.creditLimit,
      newBalance
    );
  }
}

// Validate stock availability
export async function validateStock(
  items: SaleItem[]
): Promise<Map<string, Product>> {
  const productMap = new Map<string, Product>();

  for (const item of items) {
    const product = await db.getProduct(item.productId);
    if (!product) {
      throw new ProductNotFoundError(item.productId);
    }
    if (product.stock < item.quantity) {
      throw new InsufficientStockError(
        product.name,
        product.stock,
        item.quantity
      );
    }
    productMap.set(item.productId, product);
  }

  return productMap;
}

// Process sale atomically
// This is the core business logic that ensures ledger is truth
export async function processSale(saleData: InsertSale): Promise<{
  saleId: string;
  success: boolean;
}> {
  // Step 1: Validate stock availability
  const productMap = await validateStock(saleData.items);

  // Step 2: If credit sale, validate customer and credit limit
  let customer: Customer | null = null;
  if (saleData.paymentMethod === "credit") {
    if (!saleData.customerId) {
      throw new CustomerRequiredError();
    }
    customer = (await db.getCustomer(saleData.customerId)) ?? null;
    if (!customer) {
      throw new CustomerNotFoundError(saleData.customerId);
    }
    validateCreditSale(customer, saleData.total);
  }

  // Step 3: Deduct stock for all items and create inventory logs (atomic operation)
  for (const item of saleData.items) {
    const product = productMap.get(item.productId)!;
    // Use adjustStock for audit trail
    // Note: staffId is not available in current sale schema, only staffName via createdBy
    await db.adjustStock(
      item.productId,
      -item.quantity, // Negative for deduction
      "sale",
      undefined, // staffId - not captured in current sale schema
      saleData.createdBy, // staffName from shift
      `Sale: ${item.quantity} x ${product.name}`
    );
  }

  // Step 4: If credit sale, create ledger entry FIRST (Ledger is Truth)
  // Then update customer balance
  if (saleData.paymentMethod === "credit" && customer) {
    const newBalance = customer.currentBalance + saleData.total;

    // Create ledger entry FIRST (append-only, source of truth)
    const ledgerEntry: InsertCreditLedger = {
      customerId: customer.id,
      customerName: customer.name,
      type: "charge",
      amount: saleData.total,
      balanceAfter: newBalance,
      description: `Sale - ${saleData.items.length} item(s)`,
      timestamp: saleData.timestamp,
      createdBy: saleData.createdBy,
    };
    await db.createCreditLedgerEntry(ledgerEntry);

    // Then update customer balance (derived from ledger)
    await db.updateCustomer(customer.id, {
      currentBalance: newBalance,
    });
  }

  // Step 5: Create the sale record
  const sale = await db.createSale(saleData);

  return {
    saleId: sale.id,
    success: true,
  };
}

// Get customer credit ledger entries
export async function getCustomerLedger(
  customerId: string
): Promise<InsertCreditLedger[]> {
  const allEntries = await db.getCreditLedger();
  return allEntries.filter((entry) => entry.customerId === customerId);
}

// Add payment to customer ledger (reduces balance)
export async function addCustomerPayment(
  customerId: string,
  amount: number,
  description?: string,
  createdBy?: string
): Promise<void> {
  const customer = await db.getCustomer(customerId);
  if (!customer) {
    throw new CustomerNotFoundError(customerId);
  }

  const newBalance = Math.max(0, customer.currentBalance - amount);

  // Create ledger entry FIRST (append-only, source of truth)
  const ledgerEntry: InsertCreditLedger = {
    customerId: customer.id,
    customerName: customer.name,
    type: "payment",
    amount: amount,
    balanceAfter: newBalance,
    description: description || "Payment received",
    timestamp: new Date().toISOString(),
    createdBy: createdBy,
  };
  await db.createCreditLedgerEntry(ledgerEntry);

  // Then update customer balance
  await db.updateCustomer(customerId, {
    currentBalance: newBalance,
  });
}
