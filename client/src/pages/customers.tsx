import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function Customers() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
          Customers
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage customer accounts and credit
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Customer Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Customer Management Coming Soon
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              You will be able to add customers, view their purchase history, and manage credit balances.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
