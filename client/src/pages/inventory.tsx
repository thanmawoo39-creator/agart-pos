import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, AlertTriangle } from "lucide-react";
import type { Product } from "@shared/schema";

export default function Inventory() {
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Inventory
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Manage your product stock
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="p-3 md:p-4">
          <CardTitle className="text-base md:text-lg font-medium flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-500" />
            Product Inventory
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4 pt-0">
          {isLoading ? (
            <div className="space-y-2 md:space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="space-y-2 md:space-y-3">
              {products.map((product) => {
                const isLowStock = product.stock <= product.minStockLevel;
                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border"
                    data-testid={`card-product-${product.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-medium text-foreground truncate">
                          {product.name}
                        </h3>
                        {product.category && (
                          <Badge variant="secondary" className="text-[10px]">
                            {product.category}
                          </Badge>
                        )}
                        {isLowStock && (
                          <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Low Stock
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>Price: {formatCurrency(product.price)}</span>
                        {product.barcode && <span>SKU: {product.barcode}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold tabular-nums ${isLowStock ? 'text-amber-600' : 'text-foreground'}`}>
                        {product.stock}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Min: {product.minStockLevel}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                No Products Yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Add products to start tracking your inventory.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
