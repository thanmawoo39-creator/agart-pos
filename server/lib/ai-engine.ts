/**
 * AI Insights Engine for QuickPOS
 * Clean modular logic for customer risk analysis, stock predictions, and business insights
 */

import { storage } from "../storage";
import type { Customer, CreditLedger, Product, Sale, Expense, ExpenseCategory, ProfitLossReport } from "@shared/schema";

// Risk analysis result type
export interface RiskAnalysis {
  customerId: string;
  customerName: string;
  riskLevel: "low" | "high";
  riskFactors: string[];
  creditUtilization: number;
  daysSinceLastPayment: number | null;
  currentBalance: number;
  creditLimit: number;
}

// Top debtor type
export interface TopDebtor {
  customerId: string;
  customerName: string;
  outstandingBalance: number;
  creditLimit: number;
  riskLevel: "low" | "high";
  utilizationPercent: number;
}

// Stock warning type
export interface StockWarning {
  productId: string;
  productName: string;
  currentStock: number;
  avgDailySales: number;
  daysUntilStockout: number;
  severity: "critical" | "warning" | "low";
}

// Daily summary type
export interface DailySummary {
  date: string;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  creditSales: number;
  transactionCount: number;
  cashTransactions: number;
  creditTransactions: number;
}

// AI Insights aggregate type
export interface AIInsights {
  topDebtors: TopDebtor[];
  stockWarnings: StockWarning[];
  dailySummary: DailySummary;
  riskySummary: string;
}

/**
 * Analyze customer risk based on credit ledger and utilization
 * High Risk if: No payment for 30+ days OR 90%+ credit utilization
 */
