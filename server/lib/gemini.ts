import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiAI, hasGeminiApiKey } from './gemini-config';
import { generateWithFailover, generateStreamingWithFailover } from './ai-failover';

// AI Result interface for consistent return types
export interface AIResult {
  success: boolean;
  data?: any;
  confidence_score?: number;
  raw?: string;
  amount?: number;
  transactionId?: string;
  warnings?: string[];
  isValid?: boolean;
}

// Helper function to prepare base64 image data for Gemini API
function prepareImageData(imageBuffer: Buffer, mimeType: string) {
  // Convert buffer to base64 (single operation, no re-encoding)
  const base64String = imageBuffer.toString('base64');

  // Log first 50 characters for debugging
  console.log('[Gemini Image Debug] Base64 preview:', base64String.substring(0, 50) + '...');
  console.log('[Gemini Image Debug] Buffer size:', imageBuffer.length, 'bytes');
  console.log('[Gemini Image Debug] MIME type:', mimeType);

  // Strip any potential data URI headers (e.g., "data:image/jpeg;base64,")
  // This ensures clean base64 data for the API
  const cleanBase64 = base64String.replace(/^data:image\/\w+;base64,/, '');

  // Verify we didn't accidentally strip valid data
  if (cleanBase64.length < base64String.length) {
    console.log('[Gemini Image Debug] Stripped data URI header');
  }

  return {
    inlineData: {
      data: cleanBase64,
      mimeType: mimeType || 'image/jpeg',
    },
  };
}

// Product identification from image
export async function identifyGroceryItem(imageBuffer: Buffer, mimeType: string): Promise<AIResult> {
  try {
    // Check if API key is configured
    if (!(await hasGeminiApiKey())) {
      return {
        success: false,
        raw: 'NULL',
        warnings: ['Gemini API key not configured. Please set it in Settings.']
      };
    }

    const genAI = await getGeminiAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    // Prepare optimized image data (no re-encoding, stripped headers)
    const imagePart = prepareImageData(imageBuffer, mimeType);

    const prompt = `Analyze this grocery item image and provide a JSON response with the following structure:
{
  "name": "exact product name",
  "category": "produce/dairy/bakery/meat/other",
  "estimated_price": 0.00,
  "confidence_score": 0.00,
  "raw": "raw response text"
}

Rules:
- If image shows a person, face, or non-grocery item, set raw to "NULL" and name to "NOT_FOUND"
- Be very specific with product names (e.g., "Red Apples" not just "Apples")
- Estimate realistic prices in MMK (Myanmar Kyat)
- Confidence score should be 0.0-1.0 based on clarity and match certainty
- Include the raw response text for debugging`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response.text();
    
    console.log('Gemini grocery identification response:', response);

    // Parse JSON response
    let parsed;
    try {
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return {
          success: false,
          raw: response,
          warnings: ['Invalid JSON response from Gemini']
        };
      }
    } catch (parseError) {
      return {
        success: false,
        raw: response,
        warnings: ['Failed to parse Gemini response']
      };
    }

    // Validate required fields
    if (!parsed.name || parsed.name === 'NOT_FOUND') {
      return {
        success: false,
        raw: parsed.raw || response,
        confidence_score: parsed.confidence_score || 0,
        warnings: ['Product not identified or not in inventory']
      };
    }

    return {
      success: true,
      data: {
        name: parsed.name,
        category: parsed.category,
        estimatedPrice: parsed.estimated_price
      },
      confidence_score: parsed.confidence_score || 0.8,
      raw: parsed.raw || response
    };

  } catch (error) {
    console.error('Gemini grocery identification error:', error);
    return {
      success: false,
      raw: error instanceof Error ? error.message : String(error),
      warnings: ['AI service error']
    };
  }
}

// Payment slip verification
export async function verifyPaymentSlip(imageBuffer: Buffer, mimeType: string): Promise<AIResult> {
  try {
    // Check if API key is configured
    if (!(await hasGeminiApiKey())) {
      return {
        success: false,
        warnings: ['Gemini API key not configured. Please set it in Settings.']
      };
    }

    const genAI = await getGeminiAI();
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    // Prepare optimized image data (no re-encoding, stripped headers)
    const imagePart = prepareImageData(imageBuffer, mimeType);

    const prompt = `Analyze this payment slip/bank transfer screenshot and extract information in JSON format:
{
  "isValid": true/false,
  "amount": 0.00,
  "transactionId": "transaction reference",
  "sender": "sender name",
  "date": "transaction date",
  "warnings": ["any concerns or issues"]
}

Rules:
- Set isValid to false if image is unclear, edited, or suspicious
- Extract exact amount numbers
- Look for transaction IDs or references
- Include any security concerns in warnings array
- If no payment slip detected, set isValid to false and explain in warnings`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response.text();
    
    console.log('Gemini payment verification response:', response);

    // Parse JSON response
    let parsed;
    try {
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return {
          success: false,
          warnings: ['Invalid JSON response from Gemini']
        };
      }
    } catch (parseError) {
      return {
        success: false,
        warnings: ['Failed to parse Gemini response']
      };
    }

    return {
      success: parsed.isValid || false,
      amount: parsed.amount,
      transactionId: parsed.transactionId,
      warnings: parsed.warnings || [],
      raw: response
    };

  } catch (error) {
    console.error('Gemini payment verification error:', error);
    return {
      success: false,
      warnings: ['AI service error during verification']
    };
  }
}

