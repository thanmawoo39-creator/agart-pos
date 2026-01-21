import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiAI, hasGeminiApiKey } from './gemini-config';
import { generateWithFailover, generateStreamingWithFailover, generateVisionWithFailover, AIResult } from './ai-failover';


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

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function callGeminiVisionAPI(imageBuffer: Buffer, mimeType: string, prompt: string): Promise<AIResult> {
  let retries = 3;
  let delayMs = 1000;

  while (retries > 0) {
    try {
      const genAI = await getGeminiAI();
      const model = genAI.getGenerativeModel({ model: 'gemini-3-flash' });
      const imagePart = prepareImageData(imageBuffer, mimeType);

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
        },
        confidence_score: parsed.confidence_score || 0.8,
        raw: parsed.raw || response
      };
    } catch (error: any) {
      if (error.message && error.message.includes('429 Too Many Requests')) {
        console.warn(`Gemini API rate limit hit. Retrying in ${delayMs}ms... (${retries - 1} retries left)`);
        await delay(delayMs);
        retries--;
        delayMs *= 2;
      } else {
        // Non-retryable error, re-throw
        throw error;
      }
    }
  }

  // If all retries fail, return a failure response
  return {
    success: false,
    raw: 'API rate limit exceeded after multiple retries.',
    warnings: ['AI service is temporarily unavailable due to high demand. Please try again in a few moments.']
  };
}

