import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../middleware/auth";

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Shifts
 *     description: Shift/attendance operations
 */

router.get("/current", isAuthenticated, async (req, res) => {
    /**
     * @openapi
     * /api/shifts/current:
     *   get:
     *     tags: [Shifts]
     *     summary: Get current shift for logged-in staff
     *     responses:
     *       200:
     *         description: Current shift or null
     */
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const currentShift = await storage.getCurrentShift(req.user.id);

        if (currentShift && currentShift.isActive && currentShift.attendanceId) {
            const allAttendance = await storage.getAttendance();
            const fullAttendance = allAttendance.find((a) => a.id === currentShift.attendanceId);

            if (!fullAttendance) {
                return res.status(404).json({ error: "Attendance record not found" });
            }

            const safeNumber = (value: any): number => {
                const num = typeof value === "number" ? value : parseFloat(value);
                return !isNaN(num) && isFinite(num) ? num : 0;
            };

            const mappedShift = {
                ...currentShift,
                startTime: currentShift.clockInTime,
                shiftId: currentShift.attendanceId,
                isOpen: true,
                status: "open" as const,
                isActive: true,
                openingCash: safeNumber(fullAttendance.openingCash),
                totalSales: safeNumber(fullAttendance.totalSales),
                cashSales: safeNumber(fullAttendance.cashSales),
                cardSales: safeNumber(fullAttendance.cardSales),
                creditSales: safeNumber(fullAttendance.creditSales),
                mobileSales: safeNumber(fullAttendance.mobileSales),
                expectedCash: safeNumber(fullAttendance.openingCash) + safeNumber(fullAttendance.cashSales),
                actualCash: safeNumber(fullAttendance.openingCash) + safeNumber(fullAttendance.cashSales),
            };

            res.json(mappedShift);
        } else {
            res.json(null);
        }
    } catch (error) {
        console.error("Get current shift error:", error);
        res.status(500).json({ error: "Failed to fetch current shift" });
    }
});

router.post("/", isAuthenticated, async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const currentShift = await storage.getCurrentShift(req.user.id);
        if (currentShift.isActive) {
            return res.status(400).json({ error: `A shift is already open by ${currentShift.staffName}.` });
        }

        const startingCashRaw = req.body?.startingCash;
        const startingCash = typeof startingCashRaw === "number" ? startingCashRaw : parseFloat(startingCashRaw);
        const sanitizedStartingCash = !isNaN(startingCash) && isFinite(startingCash) ? startingCash : 0;

        const staffRecord = await storage.getStaffById(req.user.id);
        const businessUnitId = req.user?.businessUnitId || staffRecord?.businessUnitId;
        if (!businessUnitId) {
            return res.status(400).json({ error: "Business unit ID is required to open a shift." });
        }

        const newShift = await storage.clockIn(req.user.id, req.user.name, sanitizedStartingCash, businessUnitId);

        res.json({
            ...newShift,
            startTime: newShift.clockInTime,
            shiftId: newShift.id,
            isOpen: true,
            status: "open",
            isActive: true,
            expectedCash: sanitizedStartingCash,
            actualCash: sanitizedStartingCash,
        });
    } catch (error) {
        console.error("Start shift error:", error);
        res.status(500).json({ error: "Failed to start shift" });
    }
});

router.put("/:id", isAuthenticated, async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const shiftId = req.params.id;
        if (!shiftId) {
            return res.status(400).json({ error: "Shift ID is required" });
        }

        const endingCashRaw = req.body?.endingCash;
        const endingCashParsed = typeof endingCashRaw === "number" ? endingCashRaw : parseFloat(endingCashRaw);
        const endingCash = !isNaN(endingCashParsed) && isFinite(endingCashParsed) ? endingCashParsed : 0;

        const shiftToClose = await storage.getAttendanceById(shiftId);
        if (!shiftToClose) {
            return res.status(404).json({ error: "No active shift found." });
        }

        const role = (req.user as any)?.role;
        if (role !== "owner" && role !== "manager" && req.user.id !== shiftToClose.staffId) {
            return res.status(403).json({ error: "You can only close your own shift." });
        }

        const result = await storage.clockOut(shiftId);
        if (!result) {
            return res.status(500).json({ error: "Failed to close shift record." });
        }

        try {
            const businessUnitId = (shiftToClose as any)?.businessUnitId || req.user?.businessUnitId;
            if (businessUnitId) {
                const allTables = await storage.getTables();
                const scopedTables = allTables.filter((t: any) => t.businessUnitId === businessUnitId);

                await Promise.all(
                    scopedTables.map(async (t: any) => {
                        await storage.updateTableStatus(t.id, "available");
                        await storage.updateTableOrder(t.id, null);
                    })
                );
            }
        } catch (cleanupError) {
            console.error("Shift close table cleanup failed:", cleanupError);
        }

        res.json({
            ...result,
            endTime: result.clockOutTime || new Date().toISOString(),
            endingCash,
            isOpen: false,
            status: "closed",
            isActive: false,
        });
    } catch (error) {
        console.error("End shift error:", error);
        res.status(500).json({ error: "Failed to end shift" });
    }
});

