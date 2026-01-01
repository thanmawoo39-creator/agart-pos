import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShiftButton } from "@/components/shift-button";
import { 
  DollarSign, 
  CreditCard, 
  AlertTriangle, 
  Sparkles, 
  Bot, 
  Users, 
  Package,
  TrendingUp,
  Banknote,
  Smartphone
} from "lucide-react";
import type { DashboardSummary } from "@shared/schema";

interface TopDebtor {
  customerId: string;
  customerName: string;
  outstandingBalance: number;
  creditLimit: number;
  riskLevel: "low" | "high";
  utilizationPercent: number;
}

interface StockWarning {
  productId: string;
  productName: string;
  currentStock: number;
  avgDailySales: number;
  daysUntilStockout: number;
  severity: "critical" | "warning" | "low";
}

interface DailySummary {
  date: string;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  creditSales: number;
  transactionCount: number;
  cashTransactions: number;
  creditTransactions: number;
}

interface AIInsights {
  topDebtors: TopDebtor[];
  stockWarnings: StockWarning[];
  dailySummary: DailySummary;
  riskySummary: string;
}

export default function Dashboard() {
  const { data: summary, isLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard/summary"],
  });

  const { data: aiInsights, isLoading: insightsLoading } = useQuery<AIInsights>({
    queryKey: ["/api/ai/insights"],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 relative min-h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Dashboard
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground" data-testid="text-page-date">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <ShiftButton />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card data-testid="card-total-sales">
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 md:p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Total Sales Today
            </CardTitle>
            <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg bg-emerald-500/10">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            {isLoading ? (
              <Skeleton className="h-7 md:h-9 w-24 md:w-32" />
            ) : (
              <div className="text-xl md:text-3xl font-bold tabular-nums text-foreground" data-testid="text-total-sales">
                {formatCurrency(summary?.totalSalesToday ?? 0)}
              </div>
            )}
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Revenue for today</p>
          </CardContent>
        </Card>

        <Card data-testid="card-receivables">
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 md:p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Total Receivables
            </CardTitle>
            <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-500/10">
              <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-indigo-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            {isLoading ? (
              <Skeleton className="h-7 md:h-9 w-24 md:w-32" />
            ) : (
              <div className="text-xl md:text-3xl font-bold tabular-nums text-foreground" data-testid="text-receivables">
                {formatCurrency(summary?.totalReceivables ?? 0)}
              </div>
            )}
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Outstanding debt</p>
          </CardContent>
        </Card>

        <Card data-testid="card-low-stock">
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 md:p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Low Stock Alert
            </CardTitle>
            <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg bg-amber-500/10">
              <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            {isLoading ? (
              <Skeleton className="h-7 md:h-9 w-16" />
            ) : (
              <div className="text-xl md:text-3xl font-bold tabular-nums text-foreground" data-testid="text-low-stock-count">
                {summary?.lowStockCount ?? 0}
              </div>
            )}
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Items need restock</p>
          </CardContent>
        </Card>

        <Card data-testid="card-ai-insight" className="bg-gradient-to-br from-indigo-500/5 to-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 md:p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              AI Business Insight
            </CardTitle>
            <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-500/10">
              <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-indigo-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            {insightsLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <p className="text-xs md:text-sm text-foreground leading-relaxed" data-testid="text-ai-insight">
                {aiInsights?.riskySummary ?? "Loading insights..."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Assistant Panel */}
      <Card data-testid="card-ai-assistant" className="bg-gradient-to-r from-indigo-500/5 via-transparent to-emerald-500/5">
        <CardHeader className="p-3 md:p-4 pb-2">
          <CardTitle className="text-base md:text-lg font-medium flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-500" />
            AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top 3 Debtors */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="w-4 h-4" />
                Top 3 Debtors
              </div>
              {insightsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : aiInsights?.topDebtors && aiInsights.topDebtors.length > 0 ? (
                <div className="space-y-2">
                  {aiInsights.topDebtors.map((debtor, index) => (
                    <div
                      key={debtor.customerId}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50"
                      data-testid={`debtor-${debtor.customerId}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                          <span className="text-sm font-medium truncate">{debtor.customerName}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(debtor.outstandingBalance)}
                        </div>
                      </div>
                      <Badge
                        variant={debtor.riskLevel === "high" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {debtor.riskLevel === "high" ? "High Risk" : "Low Risk"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No outstanding debts
                </p>
              )}
            </div>

            {/* Stock Warnings */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Package className="w-4 h-4" />
                Stock Warnings
              </div>
              {insightsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : aiInsights?.stockWarnings && aiInsights.stockWarnings.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {aiInsights.stockWarnings.slice(0, 5).map((warning) => (
                    <div
                      key={warning.productId}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50"
                      data-testid={`stock-warning-${warning.productId}`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{warning.productName}</span>
                        <span className="text-xs text-muted-foreground">
                          {warning.currentStock} left ({warning.daysUntilStockout === 999 ? "No sales" : `~${warning.daysUntilStockout} days`})
                        </span>
                      </div>
                      <Badge
                        variant={warning.severity === "critical" ? "destructive" : warning.severity === "warning" ? "secondary" : "outline"}
                        className={`text-[10px] ${warning.severity === "warning" ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30" : ""}`}
                      >
                        {warning.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  All products well-stocked
                </p>
              )}
            </div>

            {/* Daily Summary */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="w-4 h-4" />
                Daily Summary
              </div>
              {insightsLoading ? (
                <Skeleton className="h-36" />
              ) : aiInsights?.dailySummary ? (
                <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs text-muted-foreground">Cash</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(aiInsights.dailySummary.cashSales)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs text-muted-foreground">Card/Mobile</span>
                    </div>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(aiInsights.dailySummary.cardSales)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-500" />
                      <span className="text-xs text-muted-foreground">Credit</span>
                    </div>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(aiInsights.dailySummary.creditSales)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 mt-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">Total Transactions</span>
                      <span className="text-sm font-bold">{aiInsights.dailySummary.transactionCount}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No sales today
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Low Stock Items Table */}
      <Card data-testid="card-low-stock-table">
        <CardHeader className="p-3 md:p-4">
          <CardTitle className="text-base md:text-lg font-medium">Low Stock Items</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4 pt-0">
          {isLoading ? (
            <div className="space-y-2 md:space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 md:h-12 w-full" />
              ))}
            </div>
          ) : summary?.lowStockItems && summary.lowStockItems.length > 0 ? (
            <div className="overflow-x-auto -mx-3 md:-mx-4">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-medium text-muted-foreground">
                      Product Name
                    </th>
                    <th className="px-3 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-medium text-muted-foreground">
                      Current Stock
                    </th>
                    <th className="px-3 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-medium text-muted-foreground">
                      Min Level
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.lowStockItems.map((item, index) => (
                    <tr
                      key={item.id}
                      className={`border-b border-border ${
                        index % 2 === 0 ? "bg-muted/30" : ""
                      }`}
                      data-testid={`row-low-stock-${item.id}`}
                    >
                      <td className="px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-foreground">
                        {item.name}
                      </td>
                      <td className="px-3 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-bold text-amber-600 tabular-nums">
                        {item.stock}
                      </td>
                      <td className="px-3 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm text-muted-foreground tabular-nums">
                        {item.minStockLevel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 md:py-8 text-center">
              <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted mb-2 md:mb-3">
                <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground" />
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                All products are well-stocked
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating AI Assistant */}
      <div 
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50"
        data-testid="ai-assistant-floating"
      >
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-2xl shadow-lg p-3 md:p-4 max-w-[200px] md:max-w-[260px]">
          <div className="flex items-start gap-2 md:gap-3">
            <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] md:text-xs font-medium opacity-80 mb-0.5 md:mb-1">AI Assistant</p>
              <p className="text-xs md:text-sm leading-snug">
                {insightsLoading ? "Analyzing..." : aiInsights?.riskySummary ?? "All systems healthy."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
