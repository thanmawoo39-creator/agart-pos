import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface BusinessContext {
  totalSales: number;
  totalRevenue: number;
  cashSales: number;
  creditSales: number;
  cardSales: number;
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  grossProfit: number;
  netProfit: number;
  netProfitMargin: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  lowStockProducts: { name: string; stock: number }[];
  totalCustomers: number;
  totalOutstandingDebt: number;
  period: string;
}

export interface DebtContext {
  totalDebt: number;
  creditLimit: number;
  utilizationPercent: number;
  daysSinceLastPayment: number | null;
  isLoyalCustomer: boolean;
  paymentHistory: "good" | "average" | "poor";
}

const SYSTEM_PROMPT_BURMESE = `You are a Virtual CFO and Business Assistant for a small retail store in Myanmar. 
Always respond in Burmese language (Myanmar script).
Provide actionable, practical business advice based on the data provided.
Keep responses concise but insightful.
Use Myanmar currency format (MMK) when discussing money.
Focus on:
- Cost reduction opportunities
- Revenue growth strategies
- Cash flow management
- Inventory optimization
- Customer relationship management`;

export async function askGeminiAboutBusiness(
  question: string,
  context: BusinessContext
): Promise<string> {
  const contextPrompt = `
စီးပွားရေးအချက်အလက်များ (${context.period}):
- စုစုပေါင်းအရောင်း: ${context.totalSales} ခု
- စုစုပေါင်းဝင်ငွေ: ${formatMMK(context.totalRevenue)}
- ငွေသားရောင်းချမှု: ${formatMMK(context.cashSales)}
- အကြွေးရောင်းချမှု: ${formatMMK(context.creditSales)}
- ကတ်ရောင်းချမှု: ${formatMMK(context.cardSales)}
- စုစုပေါင်းကုန်ကျစရိတ်: ${formatMMK(context.totalExpenses)}
${Object.entries(context.expensesByCategory).map(([cat, amt]) => `  - ${cat}: ${formatMMK(amt)}`).join('\n')}
- အမြတ်ငွေအကြမ်း: ${formatMMK(context.grossProfit)}
- အသားတင်အမြတ်: ${formatMMK(context.netProfit)} (${context.netProfitMargin.toFixed(1)}%)
- ရောင်းအားကောင်းသောပစ္စည်းများ: ${context.topProducts.map(p => `${p.name} (${p.quantity} ခု)`).join(', ') || 'မရှိ'}
- စတော့နည်းနေသောပစ္စည်းများ: ${context.lowStockProducts.map(p => `${p.name} (${p.stock} ခု)`).join(', ') || 'မရှိ'}
- ဖောက်သည်စုစုပေါင်း: ${context.totalCustomers} ဦး
- စုစုပေါင်းအကြွေးလက်ကျန်: ${formatMMK(context.totalOutstandingDebt)}

အသုံးပြုသူမေးခွန်း: ${question}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT_BURMESE }] },
        { role: "model", parts: [{ text: "နားလည်ပါပြီ။ သင့်စီးပွားရေးအတွက် အကြံဉာဏ်ပေးရန် အဆင်သင့်ဖြစ်ပါပြီ။" }] },
        { role: "user", parts: [{ text: contextPrompt }] },
      ],
    });
    return response.text || "တုံ့ပြန်မှုမရရှိပါ။";
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("Gemini API ချိတ်ဆက်မှု မအောင်မြင်ပါ။");
  }
}

export async function generatePnLExecutiveSummary(
  context: BusinessContext
): Promise<string> {
  const prompt = `${SYSTEM_PROMPT_BURMESE}

အောက်ပါ P&L အချက်အလက်များကို သုံးသပ်ပြီး Executive Summary ရေးပါ။
ဘာသာစကား: မြန်မာ
ပုံစံ: 
1. အခြေအနေအကျဉ်းချုပ် (2-3 ကြောင်း)
2. အဓိကအင်အားချက် (1-2 ချက်)
3. စိုးရိမ်ရသောအချက် (1-2 ချက်)
4. တိုးတက်ရန်အကြံပြု (1-2 ချက်)

စီးပွားရေးအချက်အလက်များ (${context.period}):
- ဝင်ငွေ: ${formatMMK(context.totalRevenue)}
- ကုန်ကျစရိတ်: ${formatMMK(context.totalExpenses)}
${Object.entries(context.expensesByCategory).filter(([, v]) => v > 0).map(([cat, amt]) => `  - ${cat}: ${formatMMK(amt)}`).join('\n')}
- အမြတ်ငွေအကြမ်း: ${formatMMK(context.grossProfit)}
- အသားတင်အမြတ်: ${formatMMK(context.netProfit)} (${context.netProfitMargin.toFixed(1)}%)
- ငွေသား/အကြွေး/ကတ် အချိုး: ${formatMMK(context.cashSales)} / ${formatMMK(context.creditSales)} / ${formatMMK(context.cardSales)}
- အကြွေးလက်ကျန်: ${formatMMK(context.totalOutstandingDebt)}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return response.text || "Executive Summary မရရှိပါ။";
  } catch (error) {
    console.error("Gemini P&L summary error:", error);
    throw new Error("Executive Summary ထုတ်ယူမှု မအောင်မြင်ပါ။");
  }
}

export async function generateDebtReminderMessage(
  context: DebtContext,
  baseMessage: string
): Promise<string> {
  const toneGuidance = context.isLoyalCustomer
    ? "အလွန်ယဉ်ကျေးပြီး လေးစားမှုပြသပါ။ ကြာရှည်ဆက်ဆံရေးကို တန်ဖိုးထားပါ။"
    : context.paymentHistory === "good"
    ? "ယဉ်ကျေးပြီး သတိပေးပါ။"
    : context.paymentHistory === "average"
    ? "တည်ကြည်ပြီး ရှင်းလင်းစွာ ပြောပါ။"
    : "တည်ကြည်ပြီး အရေးတကြီး သတိပေးပါ။";

  const prompt = `You are writing a debt collection reminder for a customer.
Language: Burmese (Myanmar script)
Tone: ${toneGuidance}

Customer context (ANONYMIZED - do not include specific amounts or names):
- Credit utilization: ${context.utilizationPercent.toFixed(0)}%
- Days since last payment: ${context.daysSinceLastPayment ?? 'Never paid'}
- Is loyal customer: ${context.isLoyalCustomer ? 'Yes' : 'No'}
- Payment history: ${context.paymentHistory}

Base message to rewrite: "${baseMessage}"

Rewrite this message to be appropriate for this customer's situation. Keep it short (2-3 sentences max).
DO NOT include specific amounts, names, or identifiable information.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return response.text || baseMessage;
  } catch (error) {
    console.error("Gemini reminder generation error:", error);
    return baseMessage;
  }
}

function formatMMK(amount: number): string {
  return new Intl.NumberFormat("my-MM", {
    style: "currency",
    currency: "MMK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
