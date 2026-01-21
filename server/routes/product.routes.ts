import { Router } from "express";
import { storage } from "../storage";
import { productSchema } from "../../shared/schema";
import { isAuthenticated, requireAdmin, requireManager, requireRole } from '../middleware/auth';
import { cache, CACHE_KEYS, CACHE_TTL } from '../lib/cache';
import { translateToBurmese } from '../lib/gemini';
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

router.get("/", isAuthenticated, requireRole('owner', 'manager', 'cashier', 'waiter'), async (req, res) => {
  try {
    // Use cache for products list - significantly reduces DB queries
    const products = await cache.getOrFetch(
      CACHE_KEYS.PRODUCTS,
      () => storage.getProducts(),
      CACHE_TTL.MEDIUM // 1 minute cache
    );

    const requestedBusinessUnitId = typeof req.query.businessUnitId === 'string' ? req.query.businessUnitId : null;
    const userBusinessUnitId = req.user?.businessUnitId || null;
    const userRole = (req.user as any)?.role;

    if (
      requestedBusinessUnitId &&
      userBusinessUnitId &&
      requestedBusinessUnitId !== userBusinessUnitId &&
      userRole !== 'owner'
    ) {
      return res.status(403).json({ error: 'Business unit access denied' });
    }

    const effectiveBusinessUnitId = requestedBusinessUnitId || userBusinessUnitId || null;

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

router.get("/:id", isAuthenticated, requireRole('owner', 'manager', 'cashier', 'waiter'), async (req, res) => {
  try {
    const product = await storage.getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const userBusinessUnitId = req.user?.businessUnitId || null;
    const userRole = (req.user as any)?.role;
    if (userRole !== 'owner' && userBusinessUnitId && (product as any).businessUnitId !== userBusinessUnitId) {
      return res.status(403).json({ error: 'Business unit access denied' });
    }

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

    const requestedBusinessUnitId = req.body?.businessUnitId || null;
    const userBusinessUnitId = req.user?.businessUnitId || null;
    const userRole = (req.user as any)?.role;

    if (
      requestedBusinessUnitId &&
      userBusinessUnitId &&
      requestedBusinessUnitId !== userBusinessUnitId &&
      userRole !== 'owner'
    ) {
      return res.status(403).json({ error: 'Business unit access denied' });
    }

    const effectiveBusinessUnitId = requestedBusinessUnitId || userBusinessUnitId || null;
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

    // Auto-translate product name to Burmese (only on creation to save API tokens)
    // Translation happens asynchronously but we wait for it to complete
    if (productData.name && !productData.translatedName) {
      try {
        const burmeseTranslation = await translateToBurmese(productData.name);
        productData.translatedName = burmeseTranslation;
        console.log(`[Product Create] Translated "${productData.name}" → "${burmeseTranslation}"`);
      } catch (translationError) {
        // Non-blocking: if translation fails, continue without it
        console.warn('[Product Create] Translation failed, continuing without:', translationError);
      }
    }

    const product = await storage.createProduct(productData);

    // Invalidate products cache after creation
    cache.invalidate(CACHE_KEYS.PRODUCTS);

    res.status(201).json(product);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.patch("/:id", isAuthenticated, requireManager, upload.single('image'), async (req, res) => {
  try {
    const existing = await storage.getProduct(req.params.id);
    if (!existing) return res.status(404).json({ error: "Product not found" });

    const userBusinessUnitId = req.user?.businessUnitId || null;
    const userRole = (req.user as any)?.role;

    if (userRole !== 'owner' && userBusinessUnitId && (existing as any).businessUnitId !== userBusinessUnitId) {
      return res.status(403).json({ error: 'Business unit access denied' });
    }

    const updateData: any = { ...req.body };
    if (req.body.price) updateData.price = parseFloat(req.body.price);
    if (req.body.stock) updateData.stock = parseInt(req.body.stock, 10);
    if (req.body.cost) updateData.cost = parseFloat(req.body.cost);

    const requestedBusinessUnitId = updateData?.businessUnitId || null;
    if (
      requestedBusinessUnitId &&
      userRole !== 'owner' &&
      userBusinessUnitId &&
      requestedBusinessUnitId !== userBusinessUnitId
    ) {
      return res.status(403).json({ error: 'Business unit access denied' });
    }

    // Never allow moving a product between business units via update
    if (typeof updateData.businessUnitId !== 'undefined') {
      delete updateData.businessUnitId;
    }

    if (req.file) updateData.imageUrl = req.file.filename;

    // Auto-translate if name changed (optimization: only translate when name is updated)
    // This saves API tokens by not re-translating unchanged names
    if (updateData.name && updateData.name !== existing.name) {
      try {
        const burmeseTranslation = await translateToBurmese(updateData.name);
        updateData.translatedName = burmeseTranslation;
        console.log(`[Product Update] Translated "${updateData.name}" → "${burmeseTranslation}"`);
      } catch (translationError) {
        // Non-blocking: if translation fails, continue without updating translation
        console.warn('[Product Update] Translation failed, keeping existing:', translationError);
      }
    }

    const product = await storage.updateProduct(req.params.id, updateData);
    if (!product) return res.status(404).json({ error: "Product not found" });

    // Invalidate products cache after update
    cache.invalidate(CACHE_KEYS.PRODUCTS);

    res.json(product);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/:id", isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const existing = await storage.getProduct(req.params.id);
    if (!existing) return res.status(404).json({ error: "Product not found" });

    const userBusinessUnitId = req.user?.businessUnitId || null;
    const userRole = (req.user as any)?.role;
    if (userRole !== 'owner' && userBusinessUnitId && (existing as any).businessUnitId !== userBusinessUnitId) {
      return res.status(403).json({ error: 'Business unit access denied' });
    }

    const deleted = await storage.deleteProduct(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Product not found" });

    // Invalidate products cache after deletion
    cache.invalidate(CACHE_KEYS.PRODUCTS);

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;