router.post("/open", isAuthenticated, async (req, res) => {
    /**
     * @openapi
     * /api/shifts/open:
     *   post:
     *     tags: [Shifts]
     *     summary: Open a shift
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *     responses:
     *       200:
     *         description: Shift opened
     */
    try {
        const { staffId, staffName, openingCash } = req.body;

        const currentShift = await storage.getCurrentShift(staffId);
        if (currentShift.isActive) {
            return res.status(400).json({ error: `A shift is already open by ${currentShift.staffName}.` });
        }

        const sanitizedOpeningCash =
            typeof openingCash === "number" && !isNaN(openingCash) && isFinite(openingCash)
                ? openingCash
                : 0;

        const staff = await storage.getStaffById(staffId);
        const businessUnitId = req.body?.businessUnitId || req.user?.businessUnitId || staff?.businessUnitId;
        if (!businessUnitId) {
            return res.status(400).json({ error: "Business unit ID is required to open a shift." });
        }

        const newShift = await storage.clockIn(staffId, staffName, sanitizedOpeningCash, businessUnitId);

        res.json({
            ...newShift,
            startTime: newShift.clockInTime,
            shiftId: newShift.id,
            isOpen: true,
            status: "open",
            isActive: true,
            expectedCash: sanitizedOpeningCash,
            actualCash: sanitizedOpeningCash,
        });
    } catch (error) {
        console.error("Open shift error:", error);
        res.status(500).json({ error: "Failed to open shift" });
    }
});

router.post("/close", isAuthenticated, async (req, res) => {
    /**
     * @openapi
     * /api/shifts/close:
     *   post:
     *     tags: [Shifts]
     *     summary: Close a shift
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *     responses:
     *       200:
     *         description: Shift closed
     */
    try {
        const { shiftId } = req.body;

        if (!req.user?.id) {
            return res.status(401).json({ error: "User session incomplete - missing user ID." });
        }

        const allAttendance = await storage.getAttendance();
        const openForUser = allAttendance
            .filter((att) => (att.clockOutTime === "" || att.clockOutTime === null) && att.staffId === req.user!.id)
            .sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime());

        const activeShift =
            shiftId && shiftId !== "force-close" ? openForUser.find((att) => att.id === shiftId) : openForUser[0];

        const activeShiftFallback =
            !activeShift && shiftId && shiftId !== "force-close"
                ? allAttendance
                    .filter((att) => (att.clockOutTime === "" || att.clockOutTime === null) && att.staffId === req.user!.id)
                    .find((att) => att.id === shiftId)
                : null;

        if (!activeShift && !activeShiftFallback) {
            return res.status(404).json({ error: "No active shift found." });
        }

        const shiftToClose = activeShift || activeShiftFallback;

        const role = (req.user as any)?.role;
        if (role !== "owner" && role !== "manager" && req.user.id !== shiftToClose!.staffId) {
            return res.status(403).json({ error: "You can only close your own shift." });
        }

        const result = await storage.clockOut(shiftToClose!.id);

        if (!result) {
            return res.status(500).json({ error: "Failed to close shift record." });
        }

        // Shift-end cleanup: reset all tables for this business unit to available and clear current order
        try {
            const businessUnitId = (shiftToClose as any)?.businessUnitId || req.user?.businessUnitId;
            if (businessUnitId) {
                const allTables = await storage.getTables();
                const scopedTables = allTables.filter((t: any) => t.businessUnitId === businessUnitId);

                await Promise.all(
                    scopedTables.map(async (t: any) => {
                        await storage.updateTableStatus(t.id, "available");
                        await storage.updateTableOrder(t.id, null);
                    })
                );
            }
        } catch (cleanupError) {
            console.error("Shift close table cleanup failed:", cleanupError);
        }

        res.json(result);
    } catch (error) {
        console.error("Close shift error:", error);
        res.status(500).json({ error: "Failed to close shift" });
    }
});

router.get("/history", async (_req, res) => {
    try {
        const history = await storage.getAttendance();
        history.sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime());

        const safeNumber = (value: any): number => {
            const num = typeof value === "number" ? value : parseFloat(value);
            return !isNaN(num) && isFinite(num) ? num : 0;
        };

        const historyForFrontend = history.map((shift) => ({
            ...shift,
            startTime: shift.clockInTime,
            openingCash: safeNumber(shift.openingCash),
            totalSales: safeNumber(shift.totalSales),
            cashSales: safeNumber(shift.cashSales),
            cardSales: safeNumber(shift.cardSales),
            creditSales: safeNumber(shift.creditSales),
            mobileSales: safeNumber(shift.mobileSales),
        }));

        res.json(historyForFrontend);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch shift history" });
    }
});

router.get("/", async (_req, res) => {
    try {
        const allShifts = await storage.getAttendance();

        const activeShifts = allShifts.filter((s) => !s.clockOutTime);

        const safeNumber = (value: any): number => {
            const num = typeof value === "number" ? value : parseFloat(value);
            return !isNaN(num) && isFinite(num) ? num : 0;
        };

        const mappedActive = activeShifts.map((s) => ({
            ...s,
            startTime: s.clockInTime,
            openingCash: safeNumber(s.openingCash),
            totalSales: safeNumber(s.totalSales),
            cashSales: safeNumber(s.cashSales),
            cardSales: safeNumber(s.cardSales),
            creditSales: safeNumber(s.creditSales),
            mobileSales: safeNumber(s.mobileSales),
            isActive: true,
        }));

        res.json(mappedActive);
    } catch (error) {
        console.error("Get all shifts error:", error);
        res.status(500).json({ error: "Failed to fetch active shifts" });
    }
});

export default router;
