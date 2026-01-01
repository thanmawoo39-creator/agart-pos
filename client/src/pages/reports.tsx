import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function Reports() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
          Reports
        </h1>
        <p className="text-sm text-muted-foreground">
          View sales and inventory reports
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Analytics & Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Reports Coming Soon
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              View detailed sales reports, revenue trends, and inventory analytics.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
