import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

export default function Products() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
          Products
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your inventory
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Product Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Product Management Coming Soon
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              You will be able to add, edit, and manage your product catalog here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
