import { describe, it, expect, beforeAll } from 'vitest';
import { POSStorage } from '../storage';
import type { InsertProduct, InsertCustomer, InsertExpense } from '../../shared/schema';

/**
 * Unit tests for POSStorage class
 * These tests verify data integrity during refactoring
 */

describe('POSStorage', () => {
  let storage: POSStorage;
  let testBusinessUnitId: string | null = null;

  beforeAll(async () => {
    storage = new POSStorage();
    // Get an existing business unit ID for FK constraint compliance
    const businessUnits = await storage.getBusinessUnits();
    if (businessUnits.length > 0) {
      testBusinessUnitId = businessUnits[0].id;
    }
  });

  describe('Product Operations', () => {
    let createdProductId: string;

    it('should create a product with all required fields', async () => {
      const productData: InsertProduct = {
        name: 'Test Product',
        price: 9.99,
        stock: 100,
        minStockLevel: 10,
        unit: 'pcs',
        // Use existing business unit or null (FK constraint requires valid ID or null)
        businessUnitId: testBusinessUnitId ?? undefined,
      };

      const product = await storage.createProduct(productData);

      expect(product).toBeDefined();
      expect(product.id).toBeDefined();
      expect(product.name).toBe('Test Product');
      expect(product.price).toBe(9.99);
      expect(product.stock).toBe(100);
      expect(product.minStockLevel).toBe(10);
      expect(product.unit).toBe('pcs');
      expect(product.status).toBe('active');
      expect(product.barcode).toBeDefined(); // Auto-generated if not provided

      createdProductId = product.id;
    });

    it('should retrieve a product by ID', async () => {
      if (!createdProductId) {
        // Create a product first if none exists
        const product = await storage.createProduct({
          name: 'Retrieval Test Product',
          price: 19.99,
          stock: 50,
          minStockLevel: 5,
          unit: 'pcs',
        });
        createdProductId = product.id;
      }

      const product = await storage.getProduct(createdProductId);

      expect(product).toBeDefined();
      expect(product?.id).toBe(createdProductId);
    });

    it('should soft-delete a product by setting status to archived', async () => {
      // Create a product to delete
      const product = await storage.createProduct({
        name: 'Delete Test Product',
        price: 5.99,
        stock: 10,
        minStockLevel: 2,
        unit: 'pcs',
      });

      const deleted = await storage.deleteProduct(product.id);
      expect(deleted).toBe(true);

      // Verify the product still exists but is archived
      const deletedProduct = await storage.getProduct(product.id);
      expect(deletedProduct).toBeDefined();
      expect(deletedProduct?.status).toBe('archived');

      // Verify it doesn't appear in getProducts (which filters by active)
      const products = await storage.getProducts();
      const foundInList = products.find(p => p.id === product.id);
      expect(foundInList).toBeUndefined();
    });
  });

  describe('Customer Operations', () => {
    let createdCustomerId: string;

    it('should create a customer with credit limit', async () => {
      const customerData: InsertCustomer = {
        name: 'Test Customer',
        phone: '09123456789',
        email: 'test@example.com',
        creditLimit: 50000,
        currentBalance: 0,
        status: 'active',
        loyaltyPoints: 0,
        riskTag: 'low',
        businessUnitId: testBusinessUnitId ?? undefined,
      };

      const customer = await storage.createCustomer(customerData);

      expect(customer).toBeDefined();
      expect(customer.id).toBeDefined();
      expect(customer.name).toBe('Test Customer');
      expect(customer.creditLimit).toBe(50000);
      expect(customer.currentBalance).toBe(0);
      expect(customer.status).toBe('active');

      createdCustomerId = customer.id;
    });

    it('should update customer balance correctly', async () => {
      if (!createdCustomerId) {
        const customer = await storage.createCustomer({
          name: 'Balance Test Customer',
          creditLimit: 10000,
          currentBalance: 0,
          status: 'active',
          loyaltyPoints: 0,
          riskTag: 'low',
          businessUnitId: testBusinessUnitId ?? undefined,
        });
        createdCustomerId = customer.id;
      }

      // Update the balance
      const updated = await storage.updateCustomer(createdCustomerId, {
        currentBalance: 5000,
      });

      expect(updated).toBeDefined();
      expect(updated?.currentBalance).toBe(5000);

      // Verify the update persisted
      const customer = await storage.getCustomer(createdCustomerId);
      expect(customer?.currentBalance).toBe(5000);
    });

    it('should soft-delete a customer', async () => {
      const customer = await storage.createCustomer({
        name: 'Delete Test Customer',
        creditLimit: 0,
        currentBalance: 0,
        status: 'active',
        loyaltyPoints: 0,
        riskTag: 'low',
        businessUnitId: testBusinessUnitId ?? undefined,
      });

      const deleted = await storage.deleteCustomer(customer.id);
      expect(deleted).toBe(true);

      // Verify the customer is archived, not deleted
      const deletedCustomer = await storage.getCustomer(customer.id);
      expect(deletedCustomer).toBeDefined();
      expect(deletedCustomer?.status).toBe('archived');
    });
  });

  describe('Expense Operations', () => {
    it('should create an expense with valid category', async () => {
      const expenseData: InsertExpense = {
        category: 'Electricity',
        amount: 15000,
        date: new Date().toISOString().split('T')[0],
        description: 'Monthly electricity bill',
      };

      const expense = await storage.createExpense(expenseData);

      expect(expense).toBeDefined();
      expect(expense.id).toBeDefined();
      expect(expense.category).toBe('Electricity');
      expect(expense.amount).toBe(15000);
      expect(expense.timestamp).toBeDefined();
    });

    it('should retrieve expenses by date range', async () => {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      // Create an expense within the range
      await storage.createExpense({
        category: 'Internet',
        amount: 25000,
        date: endDate,
      });

      const expenses = await storage.getExpensesByDateRange(startDate, endDate);

      expect(Array.isArray(expenses)).toBe(true);
      // Should include at least the expense we just created
      const hasInternetExpense = expenses.some(e => e.category === 'Internet');
      expect(hasInternetExpense).toBe(true);
    });

    it('should retrieve expenses by category', async () => {
      // Create a fuel expense
      await storage.createExpense({
        category: 'Fuel',
        amount: 50000,
        date: new Date().toISOString().split('T')[0],
      });

      const fuelExpenses = await storage.getExpensesByCategory('Fuel');

      expect(Array.isArray(fuelExpenses)).toBe(true);
      expect(fuelExpenses.length).toBeGreaterThan(0);
      expect(fuelExpenses.every(e => e.category === 'Fuel')).toBe(true);
    });
  });
});
