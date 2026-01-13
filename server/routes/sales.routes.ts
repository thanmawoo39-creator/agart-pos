import { Router } from "express";
import { storage } from "../storage";
import { saleSchema, type Attendance } from "../../shared/schema";
import { isAuthenticated, requireRole } from '../middleware/auth';

const router = Router();

const getScopedBusinessUnitId = (req: any, res: any): string | null => {
  const businessUnitId = typeof req.query?.businessUnitId === 'string' ? req.query.businessUnitId : '';
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

router.get("/", isAuthenticated, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;
    const businessUnitId = getScopedBusinessUnitId(req, res);
    if (!businessUnitId) return;

    const sales = await storage.getSales();
    let filteredSales = sales;

    filteredSales = sales.filter((sale: any) => (sale?.businessUnitId || null) === businessUnitId);

    if (date) {
      filteredSales = filteredSales.filter((sale: any) => new Date(sale.timestamp).toISOString().split('T')[0] === date);
    } else if (startDate && endDate) {
      filteredSales = filteredSales.filter((sale: any) => {
        const saleDate = new Date(sale.timestamp).toISOString().split('T')[0];
        return saleDate >= (startDate as string) && saleDate <= (endDate as string);
      });
    }
    filteredSales.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(filteredSales);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

router.get("/:id", isAuthenticated, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const businessUnitId = getScopedBusinessUnitId(req, res);
    if (!businessUnitId) return;

    const sale = await storage.getSale(req.params.id);
    if (!sale) return res.status(404).json({ error: "Sale not found" });

    if ((sale as any)?.businessUnitId !== businessUnitId) {
      return res.status(404).json({ error: "Sale not found" });
    }

    res.json(sale);
  } catch (error) {
    console.error("Error fetching sale:", error);
    res.status(500).json({ error: "Failed to fetch sale" });
  }
});

