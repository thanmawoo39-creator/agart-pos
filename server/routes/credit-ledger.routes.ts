import { Router } from "express";
import { storage } from "../storage";
import { creditLedgerSchema } from "../../shared/schema";

const router = Router();

router.get("/", async (_req, res) => {
    try {
        res.json(await storage.getCreditLedger());
    } catch (error) {
        console.error("Error fetching credit ledger:", error);
        res.status(500).json({ error: "Failed to fetch credit ledger" });
    }
});

router.post("/", async (req, res) => {
    try {
        const parsed = creditLedgerSchema.omit({ id: true }).safeParse(req.body);
        if (!parsed.success) {
            return res
                .status(400)
                .json({ error: "Invalid credit ledger data", details: parsed.error.errors });
        }

        res.status(201).json(await storage.createCreditLedgerEntry(parsed.data));
    } catch (error) {
        console.error("Error creating credit ledger entry:", error);
        res.status(500).json({ error: "Failed to create credit ledger entry" });
    }
});

export default router;
