import { Router } from "express";
import { storage } from "../storage";
import { productSchema } from "../../shared/schema";
import { isAuthenticated, requireAdmin, requireManager, requireRole } from '../middleware/auth';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';

const storageConfig = multer.diskStorage({
  destination: async (req, file, cb) => {
    // FIX: Use process.cwd() for consistent path resolution
    const uploadPath = path.join(process.cwd(), 'public/uploads');
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedOriginalName}`);
  }
});

const upload = multer({ storage: storageConfig });

const router = Router();

router.get("/", isAuthenticated, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const products = await storage.getProducts();

    const requestedBusinessUnitId = typeof req.query.businessUnitId === 'string' ? req.query.businessUnitId : null;
    const effectiveBusinessUnitId = requestedBusinessUnitId || req.user?.businessUnitId || null;

    // Hybrid safety: without an effective business unit, do not return cross-store data
    if (!effectiveBusinessUnitId) {
      return res.json([]);
    }

    const filteredProducts = products.filter(product => product.businessUnitId === effectiveBusinessUnitId);

    res.json(filteredProducts);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/:id", isAuthenticated, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const product = await storage.getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

router.post("/", isAuthenticated, requireManager, upload.single('image'), async (req, res) => {
  try {
    // Manual parsing to handle FormData with proper null handling
    const body: any = {
      ...req.body,
      price: parseFloat(req.body.price),
      stock: req.body.stock ? parseInt(req.body.stock, 10) : 0,
      minStockLevel: req.body.minStockLevel ? parseInt(req.body.minStockLevel, 10) : 0,
    };

    const effectiveBusinessUnitId = req.body?.businessUnitId || req.user?.businessUnitId || null;
    if (!effectiveBusinessUnitId) {
      return res.status(400).json({ error: "Business unit ID is required for products." });
    }

    // Only include optional fields if they have values
    if (req.body.cost) body.cost = parseFloat(req.body.cost);
    if (req.body.barcode) body.barcode = req.body.barcode;
    if (req.body.category) body.category = req.body.category;
    if (req.body.imageData) body.imageData = req.body.imageData;
    if (req.body.unit) body.unit = req.body.unit;
    body.businessUnitId = effectiveBusinessUnitId;

    const parsed = productSchema.omit({ id: true }).safeParse(body);
    if (!parsed.success) {
      console.error("Product validation failed:", parsed.error.errors);
      return res.status(400).json({ error: "Invalid product data", details: parsed.error.errors });
    }

    const productData = parsed.data as any;
    if (req.file) productData.imageUrl = req.file.filename;

    const product = await storage.createProduct(productData);
    res.status(201).json(product);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.patch("/:id", upload.single('image'), async (req, res) => {
  try {
    const updateData: any = { ...req.body };
    if (req.body.price) updateData.price = parseFloat(req.body.price);
    if (req.body.stock) updateData.stock = parseInt(req.body.stock, 10);
    if (req.body.cost) updateData.cost = parseFloat(req.body.cost);

    if (req.file) updateData.imageUrl = req.file.filename;

    const product = await storage.updateProduct(req.params.id, updateData);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/:id", isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const deleted = await storage.deleteProduct(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Product not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;
