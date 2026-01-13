import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireRole } from "../middleware/auth";

const router = Router();

const getScopedBusinessUnitId = (req: any, res: any): string | null => {
    const requested = typeof req.query?.businessUnitId === "string" ? req.query.businessUnitId : "";
    const businessUnitId = requested || req.user?.businessUnitId || "";
    if (!businessUnitId) {
        res.status(400).json({ error: "businessUnitId is required" });
        return null;
    }

    const userBusinessUnitId = req.user?.businessUnitId;
    const userRole = req.user?.role;
    if (userRole !== "owner") {
        if (!userBusinessUnitId) {
            res.status(403).json({ error: "User has no assigned business unit" });
            return null;
        }
        if (businessUnitId !== userBusinessUnitId) {
            res.status(403).json({ error: "Business unit mismatch" });
            return null;
        }
    }

    return businessUnitId;
};

router.get("/", isAuthenticated, requireRole('kitchen'), async (req, res) => {
    try {
        const businessUnitId = getScopedBusinessUnitId(req, res);
        if (!businessUnitId) return;

        // Kitchen context: only show tickets created during the currently active shift (clear view after shift close)
        const allAttendance = await storage.getAttendance();
        const activeForUnit = allAttendance
            .filter((att: any) => (att.clockOutTime === "" || att.clockOutTime === null) && att.businessUnitId === businessUnitId)
            .sort((a: any, b: any) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime())[0];

        if (!activeForUnit?.clockInTime) {
            return res.json([]);
        }

        const tickets = await storage.getKitchenTickets(businessUnitId);
        const shiftStart = new Date(activeForUnit.clockInTime).getTime();
        const filtered = tickets.filter((t: any) => {
            const created = t?.createdAt ? new Date(t.createdAt).getTime() : 0;
            return created >= shiftStart;
        });

        res.json(filtered);
    } catch (error) {
        console.error("Error fetching kitchen tickets:", error);
        res.status(500).json({ error: "Failed to fetch kitchen tickets" });
    }
});

router.post("/table/:tableId", isAuthenticated, async (req, res) => {
    try {
        const businessUnitId = getScopedBusinessUnitId(req, res);
        if (!businessUnitId) return;

        const tableId = req.params.tableId;
        const items = typeof req.body?.items === "string" ? req.body.items : null;
        const tableNumber = typeof req.body?.tableNumber === "string" ? req.body.tableNumber : null;

        const ticket = await storage.createOrUpdateKitchenTicketForTable({
            businessUnitId,
            tableId,
            tableNumber,
            items,
        });

        res.json(ticket);
    } catch (error) {
        console.error("Error creating kitchen ticket:", error);
        res.status(500).json({ error: "Failed to create kitchen ticket" });
    }
});

router.patch("/:id/status", isAuthenticated, async (req, res) => {
    try {
        const businessUnitId = getScopedBusinessUnitId(req, res);
        if (!businessUnitId) return;

        const status = req.body?.status;
        if (
            status !== "in_preparation" &&
            status !== "ready" &&
            status !== "served" &&
            status !== "cancelled"
        ) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const existing = await storage.getKitchenTickets(businessUnitId);
        const ticket = existing.find((t: any) => t.id === req.params.id);
        if (!ticket) {
            return res.status(404).json({ error: "Kitchen ticket not found" });
        }

        const updated = await storage.updateKitchenTicketStatus(req.params.id, status);
        res.json(updated);
    } catch (error) {
        console.error("Error updating kitchen ticket status:", error);
        res.status(500).json({ error: "Failed to update kitchen ticket status" });
    }
});

export default router;
