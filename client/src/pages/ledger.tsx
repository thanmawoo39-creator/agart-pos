import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { CreditLedger } from "@shared/schema";

export default function Ledger() {
  const { data: entries, isLoading } = useQuery<CreditLedger[]>({
    queryKey: ["/api/credit-ledger"],
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

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Credit Ledger
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Track customer credit transactions
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="p-3 md:p-4">
          <CardTitle className="text-base md:text-lg font-medium flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-500" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4 pt-0">
          {isLoading ? (
            <div className="space-y-2 md:space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : entries && entries.length > 0 ? (
            <div className="space-y-2 md:space-y-3">
              {entries.map((entry) => {
                const isCharge = entry.type === "charge";
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border"
                    data-testid={`row-ledger-${entry.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full ${isCharge ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                        {isCharge ? (
                          <ArrowUpRight className="w-5 h-5 text-amber-500" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5 text-emerald-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-medium text-foreground">
                            {entry.customerName}
                          </h3>
                          <Badge variant={isCharge ? "secondary" : "default"} className="text-[10px]">
                            {isCharge ? "Charge" : "Payment"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.description || (isCharge ? "Credit purchase" : "Payment received")}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(entry.timestamp)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-base font-bold tabular-nums ${isCharge ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {isCharge ? '+' : '-'}{formatCurrency(Math.abs(entry.amount))}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Balance: {formatCurrency(entry.balanceAfter)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Receipt className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                No Transactions Yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Credit transactions will appear here when customers make credit purchases or payments.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