export async function analyzeCustomerRisk(customerId: string): Promise<RiskAnalysis | null> {
  const customer = await storage.getCustomer(customerId);
  if (!customer) return null;

  const ledger = await storage.getCreditLedger();
  const customerLedger = ledger.filter((e) => e.customerId === customerId);

  const riskFactors: string[] = [];
  let daysSinceLastPayment: number | null = null;

  // Find last payment
  const payments = customerLedger
    .filter((e) => e.type === "payment")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (payments.length > 0) {
    const lastPaymentDate = new Date(payments[0].timestamp);
    const now = new Date();
    daysSinceLastPayment = Math.floor((now.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastPayment > 30) {
      riskFactors.push(`No payment for ${daysSinceLastPayment} days`);
    }
  } else if (customer.currentBalance > 0) {
    riskFactors.push("No payment history with outstanding balance");
    daysSinceLastPayment = null;
  }

  // Calculate credit utilization
  const creditUtilization = customer.creditLimit > 0 
    ? (customer.currentBalance / customer.creditLimit) * 100 
    : 0;

  if (creditUtilization >= 90) {
    riskFactors.push(`Credit utilization at ${creditUtilization.toFixed(0)}%`);
  }

  // Determine risk level
  const isHighRisk = 
    riskFactors.length > 0 ||
    (daysSinceLastPayment !== null && daysSinceLastPayment > 30) ||
    creditUtilization >= 90;

  return {
    customerId: customer.id,
    customerName: customer.name,
    riskLevel: isHighRisk ? "high" : "low",
    riskFactors,
    creditUtilization,
    daysSinceLastPayment,
    currentBalance: customer.currentBalance,
    creditLimit: customer.creditLimit,
  };
}

/**
 * Get top debtors sorted by outstanding balance
 */
export async function getTopDebtors(limit: number = 3): Promise<TopDebtor[]> {
  const customers = await storage.getCustomers();
  
  // Filter customers with outstanding balance and sort by balance
  const debtors = customers
    .filter((c) => c.currentBalance > 0)
    .sort((a, b) => b.currentBalance - a.currentBalance)
    .slice(0, limit);

  return Promise.all(
    debtors.map(async (customer) => {
      const risk = await analyzeCustomerRisk(customer.id);
      const utilizationPercent = customer.creditLimit > 0
        ? (customer.currentBalance / customer.creditLimit) * 100
        : 0;

      return {
        customerId: customer.id,
        customerName: customer.name,
        outstandingBalance: customer.currentBalance,
        creditLimit: customer.creditLimit,
        riskLevel: risk?.riskLevel ?? "low",
        utilizationPercent,
      };
    })
  );
}

/**
 * Calculate stock warnings based on sales velocity
 * Uses actual days of sales data available to avoid skewed averages
 */
export async function getStockWarnings(): Promise<StockWarning[]> {
  const products = await storage.getProducts();
  const sales = await storage.getSales();

  // Calculate the actual time window based on available sales data
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentSales = sales.filter((s) => new Date(s.timestamp) >= sevenDaysAgo);
  
  // Calculate actual number of days with sales data
  let daysWithData = 7;
  if (recentSales.length > 0) {
    const oldestSale = recentSales.reduce((oldest, sale) => {
      const saleDate = new Date(sale.timestamp);
      return saleDate < oldest ? saleDate : oldest;
    }, new Date(recentSales[0].timestamp));
    
    const daysSinceOldest = Math.max(1, Math.ceil((now.getTime() - oldestSale.getTime()) / (1000 * 60 * 60 * 24)));
    daysWithData = Math.min(7, daysSinceOldest);
  }

  // Calculate units sold per product
  const productSales: Record<string, number> = {};
  recentSales.forEach((sale) => {
    sale.items.forEach((item) => {
      productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
    });
  });

  const warnings: StockWarning[] = [];

  products.forEach((product) => {
    const unitsSold = productSales[product.id] || 0;
    
    // Handle zero sales case - check stock level against minimum
    if (unitsSold === 0) {
      if (product.stock <= product.minStockLevel) {
        warnings.push({
          productId: product.id,
          productName: product.name,
          currentStock: product.stock,
          avgDailySales: 0,
          daysUntilStockout: product.stock === 0 ? 0 : 999,
          severity: product.stock === 0 ? "critical" : product.stock < product.minStockLevel ? "warning" : "low",
        });
      }
      return;
    }

    // Calculate average using actual days with data
    const avgDailySales = unitsSold / daysWithData;
    const daysUntilStockout = Math.floor(product.stock / avgDailySales);

    let severity: "critical" | "warning" | "low" = "low";
    if (daysUntilStockout <= 3 || product.stock === 0) {
      severity = "critical";
    } else if (daysUntilStockout <= 7 || product.stock <= product.minStockLevel) {
      severity = "warning";
    }

    // Only include if stock is concerning
    if (daysUntilStockout <= 14 || product.stock <= product.minStockLevel) {
      warnings.push({
        productId: product.id,
        productName: product.name,
        currentStock: product.stock,
        avgDailySales: Math.round(avgDailySales * 10) / 10,
        daysUntilStockout,
        severity,
      });
    }
  });

  // Sort by severity and days until stockout
  return warnings.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, low: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return a.daysUntilStockout - b.daysUntilStockout;
  });
}

/**
 * Get daily summary for today's sales
 */
export async function getDailySummary(date?: Date): Promise<DailySummary> {
  const targetDate = date || new Date();
  const dateStr = targetDate.toISOString().split("T")[0];
  
  const sales = await storage.getSales();
  
  // Filter sales for the target date
  const todaySales = sales.filter((s) => {
    const saleDate = new Date(s.timestamp).toISOString().split("T")[0];
    return saleDate === dateStr;
  });

  const summary = {
    date: dateStr,
    totalSales: 0,
    cashSales: 0,
    cardSales: 0,
    creditSales: 0,
    transactionCount: todaySales.length,
    cashTransactions: 0,
    creditTransactions: 0,
  };

  todaySales.forEach((sale) => {
    summary.totalSales += sale.total;
    
    switch (sale.paymentMethod) {
      case "cash":
        summary.cashSales += sale.total;
        summary.cashTransactions++;
        break;
      case "card":
        summary.cardSales += sale.total;
        break;
      case "credit":
        summary.creditSales += sale.total;
        summary.creditTransactions++;
        break;
    }
  });

  return summary;
}

/**
 * Get all AI insights in one call
 */
