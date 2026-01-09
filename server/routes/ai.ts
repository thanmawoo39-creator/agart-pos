import { type Request, type Response, Router } from 'express';
import { storage } from '../storage';
import { identifyGroceryItem } from '../lib/gemini';
import { type Product } from '@shared/schema';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.post('/recognize', upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  try {
    const result = await identifyGroceryItem(req.file.buffer, req.file.mimetype);
    const items = result.success && result.data && result.data.name ? [result.data.name] : [];
    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to recognize image' });
  }
});

router.post('/identify-item', async (req, res, next) => {
  try {
    if (!req.rawBody) {
      return res.status(400).json({ error: 'Image data not received' });
    }
    const products: Product[] = await storage.getProducts();
    const result = await identifyGroceryItem(req.rawBody as Buffer, 'image/jpeg');
    const { name, category } = result.success && result.data ? result.data : { name: null, category: null };
    if (name === null) {
      return res.status(404).json({ error: 'Could not identify item' });
    }
    const matched = products.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (matched) {
      return res.json(matched);
    }
    return res.status(200).json({ name, category });
  } catch (err) {
    next(err);
  }
});

router.post('/analyze-expense', upload.single('image'), async (req: Request, res: Response) => {
  // Set content type to JSON to prevent HTML responses
  res.setHeader('Content-Type', 'application/json');
  
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  try {
    if (req.file && req.file.buffer) {
      console.log('Analyzing expense receipt, file size:', req.file.buffer.length);
    }
    const result = await identifyGroceryItem(req.file?.buffer, req.file?.mimetype);
    const analysis = {
      category: result.data?.category || 'Other',
      estimatedAmount: result.data?.estimatedPrice || null,
      summary: result.success ? `Identified: ${result.data.name}` : 'Could not analyze receipt',
      warnings: result.warnings || [],
    };
    console.log('Analysis completed:', analysis);
    res.json(analysis);
  } catch (error) {
    console.error('Error in analyze-expense route:', error);
    // Always return a 200 with default values to prevent frontend crashes
    const defaultResponse = {
      category: "Other",
      estimatedAmount: null,
      summary: "Unable to analyze receipt - service unavailable",
      error: (error as Error).message || 'Unknown error occurred'
    };
    res.status(200).json(defaultResponse);
  }
});

export default router;