export async function identifyGroceryItem(imageBuffer: Buffer, mimeType: string): Promise<AIResult> {
  const prompt = `Analyze this grocery item image to identify the product's name and brand. Your primary goal is to provide a name that can be matched exactly with a product in our inventory list.

Provide a JSON response with the following structure:
{
  "name": "exact product name including brand",
  "confidence_score": 0.00
}

Rules:
- Focus on identifying the brand and product name from the packaging.
- If the image is blurry, dark, or unclear, set name to "NOT_FOUND" and confidence_score to 0.
- If the image does not contain a product, set name to "NOT_FOUND".
- The name should be as specific as possible to match an inventory item. For example, instead of "Soda", identify it as "Coca-Cola Classic".
- Confidence score should be between 0.0 and 1.0, representing how certain you are about the identified name.`;

  return await generateVisionWithFailover(imageBuffer, mimeType, prompt);
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
      model: 'gemini-3-flash',
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

  const systemPrompt = `သင်သည် မြန်မာနိုင်ငံရှိ ကုန်စုံဆိုင်အတွက် ကျွမ်းကျင်သော CFO နှင့် စီးပွားရေးအကြံပေးပုဂ္ဂိုလ် ဖြစ်ပါသည်။
သင့်တွင် လက်ရှိ စီးပွားရေးဒေတာများကို ရယူနိုင်ပြီး တကယ့်ဂဏန်းများအပေါ် အခြေခံသော လက်တွေ့အသုံးဝင်သည့် အကြံဉာဏ်များကို ပေးပါသည်။

လက်ရှိ စီးပွားရေးအခြေအနေ (Real-Time Data):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ယနေ့ စွမ်းဆောင်ရည်:
   • ရောင်းရငွေ: ${formatMMK(contextData.todaySales)} (${contextData.todayTransactionCount} ကြိမ်)
   • ကုန်ကျစရိတ်: ${formatMMK(contextData.todayExpenses)}
   • ယနေ့ အသားတင်အမြတ်: ${formatMMK(contextData.todaySales - contextData.todayExpenses)}

💰 ငွေကြေးခြုံငုံသုံးသပ်ချက်:
   • စုစုပေါင်းဝင်ငွေ (အားလုံး): ${formatMMK(contextData.totalRevenue)}
   • ဖောက်သည်များထံမှ ရရန်ကြွေး: ${formatMMK(contextData.creditOwed)}

📦 ကုန်ပစ္စည်းသတိပေးချက်:
   • ကုန်နည်းနေသောပစ္စည်းများ: ${lowStockWarning}

🏆 အရောင်းရဆုံး ပစ္စည်းများ:
   ${topProductsStr}

👥 ဖောက်သည်များ:
   • စုစုပေါင်းဖောက်သည်အရေအတွက်: ${contextData.totalCustomers}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

အရေးကြီးညွှန်ကြားချက်များ (CRITICAL RULES):

1. ဘာသာစကား (STRICT LANGUAGE RULE):
   - သင်သည် မြန်မာဘာသာဖြင့်သာ အဖြေပေးရမည်။
   - အင်္ဂလိပ်စာကြောင်းများကို လုံးဝမသုံးပါနှင့်။
   - ပစ္စည်းအမည်များ (ဥပမာ: "Fresh Apples", "Milk") ကို အင်္ဂလိပ်လိုထားခဲ့နိုင်သော်လည်း စာကြောင်းဖွဲ့စည်းပုံနှင့် အကြံဉာဏ်များကိုမူ မြန်မာဘာသာဖြင့်သာ ရေးပါ။

   မှားသောပုံစံ: "You should stock 10 units of Milk."
   မှန်သောပုံစံ: "Milk (၁၀) ဗူးကို ထပ်မံဖြည့်တင်းသင့်ပါသည်။"

2. ဒေတာအသုံးပြုမှု:
   - အထက်ပါ တကယ့်ဒေတာများကိုသာ အခြေခံ၍ ဖြေကြားပါ
   - ကိန်းဂဏန်းများနှင့် တိကျသော အကြံပြုချက်များပေးပါ
   - "စီးပွားရေးဘယ်လိုလဲ" ဟုမေးလျှင် တကယ့်ရောင်းရငွေပမာဏကို ကိုးကားပါ

3. လေသံ: ကျွမ်းကျင်မှု၊ အားပေးမှုနှင့် ရှင်းလင်းမှုရှိစေရန် ရေးသားပါ

4. အတိုချုံး (၂-၄ ကြောင်း) ဖြေဆိုပါ`;

  // Use failover system (Groq → Gemini → Fallback)
  const result = await generateWithFailover(systemPrompt, prompt, {
    preferredProvider: 'groq',
    preferredModel: 'llama-3.3-70b-versatile',
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

  const systemPrompt = `သင်သည် မြန်မာနိုင်ငံရှိ ကုန်စုံဆိုင်အတွက် ကျွမ်းကျင်သော CFO နှင့် စီးပွားရေးအကြံပေးပုဂ္ဂိုလ် ဖြစ်ပါသည်။
သင့်တွင် လက်ရှိ စီးပွားရေးဒေတာများကို ရယူနိုင်ပြီး တကယ့်ဂဏန်းများအပေါ် အခြေခံသော လက်တွေ့အသုံးဝင်သည့် အကြံဉာဏ်များကို ပေးပါသည်။

လက်ရှိ စီးပွားရေးအခြေအနေ (Real-Time Data):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ယနေ့ စွမ်းဆောင်ရည်:
   • ရောင်းရငွေ: ${formatMMK(contextData.todaySales)} (${contextData.todayTransactionCount} ကြိမ်)
   • ကုန်ကျစရိတ်: ${formatMMK(contextData.todayExpenses)}
   • ယနေ့ အသားတင်အမြတ်: ${formatMMK(contextData.todaySales - contextData.todayExpenses)}

💰 ငွေကြေးခြုံငုံသုံးသပ်ချက်:
   • စုစုပေါင်းဝင်ငွေ (အားလုံး): ${formatMMK(contextData.totalRevenue)}
   • ဖောက်သည်များထံမှ ရရန်ကြွေး: ${formatMMK(contextData.creditOwed)}

📦 ကုန်ပစ္စည်းသတိပေးချက်:
   • ကုန်နည်းနေသောပစ္စည်းများ: ${lowStockWarning}

🏆 အရောင်းရဆုံး ပစ္စည်းများ:
   ${topProductsStr}

👥 ဖောက်သည်များ:
   • စုစုပေါင်းဖောက်သည်အရေအတွက်: ${contextData.totalCustomers}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

အရေးကြီးညွှန်ကြားချက်များ (CRITICAL RULES):

1. ဘာသာစကား (STRICT LANGUAGE RULE):
   - သင်သည် မြန်မာဘာသာဖြင့်သာ အဖြေပေးရမည်။
   - အင်္ဂလိပ်စာကြောင်းများကို လုံးဝမသုံးပါနှင့်။
   - ပစ္စည်းအမည်များ (ဥပမာ: "Fresh Apples", "Milk") ကို အင်္ဂလိပ်လိုထားခဲ့နိုင်သော်လည်း စာကြောင်းဖွဲ့စည်းပုံနှင့် အကြံဉာဏ်များကိုမူ မြန်မာဘာသာဖြင့်သာ ရေးပါ။

   မှားသောပုံစံ: "You should stock 10 units of Milk."
   မှန်သောပုံစံ: "Milk (၁၀) ဗူးကို ထပ်မံဖြည့်တင်းသင့်ပါသည်။"

2. ဒေတာအသုံးပြုမှု:
   - အထက်ပါ တကယ့်ဒေတာများကိုသာ အခြေခံ၍ ဖြေကြားပါ
   - ကိန်းဂဏန်းများနှင့် တိကျသော အကြံပြုချက်များပေးပါ
   - "စီးပွားရေးဘယ်လိုလဲ" ဟုမေးလျှင် တကယ့်ရောင်းရငွေပမာဏကို ကိုးကားပါ

3. လေသံ: ကျွမ်းကျင်မှု၊ အားပေးမှုနှင့် ရှင်းလင်းမှုရှိစေရန် ရေးသားပါ

4. အတိုချုံး (၂-၄ ကြောင်း) ဖြေဆိုပါ`;

  const userPrompt = `User Question: ${prompt}`;

  // Use failover system with streaming (Groq → Gemini → Fallback)
  const result = await generateStreamingWithFailover(systemPrompt, userPrompt, onToken, {
    preferredProvider: 'groq',
    preferredModel: 'llama-3.3-70b-versatile',
  });

  return result.fullContent;
}

// Generate executive summary from report data (for P&L, etc.) with AI failover
export async function generateReportSummary(prompt: string, reportData: string): Promise<string> {
  const systemPrompt = `You are a financial analyst providing executive summaries for business reports.
Analyze the data provided and give concise, actionable insights.
Focus on key trends, anomalies, and strategic recommendations.`;

  const userPrompt = `${prompt}\n\nReport Data:\n${reportData}`;

  // Use failover system (Groq → Gemini → Fallback)
  const result = await generateWithFailover(systemPrompt, userPrompt, {
    preferredProvider: 'groq',
    preferredModel: 'llama-3.3-70b-versatile',
  });

  return result.content;
}

// AI System Doctor - Analyze business & system health with AI
export interface SystemHealthLogs {
  isOnline: boolean;
  dbLatency: string;
  dbHealthy: boolean;
  localStorageUsedMB: number;
  localStorageQuotaMB: number;
  pageLoadTimeMs: number;
  userAgent: string;
  timestamp: string;
  errors?: string[];
}

export interface BusinessHealthData {
  todaySales: number;
  totalExpenses: number;
  netProfit: number;
  lowStockCount: number;
  lowStockItems: string[];
  guestOrderPercent?: number; // percent of orders from guests
}

export interface SystemDiagnosis {
  status: 'healthy' | 'warning' | 'critical';
  message: string; // Business Insights (Burmese)
  fix: string;    // Technical/Business Action Items
}

export async function analyzeSystemHealth(
  systemLogs: SystemHealthLogs,
  businessData?: BusinessHealthData
): Promise<SystemDiagnosis> {
  const systemPrompt = `သင်သည် AgartPOS ၏ Virtual CFO နှင့် System Administrator ဖြစ်ပါသည်။
သင့်တာဝန်မှာ လုပ်ငန်း၏ ငွေကြေးအခြေအနေနှင့် နည်းပညာပိုင်းဆိုင်ရာ ကျန်းမာရေးကို သုံးသပ်ပေးရန် ဖြစ်သည်။

ပေးပို့သော အချက်အလက်များကို သုံးသပ်ပြီး မြန်မာဘာသာဖြင့် အနှစ်ချုပ် အကြံဉာဏ်ပေးပါ။

Output Format (JSON Only):
{
  "status": "healthy" | "warning" | "critical",
  "message": "စီးပွားရေးနှင့် စနစ်ပိုင်းဆိုင်ရာ သုံးသပ်ချက် (မြန်မာလို)",
  "fix": "ချက်ချင်းလုပ်ဆောင်သင့်သော အချက်များ (မြန်မာလို သို့မဟုတ် English technical terms)"
}

Status Rules:
- healthy: Sales > 0, Profit > 0, No Errors
- warning: High Latency, Low Stock, or Low Sales
- critical: Offline, DB Errors, or Critical Expenses > Sales

Tone: Professional, Encouraging, Strategic.

Guest Insights:
If guestOrderPercent > 20%, suggest strategies to convert guests to members (e.g., offering discounts for signups).`;

  const userPrompt = `
📊 BUSINESS DATA:
${businessData ? JSON.stringify(businessData, null, 2) : "No business data available."}

🛠 SYSTEM LOGS:
${JSON.stringify(systemLogs, null, 2)}

Please provide a 360-degree analysis. If sales are 0, suggesting checking if the shop is open or marketing is needed. If system has high latency, suggest checking internet.`;

  try {
    const result = await generateWithFailover(systemPrompt, userPrompt, {
      preferredProvider: 'groq',
      preferredModel: 'llama-3.3-70b-versatile',
    });

    // Parse JSON from response
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as SystemDiagnosis;
      return {
        status: parsed.status || 'warning',
        message: parsed.message || 'စနစ်အခြေအနေကို စစ်ဆေးလို့မရပါ။',
        fix: parsed.fix || 'စာမျက်နှာကို refresh လုပ်ပြီး ထပ်ကြိုးစားပါ။',
      };
    }

    // Fallback if JSON parsing fails
    return {
      status: 'warning',
      message: 'AI တုံ့ပြန်ချက်ကို ဖတ်ရှုလို့မရပါ။',
      fix: 'Try running the diagnosis again.',
    };
  } catch (error) {
    console.error('[AI-SYSTEM-DOCTOR] Error:', error);
    return {
      status: 'critical',
      message: 'AI ဆက်သွယ်မှု မအောင်မြင်ပါ။',
      fix: 'Check if Gemini or Groq API key is configured in Settings.',
    };
  }
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

/**
 * Translate menu item name to Burmese using Gemini AI
 * Used for automatic product name translation during creation/update
 *
 * @param text - The English product/menu item name to translate
 * @returns The Burmese translation, or original text if translation fails
 */
export async function translateToBurmese(text: string): Promise<string> {
  // Skip translation for empty or very short strings
  if (!text || text.trim().length < 2) {
    return text;
  }

  // Skip if text already contains Burmese characters (Unicode range: U+1000-U+109F)
  const burmeseRegex = /[\u1000-\u109F]/;
  if (burmeseRegex.test(text)) {
    console.log('[Translation] Text already contains Burmese, skipping:', text);
    return text;
  }

  try {
    // Check if API key is configured
    if (!(await hasGeminiApiKey())) {
      console.warn('[Translation] Gemini API key not configured, returning original text');
      return text;
    }

    const genAI = await getGeminiAI();
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash',
      generationConfig: {
        temperature: 0.0, // Maximum consistency for translations
        maxOutputTokens: 20, // Prevent long-winded responses
      }
    });

    const prompt = `System: You are a professional menu translator.

Task: Translate to Burmese.

Constraint: Return ONLY the Burmese characters. No quotes. No English. No explanations.

Input: "${text}"`;

    const result = await model.generateContent(prompt);
    let translation = result.response.text().trim();

    // Post-processing: Remove any accidental quotes
    translation = translation.replace(/["'""'']/g, "").trim();

    // Validate that we got a reasonable response
    if (!translation || translation.length === 0) {
      console.warn('[Translation] Empty response from Gemini, returning original');
      return text;
    }

    // Check if the response contains Burmese characters
    if (!burmeseRegex.test(translation)) {
      console.warn('[Translation] Response does not contain Burmese characters:', translation);
      return text;
    }

    console.log(`[Translation] "${text}" → "${translation}"`);
    return translation;

  } catch (error: any) {
    // Handle rate limiting gracefully
    if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
      console.warn('[Translation] Rate limited, returning original text:', text);
      return text;
    }

    // Handle other errors
    console.error('[Translation] Error translating to Burmese:', error.message || error);
    return text;
  }
}

// Export additional utility functions if needed
export { formatMMK };
