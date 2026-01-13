import { Router } from "express";
import { storage } from "../storage";
import { customerSchema } from "../../shared/schema";
import { isAuthenticated } from '../middleware/auth';

const router = Router();

const getScopedBusinessUnitId = (req: any, res: any): string | null => {
  const rawFromBody = typeof req.body?.businessUnitId === 'string' ? req.body.businessUnitId : '';
  const rawFromQuery = typeof req.query?.businessUnitId === 'string' ? req.query.businessUnitId : '';
  const businessUnitId = rawFromBody || rawFromQuery;
  if (!businessUnitId) {
    res.status(400).json({ error: 'businessUnitId is required' });
    return null;
  }

  const userBusinessUnitId = req.user?.businessUnitId;
  const userRole = req.user?.role;
  if (userRole !== 'owner') {
    if (!userBusinessUnitId) {
      res.status(403).json({ error: 'User has no assigned business unit' });
      return null;
    }
    if (businessUnitId !== userBusinessUnitId) {
      res.status(403).json({ error: 'Business unit mismatch' });
      return null;
    }
  }

  return businessUnitId;
};

router.get("/", isAuthenticated, async (req, res) => {
  try {
    const businessUnitId = getScopedBusinessUnitId(req, res);
    if (!businessUnitId) return;

    const customers = await storage.getCustomers();
    res.json(customers.filter((c: any) => (c?.businessUnitId || null) === businessUnitId));
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const businessUnitId = getScopedBusinessUnitId(req, res);
    if (!businessUnitId) return;

    const customer = await storage.getCustomer(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    if ((customer as any)?.businessUnitId !== businessUnitId) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(customer);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

router.post("/", isAuthenticated, async (req, res) => {
  try {
    const businessUnitId = req.body?.businessUnitId || req.user?.businessUnitId;
    if (!businessUnitId) {
      return res.status(400).json({ error: 'businessUnitId is required' });
    }

    const parsed = customerSchema.omit({ id: true }).safeParse({
      ...(req.body || {}),
      businessUnitId,
    });
    if (!parsed.success) return res.status(400).json({ error: "Invalid customer data", details: parsed.error.errors });
    res.status(201).json(await storage.createCustomer(parsed.data));
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({ error: "Failed to create customer" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    // Clean up the request body - convert empty strings to null for optional fields
    const cleanedData: any = { ...req.body };
    if (cleanedData.email === '') cleanedData.email = null;
    if (cleanedData.phone === '') cleanedData.phone = null;
    if (cleanedData.barcode === '') cleanedData.barcode = null;
    if (cleanedData.imageUrl === '') cleanedData.imageUrl = null;

    // Validate using partial schema (all fields optional for updates)
    const parsed = customerSchema.partial().safeParse(cleanedData);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid customer data",
        details: parsed.error.errors
      });
    }

    const customer = await storage.updateCustomer(req.params.id, parsed.data);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ error: "Failed to update customer" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await storage.deleteCustomer(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Customer not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

router.get("/:id/ledger", isAuthenticated, async (req, res) => {
  try {
    const businessUnitId = getScopedBusinessUnitId(req, res);
    if (!businessUnitId) return;

    const customer = await storage.getCustomer(req.params.id);
    if (!customer || (customer as any)?.businessUnitId !== businessUnitId) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const ledger = await storage.getCreditLedger();
    const customerLedger = ledger.filter(entry => entry.customerId === req.params.id);
    res.json(customerLedger);
  } catch (error) {
    console.error("Error fetching customer ledger:", error);
    res.status(500).json({ error: "Failed to fetch customer ledger" });
  }
});

router.post("/:id/payment", isAuthenticated, async (req, res) => {
  try {
    const businessUnitId = getScopedBusinessUnitId(req, res);
    if (!businessUnitId) return;

    const { amount, description, createdBy } = req.body;
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    const customer = await storage.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if ((customer as any)?.businessUnitId !== businessUnitId) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const newBalance = Math.max(0, customer.currentBalance - amount);

    // Create ledger entry
    await storage.createCreditLedgerEntry({
      customerId: customer.id,
      customerName: customer.name,
      type: "repayment",
      amount: -amount,
      balanceAfter: newBalance,
      description: description || "Payment received",
      timestamp: new Date().toISOString(),
      createdBy: createdBy,
    });

    // Update customer balance
    await storage.updateCustomer(req.params.id, {
      currentBalance: newBalance,
    });

    res.json({ success: true });
  } catch (error: unknown) {
    console.error("Error adding payment:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to add payment" });
  }
});

router.post("/:id/repay", isAuthenticated, async (req, res) => {
  try {
    const businessUnitId = getScopedBusinessUnitId(req, res);
    if (!businessUnitId) return;

    const { amount, description, createdBy } = req.body;
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid repayment amount" });
    }

    const customer = await storage.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if ((customer as any)?.businessUnitId !== businessUnitId) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const newBalance = Math.max(0, customer.currentBalance - amount);

    // Create ledger entry
    await storage.createCreditLedgerEntry({
      customerId: customer.id,
      customerName: customer.name,
      type: "repayment",
      amount: -amount,
      balanceAfter: newBalance,
      description: description || "Debt Repayment",
      timestamp: new Date().toISOString(),
      createdBy: createdBy,
    });

    // Update customer balance
    await storage.updateCustomer(req.params.id, {
      currentBalance: newBalance,
    });

    res.json({ success: true });
  } catch (error: unknown) {
    console.error("Error adding repayment:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to add repayment" });
  }
});

router.post("/:id/repayment", isAuthenticated, async (req, res) => {
  try {
    const businessUnitId = getScopedBusinessUnitId(req, res);
    if (!businessUnitId) return;

    const { amount, description, createdBy } = req.body;
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid repayment amount" });
    }

    const customer = await storage.getCustomer(req.params.id);
    if (!customer || (customer as any)?.businessUnitId !== businessUnitId) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const result = await storage.applyCustomerRepayment({
      customerId: customer.id,
      amount,
      description: description || "Debt Repayment",
      createdBy: createdBy,
    });

    res.json({ success: true, customer: result.customer, ledgerEntry: result.ledgerEntry });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process repayment";
    const status = message === 'Customer not found' || message === 'Invalid repayment amount' ? 400 : 500;
    res.status(status).json({ error: message });
  }
});


export default router;
