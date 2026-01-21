import { Router } from "express";
import { storage } from "../storage";
import { customerSchema, staff, sales, type Customer } from "../../shared/schema";
import { isAuthenticated, validateBusinessUnitAccess } from '../middleware/auth';
import { db } from "../lib/db";
import { eq, or, desc, inArray } from "drizzle-orm";

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Customers
 *     description: Customer operations
 */

router.get("/", isAuthenticated, async (req, res) => {
  /**
   * @openapi
   * /api/customers:
   *   get:
   *     tags: [Customers]
   *     summary: List customers for a business unit
   *     parameters:
   *       - in: query
   *         name: businessUnitId
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Array of customers
   */
  try {
    const validation = validateBusinessUnitAccess(req);
    if (validation.error) {
      return res.status(validation.error.status).json({ error: validation.error.message });
    }
    const businessUnitId = validation.businessUnitId!;

    // 1. Get legacy customers from 'customers' table
    const customers = await storage.getCustomers();
    // STRICT ISOLATION: Show ONLY customers that originated in this business unit
    const legacyCustomers = customers.filter((c) => c.originUnit === businessUnitId);

    // 2. Get online customers/guests from 'staff' table
    // Online customers might not have businessUnitId set, or it might match.
    // We include them if they match BU or have no BU set (global/online).
    const onlineStaff = await db.select().from(staff)
      .where(
        or(
          eq(staff.role, 'customer'),
          eq(staff.isGuest, true)
        )
      );

    const relevantStaff = onlineStaff.filter(s => !s.businessUnitId || s.businessUnitId === businessUnitId);

    // 3. Enrich online staff with phone numbers from Sales history
    // (Since 'staff' table doesn't store phone, we look it up from their orders)
    const staffIds = relevantStaff.map(s => s.id);
    const staffPhoneMap = new Map<string, string>();

    if (staffIds.length > 0) {
      // Fetch recent sales to find phone numbers associated with these guestIds
      const recentSales = await db.select({
        guestId: sales.guestId,
        customerPhone: sales.customerPhone,
        createdAt: sales.createdAt
      })
        .from(sales)
        .where(inArray(sales.guestId, staffIds))
        .orderBy(desc(sales.createdAt));

      for (const sale of recentSales) {
        if (sale.guestId && sale.customerPhone && !staffPhoneMap.has(sale.guestId)) {
          staffPhoneMap.set(sale.guestId, sale.customerPhone);
        }
      }
    }

    // 4. Map staff records to Customer interface
    const mappedOnlineCustomers: Customer[] = relevantStaff.map(s => {
      return {
        id: s.id,
        name: s.name,
        phone: staffPhoneMap.get(s.id) || null, // Retrieved from sales history
        email: null,
        barcode: s.barcode,
        memberId: null,
        imageUrl: null,
        status: s.status,
        creditLimit: 0,
        currentBalance: 0,
        dueDate: null,
        creditDueDate: null,
        monthlyClosingDay: null,
        loyaltyPoints: 0,
        riskTag: 'low',
        businessUnitId: s.businessUnitId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      };
    });

    // 5. Merge and Sort (Newest first)
    // Use a Map to prevent duplicates if a user somehow exists in both (unlikely but safe)
    const distinctCustomers = new Map<string, Customer>();

    // Add mapped online customers first
    mappedOnlineCustomers.forEach(c => distinctCustomers.set(c.id, c));

    // Add legacy customers (overwriting if ID collision - legacy takes precedence?)
    // Actually, legacy 'customers' table is more "official", so let's let them overwrite if needed.
    legacyCustomers.forEach(c => distinctCustomers.set(c.id, c));

    const allCustomers = Array.from(distinctCustomers.values()).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json(allCustomers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

router.get("/:id", isAuthenticated, async (req, res) => {
  /**
   * @openapi
   * /api/customers/{id}:
   *   get:
   *     tags: [Customers]
   *     summary: Get a customer by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Customer
   *       404:
   *         description: Not found
   */
  try {
    const validation = validateBusinessUnitAccess(req);
    const isOwner = (req.user as any)?.role === 'owner';

    // Owner Bypass: Owners can see ANY customer regardless of validation errors or location
    if (validation.error && !isOwner) {
      return res.status(validation.error.status).json({ error: validation.error.message });
    }
    const businessUnitId = validation.businessUnitId;

    const customer = await storage.getCustomer(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    // STRICT ISOLATION: Check originUnit, but bypass for Owner
    if (!isOwner && customer.originUnit !== businessUnitId) {
      return res.status(404).json({ error: "Customer not found in this store" });
    }

    res.json(customer);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

router.post("/", isAuthenticated, async (req, res) => {
  /**
   * @openapi
   * /api/customers:
   *   post:
   *     tags: [Customers]
   *     summary: Create a customer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       201:
   *         description: Customer created
   *       400:
   *         description: Invalid data
   */
  try {
    const validation = validateBusinessUnitAccess(req, { fallbackToUserBusinessUnit: true });
    if (validation.error) {
      return res.status(validation.error.status).json({ error: validation.error.message });
    }
    const businessUnitId = validation.businessUnitId!;

    // Set originUnit to track where the customer was originally created
    // This is used for customer segmentation (Restaurant vs Grocery)

    // Clean up request body: convert empty strings to null to avoid UNIQUE constraint violations
    // (e.g. multiple empty barcodes causing 500 error)
    const cleanedData = { ...req.body };
    const optionalFields = ['barcode', 'phone', 'email', 'imageUrl', 'memberId', 'dueDate', 'creditDueDate'];

    for (const field of optionalFields) {
      if (cleanedData[field] === "") cleanedData[field] = null;
    }

    // Handle numeric fields explicitly
    const numericFields = ['monthlyClosingDay', 'creditLimit', 'loyaltyPoints', 'currentBalance'];
    for (const field of numericFields) {
      if (cleanedData[field] === "" || cleanedData[field] === undefined) {
        cleanedData[field] = (field === 'monthlyClosingDay') ? null : 0;
      } else {
        const val = Number(cleanedData[field]);
        cleanedData[field] = isNaN(val) ? ((field === 'monthlyClosingDay') ? null : 0) : val;
      }
    }

    const parsed = customerSchema.omit({ id: true }).safeParse({
      ...cleanedData,
      businessUnitId,
      // CRITICAL: Force originUnit to current store to ensure isolation
      originUnit: businessUnitId,
    });
    // Force explicit null for empty strings
    const finalData = {
      ...parsed.data,
      barcode: parsed.data.barcode || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null
    };

    console.log("Creating customer with data:", finalData);

    res.status(201).json(await storage.createCustomer(finalData));
  } catch (error: any) {
    console.error("Create customer error details:", error);

    // Check for unique constraint violation (SQLite specific code)
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || error?.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: "A customer with this barcode, email, or ID already exists." });
    }

    res.status(500).json({ error: "Failed to create customer" });
  }
});

router.patch("/:id", isAuthenticated, async (req, res) => {
  /**
   * @openapi
   * /api/customers/{id}:
   *   patch:
   *     tags: [Customers]
   *     summary: Update a customer
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Updated customer
   *       404:
   *         description: Not found
   */
  try {
    const userRole = (req.user as any)?.role;
    const isOwner = userRole === 'owner';

    // Helper to find customer or staff-as-customer
    const findEntity = async (id: string) => {
      const c = await storage.getCustomer(id);
      if (c) return { type: 'customer', data: c };

      const [s] = await db.select().from(staff).where(eq(staff.id, id));
      if (s && (s.role === 'customer' || s.isGuest)) return { type: 'staff', data: s };

      return null;
    };

    // If NOT owner, strictly enforce business unit access
    if (!isOwner) {
      const validation = validateBusinessUnitAccess(req);
      if (validation.error) {
        return res.status(validation.error.status).json({ error: validation.error.message });
      }
      const businessUnitId = validation.businessUnitId!;

      const entity = await findEntity(req.params.id);
      if (!entity) return res.status(404).json({ error: "Customer not found" });

      const effectiveOrigin = entity.data.businessUnitId; // Staff/Customer both have this
      // Note: Customers have originUnit, Staff uses businessUnitId. 
      // For strict check:
      const origin = entity.type === 'customer'
        ? ((entity.data as any).originUnit || entity.data.businessUnitId)
        : entity.data.businessUnitId;

      if (origin && origin !== businessUnitId) { // If origin is null (global), allow access? Assuming strict for now.
        // Online customers might have null businessUnitId (global). Allow if null? 
        // Previous GET logic: !s.businessUnitId || s.businessUnitId === businessUnitId
        if (origin !== businessUnitId) {
          // If origin is present and mismatch -> 403. 
          // If origin is null -> Allow (Global user).
          return res.status(403).json({ error: "Unauthorized: Cannot edit customer from another unit" });
        }
      }
    }

    // Clean up the request body - convert empty strings to null for optional fields
    const cleanedData: Record<string, unknown> = { ...req.body };
    if (cleanedData.email === '') cleanedData.email = null;
    if (cleanedData.phone === '') cleanedData.phone = null;
    if (cleanedData.barcode === '') cleanedData.barcode = null;
    if (cleanedData.imageUrl === '') cleanedData.imageUrl = null;

    // Fix Data Type Mismatch: Explicitly convert to numbers as requested
    const numericFields = ['monthlyClosingDay', 'creditLimit', 'loyaltyPoints', 'currentBalance'];
    for (const field of numericFields) {
      if (field in cleanedData) {
        if (cleanedData[field] === "") {
          cleanedData[field] = 0; // or null depending on field? schema says optional for some.
          // monthlyClosingDay is optional nullable. creditLimit is default 0.
          if (field === 'monthlyClosingDay') cleanedData[field] = null;
        } else if (typeof cleanedData[field] === 'string') {
          const val = parseFloat(cleanedData[field] as string);
          cleanedData[field] = isNaN(val) ? 0 : val;
        } else if (typeof cleanedData[field] === 'number') {
          // Already a number, do nothing
        }
      }
    }

    // Validate using partial schema (all fields optional for updates)
    const parsed = customerSchema.partial().safeParse(cleanedData);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid customer data",
        details: parsed.error.errors
      });
    }

    // Attempt update in Customers table
    const customer = await storage.updateCustomer(req.params.id, parsed.data);
    if (customer) {
      return res.json(customer);
    }

    // If not found in Customers, try updating Staff (Online Customer)
    const [staffMember] = await db.select().from(staff).where(eq(staff.id, req.params.id));
    if (staffMember && (staffMember.role === 'customer' || staffMember.isGuest)) {
      const staffUpdates: Partial<typeof staff.$inferInsert> = {};
      if (parsed.data.name) staffUpdates.name = parsed.data.name;
      if (parsed.data.barcode !== undefined) staffUpdates.barcode = parsed.data.barcode;
      // Staff table doesn't have phone/email/credit columns. 
      // We silently ignore them or log a warning.

      if (Object.keys(staffUpdates).length > 0) {
        await db.update(staff).set({ ...staffUpdates, updatedAt: new Date().toISOString() }).where(eq(staff.id, req.params.id));
      }

      // Return mapped object
      const [updatedStaff] = await db.select().from(staff).where(eq(staff.id, req.params.id));
      return res.json({
        id: updatedStaff.id,
        name: updatedStaff.name,
        phone: null, // Cannot update/retrieve phone from staff table here easily without sales lookup
        email: null,
        barcode: updatedStaff.barcode,
        status: updatedStaff.status,
        creditLimit: 0,
        currentBalance: 0,
        businessUnitId: updatedStaff.businessUnitId,
        riskTag: 'low'
      });
    }

    return res.status(404).json({ error: "Customer not found" });

  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ error: "Failed to update customer" });
  }
});

