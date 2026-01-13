import { Router } from "express";
import { storage } from "../storage";

const router = Router();

router.get("/product/:barcode", async (req, res) => {
    try {
        const products = await storage.getProducts();
        const product = products.find((p) => p.barcode === req.params.barcode);
        if (!product) return res.status(404).json({ error: "Product not found" });
        res.json(product);
    } catch (error) {
        console.error("Error scanning product:", error);
        res.status(500).json({ error: "Failed to scan product" });
    }
});

router.get("/customer/:barcode", async (req, res) => {
    try {
        const customers = await storage.getCustomers();
        const customer = customers.find((c) => c.barcode === req.params.barcode);
        if (!customer) return res.status(404).json({ error: "Customer not found" });
        res.json(customer);
    } catch (error) {
        console.error("Error scanning customer:", error);
        res.status(500).json({ error: "Failed to scan customer" });
    }
});

export default router;
