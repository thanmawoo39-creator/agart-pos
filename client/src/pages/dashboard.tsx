import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, CreditCard, AlertTriangle } from "lucide-react";
import type { DashboardSummary } from "@shared/schema";

export default function Dashboard() {
  const { data: summary, isLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard/summary"],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground" data-testid="text-page-date">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card data-testid="card-total-sales">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sales Today
            </CardTitle>
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <div className="text-3xl font-bold tabular-nums text-foreground" data-testid="text-total-sales">
                {formatCurrency(summary?.totalSalesToday ?? 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Revenue for today</p>
          </CardContent>
        </Card>

        <Card data-testid="card-credit-balance">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Credit Balance
            </CardTitle>
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-chart-2/10">
              <CreditCard className="w-5 h-5 text-chart-2" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <div className="text-3xl font-bold tabular-nums text-foreground" data-testid="text-credit-balance">
                {formatCurrency(summary?.totalCreditBalance ?? 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Outstanding credit</p>
          </CardContent>
        </Card>

        <Card data-testid="card-low-stock">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Stock Items
            </CardTitle>
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className="text-3xl font-bold tabular-nums text-foreground" data-testid="text-low-stock-count">
                {summary?.lowStockItems?.length ?? 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Items need restock</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-low-stock-table">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Low Stock Items</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : summary?.lowStockItems && summary.lowStockItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Product Name
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                      Current Stock
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                      Reorder Level
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
                      <td className="px-4 py-3 text-sm text-foreground">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-destructive tabular-nums">
                        {item.stock}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
                        {item.reorderLevel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                <AlertTriangle className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                All products are well-stocked
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