// POST /api/sales - Non-Blocking Sale Creation with Fail-Safe Shift Update
router.post("/", isAuthenticated, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    // Helper function to ensure numbers are valid
    const safeNumber = (value: any): number => {
      const num = typeof value === 'number' ? value : parseFloat(value);
      return !isNaN(num) && isFinite(num) ? num : 0;
    };

    // Step 1: Validate that a shift is active (for the current authenticated user)
    const currentShift = await storage.getCurrentShift(req.user?.id);
    if (!currentShift.isActive || !currentShift.attendanceId) {
      return res.status(400).json({
        error: "No active shift found. Please open a shift before making sales."
      });
    }

    // Step 2: Ensure business_unit_id is included and validate against active shift
    const businessUnitId = req.body?.businessUnitId || req.user?.businessUnitId || currentShift.businessUnitId;
    if (!businessUnitId) {
      return res.status(400).json({
        error: "Business unit ID is required for sales."
      });
    }

    // CRITICAL VALIDATION: Ensure businessUnitId matches active shift's business unit
    if (currentShift.businessUnitId && businessUnitId !== currentShift.businessUnitId) {
      return res.status(400).json({
        error: `Business unit mismatch. Sale business unit (${businessUnitId}) does not match active shift business unit (${currentShift.businessUnitId}). Please switch to the correct store or close current shift.`,
        saleBusinessUnit: businessUnitId,
        shiftBusinessUnit: currentShift.businessUnitId
      });
    }

    const normalizedBody = {
      ...(req.body || {}),
      businessUnitId,
      // Provide defaults so the frontend can send a minimal payload
      subtotal: req.body?.subtotal ?? req.body?.total ?? 0,
      tax: req.body?.tax ?? 0,
      discount: req.body?.discount ?? 0,
      paymentStatus: req.body?.paymentStatus ?? 'paid',
      timestamp: req.body?.timestamp ?? new Date().toISOString(),
    };

    // Step 3: Validate sale data
    const parsed = saleSchema.omit({ id: true }).safeParse(normalizedBody);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid sale data",
        details: parsed.error.errors
      });
    }

    const saleData = parsed.data;

    // Step 4: Sanitize all monetary values to prevent NaN issues
    const sanitizedSale = {
      ...saleData,
      businessUnitId,
      total: safeNumber(saleData.total),
      subtotal: safeNumber(saleData.subtotal),
      tax: safeNumber(saleData.tax),
      discount: safeNumber(saleData.discount),
    };

    // Step 4: Record the sale in the database (CRITICAL - Must succeed)
    const createdSale = await storage.createSale(sanitizedSale);

    // Step 5: Update Shift Totals (NON-BLOCKING / FAIL-SAFE)
    // This must NOT prevent the voucher from being printed
    try {
      // Fetch current attendance record to get existing totals
      const allAttendance = await storage.getAttendance();
      const currentAttendance = allAttendance.find(a => a.id === currentShift.attendanceId);

      if (!currentAttendance) {
        console.error("[SHIFT-UPDATE-WARN] Sale created but attendance record not found:", currentShift.attendanceId);
      } else {
        // Calculate new totals based on payment method
        const saleTotal = safeNumber(sanitizedSale.total);
        const currentTotalSales = safeNumber(currentAttendance.totalSales);
        const currentCashSales = safeNumber(currentAttendance.cashSales);
        const currentCardSales = safeNumber(currentAttendance.cardSales);
        const currentCreditSales = safeNumber(currentAttendance.creditSales);
        const currentMobileSales = safeNumber(currentAttendance.mobileSales);

        // Determine which payment type to increment
        const updates: Partial<Attendance> = {
          totalSales: currentTotalSales + saleTotal,
        };

        switch (sanitizedSale.paymentMethod) {
          case 'cash':
            updates.cashSales = currentCashSales + saleTotal;
            break;
          case 'card':
            updates.cardSales = currentCardSales + saleTotal;
            break;
          case 'credit':
            updates.creditSales = currentCreditSales + saleTotal;
            break;
          case 'mobile':
            updates.mobileSales = currentMobileSales + saleTotal;
            break;
        }

        // Update the attendance record with new totals
        const updatedAttendance = await storage.updateAttendance(
          currentShift.attendanceId,
          updates
        );

        if (!updatedAttendance) {
          console.error("[SHIFT-UPDATE-WARN] Failed to update shift totals for sale:", createdSale.id);
        } else {
          console.log(`[SHIFT-UPDATE-OK] Sale ${createdSale.id}: Updated shift totals - Total: ${updates.totalSales}, Payment: ${sanitizedSale.paymentMethod}`);
        }
      }
    } catch (updateError) {
      // CRITICAL: Log error but DO NOT crash the request
      // The voucher must still be printed
      console.error("[SHIFT-UPDATE-ERROR] Failed to update shift totals (sale still recorded):", updateError);
    }

    // Step 6: ALWAYS return the sale to the frontend (for voucher printing)
    // CRITICAL FIX: Construct response explicitly to ensure 'items' is an Array, not a DB string
    // The database may return items as a JSON string, which crashes the frontend modal
    const responseData = {
      ...sanitizedSale,              // Use the original clean data (items is definitely an array here)
      id: createdSale.id,            // Include the generated ID from database
      timestamp: createdSale.timestamp || sanitizedSale.timestamp // Use confirmed timestamp
    };

    // DOUBLE CHECK: Ensure items is definitely an array (defense against DB serialization)
    if (typeof responseData.items === 'string') {
      try {
        responseData.items = JSON.parse(responseData.items);
        console.warn('[SALE-RESPONSE] Items was a string, parsed to array');
      } catch (parseError) {
        console.error('[SALE-RESPONSE] Failed to parse items string, using empty array:', parseError);
        responseData.items = []; // Fallback to prevent frontend crash
      }
    }

    console.log('[SALE-RESPONSE] Sending response with items array of length:', Array.isArray(responseData.items) ? responseData.items.length : 'NOT AN ARRAY');
    res.status(201).json(responseData);
  } catch (error) {
    console.error("[SALE-CREATE-ERROR] Fatal error creating sale:", error);
    res.status(500).json({ error: "Failed to create sale" });
  }
});

