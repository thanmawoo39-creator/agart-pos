import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { productSchema, customerSchema, saleSchema, creditLedgerSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize storage with mock data
  await storage.initialize();

  // Dashboard
  app.get("/api/dashboard/summary", async (req, res) => {
    try {
      const summary = await storage.getDashboardSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
      res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const parsed = productSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid product data", details: parsed.error.errors });
      }
      const product = await storage.createProduct(parsed.data);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Customers
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const parsed = customerSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid customer data", details: parsed.error.errors });
      }
      const customer = await storage.createCustomer(parsed.data);
      res.status(201).json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.updateCustomer(req.params.id, req.body);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error updating customer:", error);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // Sales
  app.get("/api/sales", async (req, res) => {
    try {
      const sales = await storage.getSales();
      res.json(sales);
    } catch (error) {
      console.error("Error fetching sales:", error);
      res.status(500).json({ error: "Failed to fetch sales" });
    }
  });

  app.get("/api/sales/:id", async (req, res) => {
    try {
      const sale = await storage.getSale(req.params.id);
      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }
      res.json(sale);
    } catch (error) {
      console.error("Error fetching sale:", error);
      res.status(500).json({ error: "Failed to fetch sale" });
    }
  });

  app.post("/api/sales", async (req, res) => {
    try {
      const parsed = saleSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid sale data", details: parsed.error.errors });
      }
      const sale = await storage.createSale(parsed.data);
      res.status(201).json(sale);
    } catch (error) {
      console.error("Error creating sale:", error);
      res.status(500).json({ error: "Failed to create sale" });
    }
  });

  // Credit Ledger
  app.get("/api/credit-ledger", async (req, res) => {
    try {
      const ledger = await storage.getCreditLedger();
      res.json(ledger);
    } catch (error) {
      console.error("Error fetching credit ledger:", error);
      res.status(500).json({ error: "Failed to fetch credit ledger" });
    }
  });

  app.post("/api/credit-ledger", async (req, res) => {
    try {
      const parsed = creditLedgerSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid credit ledger data", details: parsed.error.errors });
      }
      const entry = await storage.createCreditLedgerEntry(parsed.data);
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating credit ledger entry:", error);
      res.status(500).json({ error: "Failed to create credit ledger entry" });
    }
  });

  // Barcode scanning - Products
  app.get("/api/scan/product/:barcode", async (req, res) => {
    try {
      const products = await storage.getProducts();
      const product = products.find((p) => p.barcode === req.params.barcode);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error scanning product:", error);
      res.status(500).json({ error: "Failed to scan product" });
    }
  });

  // Barcode scanning - Customers
  app.get("/api/scan/customer/:barcode", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      const customer = customers.find((c) => c.barcode === req.params.barcode);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error scanning customer:", error);
      res.status(500).json({ error: "Failed to scan customer" });
    }
  });

  // Complete sale with stock updates and credit handling
  app.post("/api/sales/complete", async (req, res) => {
    try {
      const parsed = saleSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid sale data", details: parsed.error.errors });
      }

      const saleData = parsed.data;

      // Update product stock
      for (const item of saleData.items) {
        const product = await storage.getProduct(item.productId);
        if (product) {
          await storage.updateProduct(item.productId, {
            stock: Math.max(0, product.stock - item.quantity),
          });
        }
      }

      // Handle credit payment
      if (saleData.paymentMethod === "credit" && saleData.customerId) {
        const customer = await storage.getCustomer(saleData.customerId);
        if (customer) {
          const newBalance = customer.currentBalance + saleData.total;
          await storage.updateCustomer(saleData.customerId, {
            currentBalance: newBalance,
          });

          // Create credit ledger entry
          await storage.createCreditLedgerEntry({
            customerId: customer.id,
            customerName: customer.name,
            type: "charge",
            amount: saleData.total,
            balanceAfter: newBalance,
            description: `Sale - ${saleData.items.length} item(s)`,
            timestamp: saleData.timestamp,
          });
        }
      }

      // Create the sale record
      const sale = await storage.createSale(saleData);
      res.status(201).json(sale);
    } catch (error) {
      console.error("Error completing sale:", error);
      res.status(500).json({ error: "Failed to complete sale" });
    }
  });

  return httpServer;
}
