import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye } from 'lucide-react';
import { Sale } from '@/types/sales';
import { useCurrency } from '@/hooks/use-currency';

interface SalesHistoryProps {
  sales: Sale[];
  salesLoading: boolean;
}

export function SalesHistory({ sales, salesLoading }: SalesHistoryProps) {
  const { formatCurrency } = useCurrency();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Sales</CardTitle>
      </CardHeader>
      <CardContent>
        {salesLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {sales.map((sale) => (
              <div key={sale.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">Sale #{sale.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sale.createdAt).toLocaleString()}
                    </p>
                    <p className="text-sm">
                      Payment: {sale.paymentMethod}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(Number(sale.total) || 0)}</p>
                    {sale.paymentSlipUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(sale.paymentSlipUrl, '_blank')}
                        className="mt-1"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
