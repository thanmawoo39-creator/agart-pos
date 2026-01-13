import { Router } from "express";
import { storage } from "../storage";

const router = Router();

router.get("/credit-sales", async (_req, res) => {
    try {
        const ledger = await storage.getCreditLedger();
        const sales = await storage.getSales();
        const saleById = new Map(sales.map((s) => [s.id, s]));

        const enriched = ledger.map((entry) => {
            const sale = entry.saleId ? saleById.get(entry.saleId) : undefined;
            return {
                ...entry,
                saleItems: sale?.items,
            };
        });

        res.json(enriched);
    } catch (error) {
        console.error("Error fetching credit sales ledger:", error);
        res.status(500).json({ error: "Failed to fetch credit sales" });
    }
});

export default router;
