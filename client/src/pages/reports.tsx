import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { 
  BarChart3, 
  CreditCard, 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Calendar,
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Wallet
} from "lucide-react";
import type { Sale, ProfitLossReport, ExpenseCategory } from "@shared/schema";
import { format } from "date-fns";

interface RiskAnalysis {
  customerId: string;
  customerName: string;
  riskLevel: "low" | "high";
  riskFactors: string[];
  creditUtilization: number;
  daysSinceLastPayment: number | null;
  currentBalance: number;
  creditLimit: number;
}

type SortField = "timestamp" | "total" | "paymentMethod";
type SortDirection = "asc" | "desc";
type RiskSortField = "customerName" | "currentBalance" | "creditUtilization" | "riskLevel";

const categoryColors: Record<ExpenseCategory, string> = {
  Rent: "text-blue-600 dark:text-blue-400",
  Electricity: "text-yellow-600 dark:text-yellow-400",
  Fuel: "text-orange-600 dark:text-orange-400",
  Internet: "text-purple-600 dark:text-purple-400",
  Taxes: "text-red-600 dark:text-red-400",
  Other: "text-slate-600 dark:text-slate-400",
};

export default function Reports() {
  const now = new Date();
  const [pnlStartDate, setPnlStartDate] = useState(format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd"));
  const [pnlEndDate, setPnlEndDate] = useState(format(now, "yyyy-MM-dd"));
  
  const [salesSort, setSalesSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: "timestamp",
    direction: "desc",
  });
  const [riskSort, setRiskSort] = useState<{ field: RiskSortField; direction: SortDirection }>({
    field: "currentBalance",
    direction: "desc",
  });

  const { data: sales, isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  const { data: riskAnalysis, isLoading: riskLoading } = useQuery<RiskAnalysis[]>({
    queryKey: ["/api/ai/risk-analysis"],
  });

  const { data: pnlReport, isLoading: pnlLoading } = useQuery<ProfitLossReport>({
    queryKey: ["/api/reports/pnl", pnlStartDate, pnlEndDate],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFullDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Sort sales
  const sortedSales = sales ? [...sales].sort((a, b) => {
    let comparison = 0;
    switch (salesSort.field) {
      case "timestamp":
        comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        break;
      case "total":
        comparison = a.total - b.total;
        break;
      case "paymentMethod":
        comparison = a.paymentMethod.localeCompare(b.paymentMethod);
        break;
    }
    return salesSort.direction === "desc" ? -comparison : comparison;
  }) : [];

  // Sort risk analysis
  const sortedRiskAnalysis = riskAnalysis ? [...riskAnalysis].sort((a, b) => {
    let comparison = 0;
    switch (riskSort.field) {
      case "customerName":
        comparison = a.customerName.localeCompare(b.customerName);
        break;
      case "currentBalance":
        comparison = a.currentBalance - b.currentBalance;
        break;
      case "creditUtilization":
        comparison = a.creditUtilization - b.creditUtilization;
        break;
      case "riskLevel":
        comparison = a.riskLevel === "high" ? 1 : -1;
        if (b.riskLevel === "high") comparison = a.riskLevel === "high" ? 0 : -1;
        break;
    }
    return riskSort.direction === "desc" ? -comparison : comparison;
  }) : [];

  const handleSalesSort = (field: SortField) => {
    setSalesSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const handleRiskSort = (field: RiskSortField) => {
    setRiskSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const SortIcon = ({ field, currentSort }: { field: string; currentSort: { field: string; direction: SortDirection } }) => {
    if (currentSort.field !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    }
    return currentSort.direction === "desc" ? (
      <ChevronDown className="w-3 h-3" />
    ) : (
      <ChevronUp className="w-3 h-3" />
    );
  };

  // Calculate totals
  const totalReceivables = riskAnalysis?.reduce((sum, r) => sum + r.currentBalance, 0) ?? 0;
  const highRiskCount = riskAnalysis?.filter((r) => r.riskLevel === "high").length ?? 0;
  const lowRiskCount = riskAnalysis?.filter((r) => r.riskLevel === "low" && r.currentBalance > 0).length ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-foreground" data-testid="text-page-title">
          Reports
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Sales analytics and credit risk assessment
        </p>
      </div>

      {/* P&L Report Section */}
      <Card data-testid="card-pnl-report">
        <CardHeader className="p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base md:text-lg font-medium flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Profit & Loss Report
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={pnlStartDate}
                  onChange={(e) => setPnlStartDate(e.target.value)}
                  className="w-32 h-8 text-xs"
                  data-testid="input-pnl-start"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={pnlEndDate}
                  onChange={(e) => setPnlEndDate(e.target.value)}
                  className="w-32 h-8 text-xs"
                  data-testid="input-pnl-end"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4 pt-0">
          {pnlLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : pnlReport ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Revenue</span>
                  <span className="text-sm font-bold text-emerald-600">{formatCurrency(pnlReport.revenue)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Cost of Goods Sold</span>
                  <span className="text-sm font-medium text-red-500">-{formatCurrency(pnlReport.costOfGoodsSold)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b bg-muted/30 px-2 rounded">
                  <span className="text-sm font-medium">Gross Profit</span>
                  <span className={`text-sm font-bold ${pnlReport.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(pnlReport.grossProfit)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Total Expenses</span>
                  <span className="text-sm font-medium text-red-500">-{formatCurrency(pnlReport.totalExpenses)}</span>
                </div>
                <div className="flex justify-between items-center py-3 bg-indigo-500/10 px-3 rounded-lg">
                  <span className="text-base font-semibold">Net Profit</span>
                  <div className="text-right">
                    <span className={`text-lg font-bold ${pnlReport.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`} data-testid="text-net-profit">
                      {formatCurrency(pnlReport.netProfit)}
                    </span>
                    <div className="flex items-center gap-1 justify-end">
                      {pnlReport.netProfitMargin >= 0 ? (
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-500" />
                      )}
                      <span className={`text-xs ${pnlReport.netProfitMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {pnlReport.netProfitMargin.toFixed(1)}% margin
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-3">Expenses by Category</h4>
                <div className="space-y-2">
                  {Object.entries(pnlReport.expensesByCategory)
                    .filter(([, amount]) => amount > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, amount]) => (
                      <div key={category} className="flex justify-between items-center py-1.5">
                        <span className={`text-sm ${categoryColors[category as ExpenseCategory]}`}>{category}</span>
                        <span className="text-sm font-medium">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  {Object.values(pnlReport.expensesByCategory).every((v) => v === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-4">No expenses in this period</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No data available for this period</p>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-500/10">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Sales</p>
                <p className="text-lg font-bold">{sales?.length ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Receivables</p>
                <p className="text-lg font-bold">{formatCurrency(totalReceivables)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/10">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">High Risk</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{highRiskCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Low Risk</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{lowRiskCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Sales Log */}
      <Card data-testid="card-sales-log">
        <CardHeader className="p-3 md:p-4">
          <CardTitle className="text-base md:text-lg font-medium flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Daily Sales Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {salesLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sortedSales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="border-b-2 border-border bg-muted/30">
                    <th className="px-3 md:px-4 py-3 text-left">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium text-xs md:text-sm text-muted-foreground hover:text-foreground"
                        onClick={() => handleSalesSort("timestamp")}
                        data-testid="sort-timestamp"
                      >
                        Date/Time
                        <SortIcon field="timestamp" currentSort={salesSort} />
                      </Button>
                    </th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-muted-foreground">
                      Items
                    </th>
                    <th className="px-3 md:px-4 py-3 text-left">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium text-xs md:text-sm text-muted-foreground hover:text-foreground"
                        onClick={() => handleSalesSort("paymentMethod")}
                        data-testid="sort-payment"
                      >
                        Payment
                        <SortIcon field="paymentMethod" currentSort={salesSort} />
                      </Button>
                    </th>
                    <th className="px-3 md:px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium text-xs md:text-sm text-muted-foreground hover:text-foreground ml-auto"
                        onClick={() => handleSalesSort("total")}
                        data-testid="sort-total"
                      >
                        Total
                        <SortIcon field="total" currentSort={salesSort} />
                      </Button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSales.map((sale, index) => (
                    <tr
                      key={sale.id}
                      className={`border-b border-border ${index % 2 === 0 ? "bg-muted/20" : ""}`}
                      data-testid={`row-sale-${sale.id}`}
                    >
                      <td className="px-3 md:px-4 py-3 text-xs md:text-sm text-foreground">
                        <span className="hidden md:inline">{formatFullDate(sale.timestamp)}</span>
                        <span className="md:hidden">{formatDate(sale.timestamp)}</span>
                      </td>
                      <td className="px-3 md:px-4 py-3 text-xs md:text-sm text-muted-foreground">
                        {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
                      </td>
                      <td className="px-3 md:px-4 py-3">
                        <Badge
                          variant={
                            sale.paymentMethod === "credit"
                              ? "secondary"
                              : sale.paymentMethod === "cash"
                              ? "outline"
                              : "default"
                          }
                          className={`text-[10px] ${
                            sale.paymentMethod === "cash"
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                              : sale.paymentMethod === "credit"
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30"
                              : ""
                          }`}
                        >
                          {sale.paymentMethod}
                        </Badge>
                      </td>
                      <td className="px-3 md:px-4 py-3 text-right text-sm font-bold tabular-nums">
                        {formatCurrency(sale.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                <BarChart3 className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No sales recorded yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Outstanding Report */}
      <Card data-testid="card-credit-report">
        <CardHeader className="p-3 md:p-4">
          <CardTitle className="text-base md:text-lg font-medium flex items-center gap-2">
            <Users className="w-5 h-5" />
            Credit Outstanding Report
            <Badge variant="outline" className="ml-2 text-[10px]">
              AI Risk Analysis
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {riskLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sortedRiskAnalysis.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b-2 border-border bg-muted/30">
                    <th className="px-3 md:px-4 py-3 text-left">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium text-xs md:text-sm text-muted-foreground hover:text-foreground"
                        onClick={() => handleRiskSort("customerName")}
                        data-testid="sort-customer"
                      >
                        Customer
                        <SortIcon field="customerName" currentSort={riskSort} />
                      </Button>
                    </th>
                    <th className="px-3 md:px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium text-xs md:text-sm text-muted-foreground hover:text-foreground ml-auto"
                        onClick={() => handleRiskSort("currentBalance")}
                        data-testid="sort-balance"
                      >
                        Outstanding
                        <SortIcon field="currentBalance" currentSort={riskSort} />
                      </Button>
                    </th>
                    <th className="px-3 md:px-4 py-3 text-right text-xs md:text-sm font-medium text-muted-foreground">
                      Credit Limit
                    </th>
                    <th className="px-3 md:px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium text-xs md:text-sm text-muted-foreground hover:text-foreground ml-auto"
                        onClick={() => handleRiskSort("creditUtilization")}
                        data-testid="sort-utilization"
                      >
                        Utilization
                        <SortIcon field="creditUtilization" currentSort={riskSort} />
                      </Button>
                    </th>
                    <th className="px-3 md:px-4 py-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium text-xs md:text-sm text-muted-foreground hover:text-foreground"
                        onClick={() => handleRiskSort("riskLevel")}
                        data-testid="sort-risk"
                      >
                        AI Risk Status
                        <SortIcon field="riskLevel" currentSort={riskSort} />
                      </Button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRiskAnalysis.map((customer, index) => (
                    <tr
                      key={customer.customerId}
                      className={`border-b border-border ${index % 2 === 0 ? "bg-muted/20" : ""} ${
                        customer.riskLevel === "high" ? "bg-red-500/5" : ""
                      }`}
                      data-testid={`row-customer-${customer.customerId}`}
                    >
                      <td className="px-3 md:px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{customer.customerName}</p>
                          {customer.riskFactors.length > 0 && (
                            <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                              {customer.riskFactors[0]}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-3 text-right">
                        <span className={`text-sm font-bold tabular-nums ${
                          customer.currentBalance > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                        }`}>
                          {formatCurrency(customer.currentBalance)}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
                        {formatCurrency(customer.creditLimit)}
                      </td>
                      <td className="px-3 md:px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                customer.creditUtilization >= 90
                                  ? "bg-red-500"
                                  : customer.creditUtilization >= 70
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(customer.creditUtilization, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium tabular-nums w-10 text-right">
                            {customer.creditUtilization.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-3 text-center">
                        <Badge
                          variant={customer.riskLevel === "high" ? "destructive" : "secondary"}
                          className={`text-[10px] ${
                            customer.riskLevel === "low"
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                              : ""
                          }`}
                        >
                          {customer.riskLevel === "high" ? (
                            <>
                              <AlertCircle className="w-3 h-3 mr-1" />
                              High Risk
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Low Risk
                            </>
                          )}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                <CreditCard className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No customer credit data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
