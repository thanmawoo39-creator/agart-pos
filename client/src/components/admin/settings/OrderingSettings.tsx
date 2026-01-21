import { useState } from "react";
import QRCode from "react-qr-code";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingCart, UtensilsCrossed, Copy, ExternalLink, Plus, Trash2, Printer, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Table {
    id: string; // UUID in schema
    tableNumber: string;
    tableName?: string | null;
    isActive?: boolean;
}

export function OrderingSettings() {
    const { toast } = useToast();
    const [newTableNumber, setNewTableNumber] = useState("");
    const [newTableName, setNewTableName] = useState("");

    // URLs
    const lunchMenuUrl = window.location.origin + "/lunch-menu";

    // Fetch tables from simple endpoint (no business unit filtering)
    const { data: tables = [], isLoading: tablesLoading } = useQuery<Table[]>({
        queryKey: ["/api/restaurant-tables"],
        queryFn: async () => {
            const res = await fetch("/api/restaurant-tables", { credentials: "include" });
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Create table mutation
    const createTableMutation = useMutation({
        mutationFn: async (data: { tableNumber: string; tableName?: string }) => {
            const res = await apiRequest("POST", "/api/tables", data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/restaurant-tables"] });
            setNewTableNumber("");
            setNewTableName("");
            toast({ title: "Table Created", description: "New table added successfully." });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    // Delete table mutation
    const deleteTableMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("DELETE", `/api/tables/${id}`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/restaurant-tables"] });
            toast({ title: "Table Deleted", description: "Table removed successfully." });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const handleCreateTable = () => {
        if (!newTableNumber.trim()) {
            toast({ title: "Error", description: "Please enter a table number", variant: "destructive" });
            return;
        }
        createTableMutation.mutate({
            tableNumber: newTableNumber.trim(),
            tableName: newTableName.trim() || undefined,
        });
    };

    const copyToClipboard = (url: string, label: string) => {
        navigator.clipboard.writeText(url);
        toast({ title: "Copied", description: `${label} URL copied to clipboard` });
    };

    const getTableUrl = (tableNumber: string) => {
        return `${window.location.origin}/order/${tableNumber}`;
    };

    const handlePrintQR = (tableNumber: string, tableName?: string) => {
        const url = getTableUrl(tableNumber);
        const displayName = tableName || `Table ${tableNumber}`;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
        <html>
          <head>
            <title>QR Code - ${displayName}</title>
            <style>
              body { 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                min-height: 100vh; 
                margin: 0; 
                font-family: Arial, sans-serif;
              }
              .container { text-align: center; padding: 40px; }
              h1 { margin-bottom: 20px; font-size: 32px; }
              .qr-wrapper { background: white; padding: 20px; border: 2px solid #000; display: inline-block; }
              p { margin-top: 20px; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>${displayName}</h1>
              <div class="qr-wrapper" id="qr"></div>
              <p>Scan to order</p>
            </div>
            <script src="https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js"></script>
            <script>
              QRCode.toCanvas(document.createElement('canvas'), '${url}', { width: 300 }, function(err, canvas) {
                if (!err) document.getElementById('qr').appendChild(canvas);
                setTimeout(() => window.print(), 500);
              });
            </script>
          </body>
        </html>
      `);
            printWindow.document.close();
        }
    };

    return (
        <div className="space-y-6">
            {/* Lunch / Catering Menu QR */}
            <Card className="border-green-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-green-600" />
                        <CardTitle className="text-green-700">Lunch / Catering Menu</CardTitle>
                    </div>
                    <CardDescription>
                        Online ordering link for Lunch Sets and Catering pre-orders.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col items-center justify-center p-6 border rounded-lg bg-green-50">
                        <div className="mb-4 bg-white p-4 rounded-lg shadow-sm">
                            <QRCode
                                value={lunchMenuUrl}
                                size={160}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                viewBox={`0 0 256 256`}
                            />
                        </div>
                        <p className="font-mono text-xs mb-3 text-center text-slate-600">
                            {lunchMenuUrl}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(lunchMenuUrl, "Lunch Menu")}
                            >
                                <Copy className="w-4 h-4 mr-1" />
                                Copy
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(lunchMenuUrl, '_blank')}
                            >
                                <ExternalLink className="w-4 h-4 mr-1" />
                                Open
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table Management Section */}
            <Card className="border-blue-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <UtensilsCrossed className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-blue-700">Dine-In Table Management</CardTitle>
                    </div>
                    <CardDescription>
                        Create and manage tables with unique QR codes for dine-in ordering.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Add Table Form */}
                    <div className="flex flex-col sm:flex-row gap-3 p-4 border rounded-lg bg-slate-50">
                        <div className="flex-1">
                            <Label htmlFor="tableNumber" className="text-xs text-muted-foreground">
                                Table Number *
                            </Label>
                            <Input
                                id="tableNumber"
                                value={newTableNumber}
                                onChange={(e) => setNewTableNumber(e.target.value)}
                                placeholder="e.g. 1, 2, A1"
                                className="mt-1"
                            />
                        </div>
                        <div className="flex-1">
                            <Label htmlFor="tableName" className="text-xs text-muted-foreground">
                                Display Name (Optional)
                            </Label>
                            <Input
                                id="tableName"
                                value={newTableName}
                                onChange={(e) => setNewTableName(e.target.value)}
                                placeholder="e.g. Window Side, VIP Room"
                                className="mt-1"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button
                                type="button"
                                onClick={handleCreateTable}
                                disabled={createTableMutation.isPending}
                                className="w-full sm:w-auto"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                {createTableMutation.isPending ? "Adding..." : "Add Table"}
                            </Button>
                        </div>
                    </div>

                    {/* Tables List */}
                    {tablesLoading ? (
                        <p className="text-center text-muted-foreground py-8">Loading tables...</p>
                    ) : tables.length === 0 ? (
                        <div className="text-center py-8 border rounded-lg bg-slate-50">
                            <QrCode className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                            <p className="text-muted-foreground">No tables created yet.</p>
                            <p className="text-sm text-muted-foreground">Add a table above to generate QR codes.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {tables.map((table) => {
                                const tableUrl = getTableUrl(table.tableNumber);
                                const displayName = table.tableName || `Table ${table.tableNumber}`;

                                return (
                                    <Card key={table.id} className="border-slate-200">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-base">{displayName}</CardTitle>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => deleteTableMutation.mutate(table.id)}
                                                    disabled={deleteTableMutation.isPending}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">#{table.tableNumber}</p>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="flex justify-center bg-white p-3 rounded-lg border">
                                                <QRCode
                                                    value={tableUrl}
                                                    size={120}
                                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                                    viewBox={`0 0 256 256`}
                                                />
                                            </div>
                                            <p className="font-mono text-[10px] text-center text-slate-500 truncate">
                                                {tableUrl}
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1"
                                                    onClick={() => copyToClipboard(tableUrl, displayName)}
                                                >
                                                    <Copy className="w-3 h-3 mr-1" />
                                                    Copy
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1"
                                                    onClick={() => handlePrintQR(table.tableNumber, table.tableName || undefined)}
                                                >
                                                    <Printer className="w-3 h-3 mr-1" />
                                                    Print
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
