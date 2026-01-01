import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

export default function Sales() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
          Sales (POS)
        </h1>
        <p className="text-sm text-muted-foreground">
          Process customer transactions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Point of Sale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <ShoppingCart className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              POS Terminal Coming Soon
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              The point of sale terminal will allow you to process sales, add items to cart, and complete transactions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