// Business insights and chat with structured context (with AI failover)
export async function askGeminiAboutBusiness(
  prompt: string,
  contextData: {
    todaySales: number;
    todayTransactionCount: number;
    lowStockItems: Array<{ name: string; stock: number; minStockLevel: number }>;
    topProducts: Array<{ name: string; totalQuantity: number; revenue: number }>;
    totalCustomers: number;
    creditOwed: number;
    todayExpenses: number;
    totalRevenue: number;
  }
): Promise<string> {
  // Build rich context string with actual data
  const lowStockWarning = contextData.lowStockItems.length > 0
    ? contextData.lowStockItems.map(item => `${item.name} (${item.stock}/${item.minStockLevel})`).join(', ')
    : 'None';

  const topProductsStr = contextData.topProducts.length > 0
    ? contextData.topProducts.map(p => `${p.name} (${formatMMK(p.revenue)})`).join(', ')
    : 'No sales data yet';

  const systemPrompt = `You are a helpful Store Manager/CFO powered by AI for a retail shop in Myanmar.
You have access to real-time business data and provide actionable insights based on actual numbers.

CURRENT BUSINESS STATUS (Real-Time Data):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 TODAY'S PERFORMANCE:
   • Sales: ${formatMMK(contextData.todaySales)} (${contextData.todayTransactionCount} transactions)
   • Expenses: ${formatMMK(contextData.todayExpenses)}
   • Net Profit Today: ${formatMMK(contextData.todaySales - contextData.todayExpenses)}

💰 FINANCIAL OVERVIEW:
   • Total Revenue (All-Time): ${formatMMK(contextData.totalRevenue)}
   • Credit Owed by Customers: ${formatMMK(contextData.creditOwed)}

📦 INVENTORY ALERTS:
   • Low Stock Items: ${lowStockWarning}

🏆 TOP SELLING PRODUCTS:
   ${topProductsStr}

👥 CUSTOMER BASE:
   • Total Active Customers: ${contextData.totalCustomers}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS:
- Answer questions based on the REAL DATA above, not generic advice
- Be specific with numbers and actionable recommendations
- If asked "How is business?", cite actual sales figures
- Respond in the language of the user's question (English or Myanmar)
- Keep responses concise (2-4 sentences) but data-driven`;

  const userPrompt = `User Question: ${prompt}`;

  // Use failover system (Gemini → Groq → Fallback)
  const result = await generateWithFailover(systemPrompt, userPrompt, {
    preferredModel: 'gemini-2.5-pro',
  });

  return result.content;
}

// Streaming version for real-time responses with structured context (with AI failover)
export async function askGeminiAboutBusinessStreaming(
  prompt: string,
  contextData: {
    todaySales: number;
    todayTransactionCount: number;
    lowStockItems: Array<{ name: string; stock: number; minStockLevel: number }>;
    topProducts: Array<{ name: string; totalQuantity: number; revenue: number }>;
    totalCustomers: number;
    creditOwed: number;
    todayExpenses: number;
    totalRevenue: number;
  },
  onToken: (token: string) => void
): Promise<string> {
  // Build rich context string with actual data
  const lowStockWarning = contextData.lowStockItems.length > 0
    ? contextData.lowStockItems.map(item => `${item.name} (${item.stock}/${item.minStockLevel})`).join(', ')
    : 'None';

  const topProductsStr = contextData.topProducts.length > 0
    ? contextData.topProducts.map(p => `${p.name} (${formatMMK(p.revenue)})`).join(', ')
    : 'No sales data yet';

  const systemPrompt = `You are a helpful Store Manager/CFO powered by AI for a retail shop in Myanmar.
You have access to real-time business data and provide actionable insights based on actual numbers.

CURRENT BUSINESS STATUS (Real-Time Data):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 TODAY'S PERFORMANCE:
   • Sales: ${formatMMK(contextData.todaySales)} (${contextData.todayTransactionCount} transactions)
   • Expenses: ${formatMMK(contextData.todayExpenses)}
   • Net Profit Today: ${formatMMK(contextData.todaySales - contextData.todayExpenses)}

💰 FINANCIAL OVERVIEW:
   • Total Revenue (All-Time): ${formatMMK(contextData.totalRevenue)}
   • Credit Owed by Customers: ${formatMMK(contextData.creditOwed)}

📦 INVENTORY ALERTS:
   • Low Stock Items: ${lowStockWarning}

🏆 TOP SELLING PRODUCTS:
   ${topProductsStr}

👥 CUSTOMER BASE:
   • Total Active Customers: ${contextData.totalCustomers}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS:
- Answer questions based on the REAL DATA above, not generic advice
- Be specific with numbers and actionable recommendations
- If asked "How is business?", cite actual sales figures
- Respond in the language of the user's question (English or Myanmar)
- Keep responses concise (2-4 sentences) but data-driven`;

  const userPrompt = `User Question: ${prompt}`;

  // Use failover system with streaming (Gemini → Groq → Fallback)
  const result = await generateStreamingWithFailover(systemPrompt, userPrompt, onToken, {
    preferredModel: 'gemini-2.5-pro',
  });

  return result.fullContent;
}

// Generate executive summary from report data (for P&L, etc.) with AI failover
export async function generateReportSummary(prompt: string, reportData: string): Promise<string> {
  const systemPrompt = `You are a financial analyst providing executive summaries for business reports.
Analyze the data provided and give concise, actionable insights.
Focus on key trends, anomalies, and strategic recommendations.`;

  const userPrompt = `${prompt}\n\nReport Data:\n${reportData}`;

  // Use failover system (Gemini → Groq → Fallback)
  const result = await generateWithFailover(systemPrompt, userPrompt, {
    preferredModel: 'gemini-2.5-pro',
  });

  return result.content;
}

// Helper function to format currency
function formatMMK(amount: number): string {
  return new Intl.NumberFormat('my-MM', {
    style: 'currency',
    currency: 'MMK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Export additional utility functions if needed
export { formatMMK };