export async function getAIInsights(): Promise<AIInsights> {
  const [topDebtors, stockWarnings, dailySummary] = await Promise.all([
    getTopDebtors(3),
    getStockWarnings(),
    getDailySummary(),
  ]);

  // Generate a risk summary message
  const highRiskCount = topDebtors.filter((d) => d.riskLevel === "high").length;
  const criticalStockCount = stockWarnings.filter((w) => w.severity === "critical").length;
  
  let riskySummary = "";
  if (highRiskCount > 0 && criticalStockCount > 0) {
    riskySummary = `Attention: ${highRiskCount} high-risk customer(s) and ${criticalStockCount} critical stock item(s) need attention.`;
  } else if (highRiskCount > 0) {
    riskySummary = `${highRiskCount} customer(s) flagged as high-risk. Review their credit status.`;
  } else if (criticalStockCount > 0) {
    riskySummary = `${criticalStockCount} product(s) at critical stock levels. Reorder soon.`;
  } else {
    riskySummary = "All systems healthy. No immediate risks detected.";
  }

  return {
    topDebtors,
    stockWarnings,
    dailySummary,
    riskySummary,
  };
}

/**
 * Get all customers with their risk analysis for reporting
 */
export async function getAllCustomerRiskAnalysis(): Promise<RiskAnalysis[]> {
  const customers = await storage.getCustomers();
  
  const analyses = await Promise.all(
    customers.map((c) => analyzeCustomerRisk(c.id))
  );

  return analyses.filter((a): a is RiskAnalysis => a !== null);
}

// Expense Insights type
export interface ExpenseInsight {
  type: "warning" | "info" | "success";
  message: string;
  category?: ExpenseCategory;
}

export interface ExpenseInsights {
  totalExpensesThisMonth: number;
  totalExpensesLastMonth: number;
  expensesByCategory: Record<ExpenseCategory, number>;
  insights: ExpenseInsight[];
  estimatedNetProfit: number;
  expenseToSalesRatio: number;
}

/**
 * Calculate Profit & Loss Report
 */
