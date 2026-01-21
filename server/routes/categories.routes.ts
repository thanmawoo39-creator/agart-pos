import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireRole } from '../middleware/auth';
import { z } from "zod";

const router = Router();

// Schema for category creation
const createCategorySchema = z.object({
    name: z.string().min(1, "Category name is required"),
    businessUnitId: z.string().min(1, "Business unit ID is required"),
});

// Get all categories for a business unit
router.get("/", isAuthenticated, requireRole('owner', 'manager', 'cashier', 'waiter'), async (req, res) => {
    try {
        const businessUnitId = req.query.businessUnitId as string || req.user?.businessUnitId;

        if (!businessUnitId) {
            return res.status(400).json({ error: "Business unit ID is required" });
        }

        // Since categories are stored as text field in products, extract unique categories
        const products = await storage.getProducts();
        const categories = Array.from(
            new Set(
                products
                    .filter(p => p.businessUnitId === businessUnitId && p.category)
                    .map(p => p.category)
            )
        ).filter(Boolean);

        res.json(categories);
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ error: "Failed to fetch categories" });
    }
});

// Create a new category (for admin/manager use)
router.post("/", isAuthenticated, requireRole('owner', 'manager'), async (req, res) => {
    try {
        const parsed = createCategorySchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid category data", details: parsed.error.errors });
        }

        // Categories are just text fields in products, so we don't need to store them separately
        // This endpoint is mainly for consistency with the frontend expectations
        res.status(201).json(parsed.data);
    } catch (error) {
        console.error("Error creating category:", error);
        res.status(500).json({ error: "Failed to create category" });
    }
});

export default router;