router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const userRole = (req.user as any)?.role;
    const isOwner = userRole === 'owner';

    // Helper to find customer or staff-as-customer
    const findEntity = async (id: string) => {
      const c = await storage.getCustomer(id);
      if (c) return { type: 'customer', data: c };

      const [s] = await db.select().from(staff).where(eq(staff.id, id));
      if (s && (s.role === 'customer' || s.isGuest)) return { type: 'staff', data: s };

      return null;
    };

    // Owner Bypass: Owners can delete ANY customer regardless of validation errors or location
    // STRICT OWNER OVERRIDE - NO CHECKS
    if (isOwner) {
      const deleted = await storage.deleteCustomer(req.params.id);
      // If not in customers, try staff (for online customers)
      if (!deleted) {
        // Fix: Use generic update if filtered by ID, or ensure ID exists.
        // Also fix status enum: 'archived' -> 'deleted'
        await db.update(staff).set({ status: 'deleted' }).where(eq(staff.id, req.params.id));
      }
      return res.status(204).send();
    }

    // If NOT owner, strictly enforce business unit access
    if (!isOwner) {
      const validation = validateBusinessUnitAccess(req);
      if (validation.error) {
        return res.status(validation.error.status).json({ error: validation.error.message });
      }
      const businessUnitId = validation.businessUnitId!;

      const entity = await findEntity(req.params.id);
      if (!entity) return res.status(404).json({ error: "Customer not found" });

      const origin = entity.type === 'customer'
        ? ((entity.data as any).originUnit || entity.data.businessUnitId)
        : entity.data.businessUnitId;

      if (origin && origin !== businessUnitId) { // Check origin
        return res.status(403).json({ error: "Unauthorized: Cannot delete customer from another unit" });
      }
    }

    // Attempt delete from Customers
    const deletedCustomer = await storage.deleteCustomer(req.params.id);
    if (deletedCustomer) return res.status(204).send();

    // Attempt delete from Staff (Online Customer)
    // Only if it's a customer role or guest
    const [staffMember] = await db.select().from(staff).where(eq(staff.id, req.params.id));
    if (staffMember && (staffMember.role === 'customer' || staffMember.isGuest)) {
      // Fix: 'archived' is not valid in schema. Use 'deleted'.
      await db.update(staff).set({ status: 'deleted' }).where(eq(staff.id, req.params.id));
      return res.status(204).send();
    }

    // If neither found (or deleted)
    return res.status(404).json({ error: "Customer not found" });

  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

