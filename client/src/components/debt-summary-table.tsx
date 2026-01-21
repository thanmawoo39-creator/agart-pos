import type { Customer } from "@shared/schema";
import type { UseMutationResult } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/hooks/use-currency";

type DebtSummaryTableProps = {
  debtors: Customer[];
  repaymentAmounts: { [key: string]: string };
  isLoading: boolean;
  repayMutation: UseMutationResult<any, Error, { customerId: string; amount: number; }, unknown>;
  onRepaymentChange: (customerId: string, amount: string) => void;
  onRepay: (customerId: string) => void;
  onSelectCustomer: (customer: Customer) => void;
};

export function DebtSummaryTable({
  debtors,
  repaymentAmounts,
  isLoading,
  repayMutation,
  onRepaymentChange,
  onRepay,
  onSelectCustomer,
}: DebtSummaryTableProps) {
  const { formatCurrency } = useCurrency();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead className="text-right">Outstanding Debt</TableHead>
          <TableHead className="w-[150px]">Repay Amount</TableHead>
          <TableHead className="w-[100px]">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-5 w-24" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-9 w-full" /></TableCell>
              <TableCell><Skeleton className="h-9 w-full" /></TableCell>
            </TableRow>
          ))
        ) : debtors.length > 0 ? (
          debtors.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell>
                <Button
                  variant="ghost"
                  className="p-0 h-auto"
                  onClick={() => onSelectCustomer(customer)}
                >
                  {customer.name}
                </Button>
              </TableCell>
              <TableCell className="text-right font-medium text-red-600">
                {formatCurrency(customer.currentBalance)}
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  placeholder="Amount"
                  value={repaymentAmounts[customer.id] || ""}
                  onChange={(e) => onRepaymentChange(customer.id, e.target.value)}
                  min="0"
                  max={customer.currentBalance}
                />
              </TableCell>
              <TableCell>
                <Button
                  onClick={() => onRepay(customer.id)}
                  disabled={repayMutation.isPending || !repaymentAmounts[customer.id] || parseFloat(repaymentAmounts[customer.id]) <= 0}
                >
                  Repay
                </Button>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={4} className="text-center h-24">
              No customers with outstanding debt.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
