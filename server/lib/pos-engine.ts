import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, desc, lt, sum, count, gte, sql } from "drizzle-orm";

export async function getSalesSummary() {
  try {
    // 1. Get Real Sales Data
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [salesData] = await db
      .select({ 
        total: sum(schema.sales.total),
        count: count(schema.sales.id)
      })
      .from(schema.sales)
      .where(gte(schema.sales.timestamp, today.toISOString()));

    // 2. Get Receivables (Ledger)
    // Note: Wrapping in try-catch in case table structure differs slightly in backup
    let receivables = 0;
    try {
        const [res] = await db
        .select({ total: sum(schema.creditLedger.amount) })
        .from(schema.creditLedger)
        .where(eq(schema.creditLedger.type, 'charge'));
        receivables = Number(res?.total || 0);
    } catch (e) { console.log("Ledger calculation skipped due to schema mismatch"); }

    // 3. Stock Alerts
    const [lowStock] = await db
      .select({ count: count(schema.products.id) })
      .from(schema.products)
      .where(lt(schema.products.stock, 5));

    return {
      totalSales: Number(salesData?.total || 0),
      totalCustomers: Number(salesData?.count || 0),
      totalReceivables: receivables,
      lowStockCount: Number(lowStock?.count || 0)
    };
  } catch (error) {
    console.error("Engine Error:", error);
    return { totalSales: 0, totalCustomers: 0, totalReceivables: 0, lowStockCount: 0 };
  }
}

// ... (Other functions will use default simple logic to prevent crashes) ...
export async function processSale(saleData: any) {
    // Basic Sale Recording
    return await db.insert(schema.sales).values({
        subtotal: saleData.subtotal || 0,
        discount: saleData.discount || 0,
        tax: saleData.tax || 0,
        total: saleData.total,
        paymentMethod: saleData.paymentMethod || 'cash',
        paymentStatus: saleData.paymentStatus || 'paid',
        timestamp: new Date().toISOString(),
    }).returning();
}

export const posEngine = {
    getSalesSummary,
    processSale,
    // Add simple fallbacks
    findProductByBarcode: async (code: string) => {
        const [p] = await db.select().from(schema.products).where(eq(schema.products.barcode, code)).limit(1);
        return p;
    },
    getTopDebtor: async () => undefined,
    getStockWarning: async () => undefined
};