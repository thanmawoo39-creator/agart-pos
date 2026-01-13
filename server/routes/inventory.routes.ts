import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated, requireRole } from "../middleware/auth";

const router = Router();

const stockAdjustmentSchema = z
    .object({
        quantityChanged: z.number().int().optional(),
        quantityChange: z.number().int().optional(),
        type: z.enum(["stock-in", "adjustment"]),
        reason: z.string().min(1, "Reason is required"),
        staffId: z.string().optional(),
        staffName: z.string().optional(),
    })
    .refine((data) => typeof (data.quantityChanged ?? data.quantityChange) === "number", {
        message: "quantityChange is required",
        path: ["quantityChange"],
    });

router.get("/logs", isAuthenticated, requireRole('owner', 'manager', 'cashier'), async (_req, res) => {
    try {
        res.json(await storage.getInventoryLogs());
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch inventory logs" });
    }
});

router.get("/logs/:productId", isAuthenticated, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
    try {
        res.json(await storage.getInventoryLogsByProduct(req.params.productId));
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch inventory logs" });
    }
});

router.post("/adjust/:productId", isAuthenticated, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
    try {
        const parsed = stockAdjustmentSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
        }

        const quantityChanged = parsed.data.quantityChanged ?? parsed.data.quantityChange;
        if (typeof quantityChanged !== "number") {
            return res.status(400).json({ error: "quantityChange is required" });
        }
        const { type, reason, staffId, staffName } = parsed.data;

        const result = await storage.adjustStock(
            req.params.productId,
            quantityChanged,
            type,
            staffId,
            staffName,
            reason
        );

        if (!result) return res.status(404).json({ error: "Product not found" });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: "Failed to adjust stock" });
    }
});

export default router;
