import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { useBusinessMode } from "@/contexts/BusinessModeContext";
import {
  ArrowLeft,
  User,
  CreditCard,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Phone,
  Mail,
  Barcode,
} from "lucide-react";
import type { Customer, CreditLedger } from "@shared/schema";

export default function CustomerProfile() {
  const { toast } = useToast();
  const { currentStaff } = useAuth();
  const { businessUnit } = useBusinessMode();
  const businessUnitId = businessUnit;
  const [, params] = useRoute("/customers/:id");
  const customerId = params?.id;
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const { data: customer, isLoading: customerLoading } = useQuery<Customer>({
    queryKey: [`/api/customers/${customerId}?businessUnitId=${businessUnitId}`],
    enabled: !!customerId && !!businessUnitId,
  });

  const { data: ledgerEntries, isLoading: ledgerLoading } = useQuery<CreditLedger[]>({
    queryKey: [`/api/customers/${customerId}/ledger?businessUnitId=${businessUnitId}`],
    enabled: !!customerId && !!businessUnitId,
  });

  const addPaymentMutation = useMutation({
    mutationFn: async (amount: number) => {
      return apiRequest("POST", `/api/customers/${customerId}/repayment`, {
        amount,
        businessUnitId,
        createdBy: currentStaff?.name || "Unknown"
      });
    },
    onSuccess: () => {
      toast({
        title: "Repayment Recorded",
        description: "Repayment has been recorded successfully",
      });
      setPaymentAmount("");
      setIsPaymentDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}?businessUnitId=${businessUnitId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/ledger?businessUnitId=${businessUnitId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
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
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (customerLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <h3 className="text-lg font-medium text-foreground mb-2">
            Customer Not Found
          </h3>
          <Link href="/customers">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Customers
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isHighRisk = customer.riskTag === "high" ||
    (customer.creditLimit > 0 && customer.currentBalance > customer.creditLimit * 0.8);
  const creditUsagePercent = customer.creditLimit > 0
    ? Math.min(100, (customer.currentBalance / customer.creditLimit) * 100)
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/customers">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-semibold text-foreground" data-testid="text-customer-name">
            {customer.name}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Customer Profile
          </p>
        </div>
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-payment">
              <DollarSign className="w-4 h-4 mr-2" />
              Repayment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Record Repayment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Current Balance: <span className="font-bold text-foreground">{formatCurrency(customer.currentBalance)}</span>
                </p>
              </div>
              <Input
                type="number"
                placeholder="Repayment amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                data-testid="input-payment-amount"
              />
              <Button
                className="w-full"
                onClick={() => {
                  const amount = parseFloat(paymentAmount);
                  if (amount > 0) {
                    addPaymentMutation.mutate(amount);
                  }
                }}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || addPaymentMutation.isPending}
                data-testid="button-submit-payment"
              >
                {addPaymentMutation.isPending ? "Processing..." : "Record Repayment"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Customer Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/10">
                <User className="w-6 h-6 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Contact Info</p>
                <div className="space-y-1 mt-1">
                  {customer.phone && (
                    <p className="text-xs flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {customer.phone}
                    </p>
                  )}
                  {customer.email && (
                    <p className="text-xs flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {customer.email}
                    </p>
                  )}
                  {customer.barcode && (
                    <p className="text-xs flex items-center gap-1">
                      <Barcode className="w-3 h-3" />
                      <Badge variant="secondary" className="font-mono text-[10px]">{customer.barcode}</Badge>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className={`flex items-center justify-center w-12 h-12 rounded-full ${customer.currentBalance > 0 ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
                <CreditCard className={`w-6 h-6 ${customer.currentBalance > 0 ? "text-amber-500" : "text-emerald-500"}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className={`text-2xl font-bold tabular-nums ${customer.currentBalance > 0 ? "text-amber-600" : "text-foreground"}`}>
                  {formatCurrency(customer.currentBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className={`flex items-center justify-center w-12 h-12 rounded-full ${isHighRisk ? "bg-red-500/10" : "bg-indigo-500/10"}`}>
                {isHighRisk ? (
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                ) : (
                  <CreditCard className="w-6 h-6 text-indigo-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Credit Limit</p>
                <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(customer.creditLimit)}
                </p>
                {customer.creditLimit > 0 && (
                  <div className="mt-2">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${creditUsagePercent > 80 ? "bg-red-500" : creditUsagePercent > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${creditUsagePercent}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{creditUsagePercent.toFixed(0)}% used</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Ledger Table */}
      <Card>
        <CardHeader className="p-3 md:p-4">
          <CardTitle className="text-base md:text-lg font-medium flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-500" />
            Credit Ledger ({ledgerEntries?.length || 0} transactions)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ledgerLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : ledgerEntries && ledgerEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="pr-4 text-right">Running Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerEntries.map((entry, index) => {
                    const kind = (entry as any).transactionType || entry.type;
                    const isCharge = kind === "sale";
                    return (
                      <TableRow key={entry.id || index} data-testid={`row-ledger-${index}`}>
                        <TableCell className="pl-4 text-xs text-muted-foreground">
                          {formatDate(entry.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={isCharge ? "secondary" : "default"}
                            className="gap-1 text-[10px]"
                          >
                            {isCharge ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                            {isCharge ? "Sale" : "Repayment"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.description || (isCharge ? "Credit sale" : "Repayment")}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold tabular-nums ${isCharge ? "text-amber-600" : "text-emerald-600"}`}>
                            {isCharge ? "+" : "-"}{formatCurrency(Math.abs(entry.amount))}
                          </span>
                        </TableCell>
                        <TableCell className="pr-4 text-right text-sm tabular-nums">
                          {formatCurrency(entry.balanceAfter)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                <CreditCard className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No credit transactions yet
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