// POST /api/sales/complete - Legacy endpoint with Fail-Safe Shift Update
router.post("/complete", async (req, res) => {
  try {
    console.log('[SALE-COMPLETE] Starting sale completion...');

    const currentShift = await storage.getCurrentShift();
    const businessUnitId = req.body?.businessUnitId || currentShift?.businessUnitId;
    if (!businessUnitId) {
      return res.status(400).json({ error: "Business unit ID is required for sales." });
    }

    const normalizedBody = {
      ...(req.body || {}),
      businessUnitId,
      subtotal: req.body?.subtotal ?? req.body?.total ?? 0,
      tax: req.body?.tax ?? 0,
      discount: req.body?.discount ?? 0,
      paymentStatus: req.body?.paymentStatus ?? 'paid',
      timestamp: req.body?.timestamp ?? new Date().toISOString(),
    };

    const parsed = saleSchema.omit({ id: true }).safeParse(normalizedBody);
    if (!parsed.success) {
      console.error('[SALE-COMPLETE] Validation failed:', parsed.error.errors);
      return res.status(400).json({ error: "Invalid sale data", details: parsed.error.errors });
    }

    console.log('[SALE-COMPLETE] Calling storage.createSale...');
    const sale = await storage.createSale(parsed.data);
    console.log('[SALE-COMPLETE] Sale created:', sale.id);

    // Try to update shift totals (NON-BLOCKING / FAIL-SAFE)
    try {
      const currentShift = await storage.getCurrentShift();
      if (currentShift && currentShift.isActive && currentShift.attendanceId) {
        const allAttendance = await storage.getAttendance();
        const currentAttendance = allAttendance.find(a => a.id === currentShift.attendanceId);

        if (currentAttendance) {
          const safeNumber = (value: any): number => {
            const num = typeof value === 'number' ? value : parseFloat(value);
            return !isNaN(num) && isFinite(num) ? num : 0;
          };

          const saleTotal = safeNumber(parsed.data.total);
          const currentTotalSales = safeNumber(currentAttendance.totalSales);
          const currentCashSales = safeNumber(currentAttendance.cashSales);
          const currentCardSales = safeNumber(currentAttendance.cardSales);
          const currentCreditSales = safeNumber(currentAttendance.creditSales);
          const currentMobileSales = safeNumber(currentAttendance.mobileSales);

          const updates: Partial<Attendance> = {
            totalSales: currentTotalSales + saleTotal,
          };

          switch (parsed.data.paymentMethod) {
            case 'cash':
              updates.cashSales = currentCashSales + saleTotal;
              break;
            case 'card':
              updates.cardSales = currentCardSales + saleTotal;
              break;
            case 'credit':
              updates.creditSales = currentCreditSales + saleTotal;
              break;
            case 'mobile':
              updates.mobileSales = currentMobileSales + saleTotal;
              break;
          }

          await storage.updateAttendance(currentShift.attendanceId, updates);
          console.log('[SALE-COMPLETE] Shift totals updated successfully');
        }
      } else {
        console.warn('[SALE-COMPLETE] No active shift found, skipping shift update');
      }
    } catch (shiftError) {
      console.error('[SALE-COMPLETE] Shift update failed (non-blocking):', shiftError);
    }

    // ALWAYS return success response
    console.log('[SALE-COMPLETE] Returning success response with sale ID:', sale.id);
    res.status(201).json({ id: sale.id, success: true });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[SALE-COMPLETE] Error:", err.message);
    res.status(500).json({ error: err.message || "Failed to complete sale." });
  }
});

export default router;