router.get("/:id/ledger", isAuthenticated, async (req, res) => {
  try {
    const userRole = (req.user as any)?.role;
    const isOwner = userRole === 'owner';

    // Define helper to find entity (reuse logic or simple check)
    // We just need to verify existence and permissions
    const findEntity = async (id: string) => {
      const c = await storage.getCustomer(id);
      if (c) return { type: 'customer', data: c };
      const [s] = await db.select().from(staff).where(eq(staff.id, id));
      if (s && (s.role === 'customer' || s.isGuest)) return { type: 'staff', data: s };
      return null;
    };

    if (!isOwner) {
      const validation = validateBusinessUnitAccess(req);
      if (validation.error) return res.status(validation.error.status).json({ error: validation.error.message });
      const businessUnitId = validation.businessUnitId;

      const entity = await findEntity(req.params.id);
      if (!entity) return res.status(404).json({ error: 'Customer not found' });

      const origin = entity.type === 'customer'
        ? ((entity.data as any).originUnit || entity.data.businessUnitId)
        : entity.data.businessUnitId;

      if (origin && origin !== businessUnitId) {
        return res.status(404).json({ error: 'Customer not found' });
      }
    } else {
      // Owner check: just verify exists
      const entity = await findEntity(req.params.id);
      if (!entity) return res.status(404).json({ error: 'Customer not found' });
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
    const validation = validateBusinessUnitAccess(req);
    if (validation.error) {
      return res.status(validation.error.status).json({ error: validation.error.message });
    }
    const businessUnitId = validation.businessUnitId!;

    const { amount, description, createdBy } = req.body;
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    const customer = await storage.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (customer.businessUnitId !== businessUnitId) {
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
    const validation = validateBusinessUnitAccess(req);
    if (validation.error) {
      return res.status(validation.error.status).json({ error: validation.error.message });
    }
    const businessUnitId = validation.businessUnitId!;

    const { amount, description, createdBy } = req.body;
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid repayment amount" });
    }

    const customer = await storage.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (customer.businessUnitId !== businessUnitId) {
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
    const validation = validateBusinessUnitAccess(req);
    if (validation.error) {
      return res.status(validation.error.status).json({ error: validation.error.message });
    }
    const businessUnitId = validation.businessUnitId!;

    const { amount, description, createdBy } = req.body;
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid repayment amount" });
    }

    const customer = await storage.getCustomer(req.params.id);
    if (!customer || customer.businessUnitId !== businessUnitId) {
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
