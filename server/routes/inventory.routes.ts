import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated, requireRole } from "../middleware/auth";

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Inventory
 *     description: Inventory and stock operations
 */

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
    /**
     * @openapi
     * /api/inventory/logs:
     *   get:
     *     tags: [Inventory]
     *     summary: List inventory logs
     *     responses:
     *       200:
     *         description: Array of inventory logs
     */
    try {
        res.json(await storage.getInventoryLogs());
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch inventory logs" });
    }
});

router.get("/logs/:productId", isAuthenticated, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
    /**
     * @openapi
     * /api/inventory/logs/{productId}:
     *   get:
     *     tags: [Inventory]
     *     summary: List inventory logs by product
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Array of inventory logs
     */
    try {
        res.json(await storage.getInventoryLogsByProduct(req.params.productId));
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch inventory logs" });
    }
});

router.post("/adjust/:productId", isAuthenticated, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
    /**
     * @openapi
     * /api/inventory/adjust/{productId}:
     *   post:
     *     tags: [Inventory]
     *     summary: Adjust stock for a product
     *     parameters:
     *       - in: path
     *         name: productId
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
     *         description: Updated product and log
     *       400:
     *         description: Invalid request
     */
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
        const message = error instanceof Error ? error.message : "Failed to adjust stock";
        if (message.startsWith('Insufficient stock')) {
            return res.status(400).json({ error: message });
        }
        res.status(500).json({ error: message });
    }
});

export default router;