export async function getProfitLossReport(
  startDate?: string,
  endDate?: string
): Promise<ProfitLossReport> {
  const now = new Date();
  const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const defaultEndDate = now.toISOString().split("T")[0];
  
  const start = startDate || defaultStartDate;
  const end = endDate || defaultEndDate;
  
  const [sales, expenses, products] = await Promise.all([
    storage.getSales(),
    storage.getExpensesByDateRange(start, end),
    storage.getProducts(),
  ]);

  // Filter sales by date range
  const filteredSales = sales.filter((s) => {
    const saleDate = new Date(s.timestamp).toISOString().split("T")[0];
    return saleDate >= start && saleDate <= end;
  });

  // Calculate revenue
  const revenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);

  // Calculate Cost of Goods Sold (COGS)
  let costOfGoodsSold = 0;
  const productMap = new Map(products.map((p) => [p.id, p]));
  
  filteredSales.forEach((sale) => {
    sale.items.forEach((item) => {
      const product = productMap.get(item.productId);
      if (product?.cost) {
        costOfGoodsSold += product.cost * item.quantity;
      }
    });
  });

  // Calculate gross profit
  const grossProfit = revenue - costOfGoodsSold;

  // Calculate expenses by category
  const expensesByCategory: Record<ExpenseCategory, number> = {
    Rent: 0,
    Electricity: 0,
    Fuel: 0,
    Internet: 0,
    Taxes: 0,
    Other: 0,
  };

  expenses.forEach((expense) => {
    expensesByCategory[expense.category] += expense.amount;
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const taxExpenses = expensesByCategory.Taxes;
  
  // Net Profit = Gross Profit - Total Expenses (taxes already included in expenses)
  const netProfit = grossProfit - totalExpenses;
  const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return {
    period: `${start} to ${end}`,
    revenue,
    costOfGoodsSold,
    grossProfit,
    totalExpenses,
    expensesByCategory,
    taxExpenses,
    netProfit,
    netProfitMargin,
  };
}

/**
 * Get AI CFO Expense Insights
 */
export async function getExpenseInsights(): Promise<ExpenseInsights> {
  const now = new Date();
  
  // Current month range
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const currentMonthEnd = now.toISOString().split("T")[0];
  
  // Last month range
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

  const [currentExpenses, lastExpenses, sales] = await Promise.all([
    storage.getExpensesByDateRange(currentMonthStart, currentMonthEnd),
    storage.getExpensesByDateRange(lastMonthStart, lastMonthEnd),
    storage.getSales(),
  ]);

  // Calculate totals
  const totalExpensesThisMonth = currentExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalExpensesLastMonth = lastExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Expenses by category for this month
  const expensesByCategory: Record<ExpenseCategory, number> = {
    Rent: 0,
    Electricity: 0,
    Fuel: 0,
    Internet: 0,
    Taxes: 0,
    Other: 0,
  };

  currentExpenses.forEach((expense) => {
    expensesByCategory[expense.category] += expense.amount;
  });

  // Last month expenses by category for comparison
  const lastMonthByCategory: Record<ExpenseCategory, number> = {
    Rent: 0,
    Electricity: 0,
    Fuel: 0,
    Internet: 0,
    Taxes: 0,
    Other: 0,
  };

  lastExpenses.forEach((expense) => {
    lastMonthByCategory[expense.category] += expense.amount;
  });

  // Calculate current month sales
  const currentMonthSales = sales.filter((s) => {
    const saleDate = new Date(s.timestamp).toISOString().split("T")[0];
    return saleDate >= currentMonthStart && saleDate <= currentMonthEnd;
  });

  const totalSalesThisMonth = currentMonthSales.reduce((sum, s) => sum + s.total, 0);

  // Calculate expense to sales ratio
  const expenseToSalesRatio = totalSalesThisMonth > 0 
    ? (totalExpensesThisMonth / totalSalesThisMonth) * 100 
    : 0;

  // Get P&L for estimated net profit
  const pnl = await getProfitLossReport(currentMonthStart, currentMonthEnd);
  const estimatedNetProfit = pnl.netProfit;

  // Generate AI insights
  const insights: ExpenseInsight[] = [];

  // Check for expense increases by category
  const categories: ExpenseCategory[] = ["Rent", "Electricity", "Fuel", "Internet", "Taxes", "Other"];
  categories.forEach((category) => {
    const current = expensesByCategory[category];
    const last = lastMonthByCategory[category];
    
    if (last > 0 && current > last) {
      const increasePercent = ((current - last) / last) * 100;
      if (increasePercent >= 20) {
        insights.push({
          type: "warning",
          message: `Your ${category} expense increased by ${increasePercent.toFixed(0)}% this month. Review for potential savings.`,
          category,
        });
      }
    }
  });

  // Check expense to gross profit ratio
  if (pnl.grossProfit > 0) {
    const expenseToGrossRatio = (totalExpensesThisMonth / pnl.grossProfit) * 100;
    if (expenseToGrossRatio >= 60) {
      insights.push({
        type: "warning",
        message: `High Expense Alert: Operating costs are consuming ${expenseToGrossRatio.toFixed(0)}% of your gross profit.`,
      });
    }
  }

  // Check net profit margin
  if (pnl.netProfitMargin >= 20) {
    insights.push({
      type: "success",
      message: `Healthy: Net profit margin is ${pnl.netProfitMargin.toFixed(1)}%, above the 20% target.`,
    });
  } else if (pnl.netProfitMargin > 0) {
    insights.push({
      type: "info",
      message: `Net profit margin is ${pnl.netProfitMargin.toFixed(1)}%. Consider reducing expenses to reach the 20% target.`,
    });
  } else if (pnl.netProfitMargin < 0) {
    insights.push({
      type: "warning",
      message: `Operating at a loss. Net profit margin is ${pnl.netProfitMargin.toFixed(1)}%. Urgent action needed.`,
    });
  }

  // If no specific insights, add general message
  if (insights.length === 0) {
    insights.push({
      type: "success",
      message: "All expense metrics look healthy. Keep up the good work!",
    });
  }

  return {
    totalExpensesThisMonth,
    totalExpensesLastMonth,
    expensesByCategory,
    insights,
    estimatedNetProfit,
    expenseToSalesRatio,
  };
}
