import { type Request, type Response, Router } from 'express';
import { storage } from '../storage';
import { verifyPaymentSlip } from '../lib/gemini';
import { callOllamaVisionAPI } from '../lib/local-ai';
import { type Product } from '@shared/schema';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.post('/recognize', upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  try {
    const prompt = `Analyze this grocery item image and identify the product's name. Provide a JSON response with "name" and "confidence_score". If not found, name should be "NOT_FOUND".`;
    const result = await callOllamaVisionAPI(req.file.buffer, prompt);


    if (!result.success || !result.data?.name) {
      return res.status(404).json({
        error: 'Could not identify item from image.',
        details: result.warnings || ['No name identified by AI.'],
      });
    }

    const returnedName = result.data.name;
    const products = await storage.getProducts();

    // More aggressive fuzzy matching logic
    const normalize = (str: string) => str.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedReturn = normalize(returnedName);

    const match = products.find(p => {
      const pName = normalize(p.name);
      return pName.includes(normalizedReturn) || normalizedReturn.includes(pName);
    });

    if (match) {
      return res.json(match);
    }

    // Log all product names if no match is found
    console.log('--- AI Match Failed ---');
    console.log('AI Output (Normalized):', normalizedReturn);
    console.log('Available Products (Normalized):');
    products.forEach(p => console.log(`- ${normalize(p.name)}`));
    console.log('--------------------');

    res.status(404).json({
      error: 'Product not found in inventory for the identified item.',
      details: [`Identified as "${returnedName}" but no match was found.`]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to recognize image due to a server error.' });
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
    const result = await verifyPaymentSlip(req.file.buffer, req.file.mimetype);
    const analysis = {
      category: 'Expense',
      estimatedAmount: result.amount || null,
      summary: result.success ? `Verified Payment: ${result.transactionId}` : 'Could not verify payment slip',
      warnings: result.warnings || [],
      isValid: result.isValid,
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

router.get('/insights', async (_req: Request, res: Response) => {
  // Placeholder for AI insights to stop frontend 404s
  res.json({
    summary: "AI Insights module is initializing...",
    trends: [],
    predictions: []
  });
});

export default router;