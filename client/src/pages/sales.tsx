import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { ShiftButton } from "@/components/shift-button";
import {
  ShoppingCart,
  Search,
  User,
  Trash2,
  Plus,
  Minus,
  Banknote,
  Smartphone,
  CreditCard,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  X,
  Sparkles,
  Zap,
  Clock,
} from "lucide-react";
import type { Product, Customer, InsertSale, SaleItem, CurrentShift } from "@shared/schema";

export default function Sales() {
  const { toast } = useToast();
  const { currentStaff, isCashier } = useAuth();
  const [scanInput, setScanInput] = useState("");
  const [customerScanInput, setCustomerScanInput] = useState("");
  const [lastScannedProduct, setLastScannedProduct] = useState<string | null>(null);
  
  // Global barcode scanner state
  const barcodeBuffer = useRef<string>("");
  const barcodeTimeout = useRef<NodeJS.Timeout | null>(null);

  // Check if someone is clocked in
  const { data: currentShift, isLoading: shiftLoading } = useQuery<CurrentShift>({
    queryKey: ["/api/attendance/current"],
    refetchInterval: 30000,
  });
  
  const {
    items,
    linkedCustomer,
    discount,
    addItem,
    removeItem,
    updateQuantity,
    setLinkedCustomer,
    clearCart,
    getSubtotal,
    getTax,
    getTotal,
    getItemCount,
    alerts,
    addAlert,
    clearAlerts,
    setAlerts,
  } = useStore();

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Check AI alerts when cart or customer changes
  useEffect(() => {
    const newAlerts: { type: "warning" | "tip" | "success"; message: string }[] = [];

    // Check credit limit if customer is linked
    if (linkedCustomer) {
      const total = getTotal();
      const potentialBalance = linkedCustomer.currentBalance + total;
      if (potentialBalance > linkedCustomer.creditLimit && linkedCustomer.creditLimit > 0) {
        newAlerts.push({
          type: "warning",
          message: `High Risk: Customer ${linkedCustomer.name} is near credit limit.`,
        });
      }
    }

    // Check low stock for items in cart
    items.forEach((item) => {
      if (item.product && item.product.stock < 5) {
        newAlerts.push({
          type: "tip",
          message: `Low stock! ${item.product.name} has only ${item.product.stock} units. Remind owner to restock soon.`,
        });
      }
    });

    setAlerts(newAlerts);
  }, [items, linkedCustomer, getTotal, setAlerts]);

  // Handle product scan
  const handleScan = useCallback(
    async (barcode: string) => {
      if (!barcode.trim()) return;

      try {
        const response = await fetch(`/api/scan/product/${encodeURIComponent(barcode)}`);
        if (response.ok) {
          const product: Product = await response.json();
          addItem(product, 1);
          toast({
            title: "Product Added",
            description: `${product.name} added to cart`,
          });
          
          // Check low stock alert
          if (product.stock < 5) {
            addAlert({
              type: "tip",
              message: `Low stock! ${product.name} has only ${product.stock} units. Remind owner to restock soon.`,
            });
          }
        } else {
          toast({
            title: "Product Not Found",
            description: `No product found with barcode: ${barcode}`,
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Scan Error",
          description: "Failed to scan product",
          variant: "destructive",
        });
      }
      setScanInput("");
    },
    [addItem, addAlert, toast]
  );

  // Global barcode scanner listener
  // Barcode scanners typically send characters very rapidly followed by Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Clear previous timeout
      if (barcodeTimeout.current) {
        clearTimeout(barcodeTimeout.current);
      }

      // Handle Enter key - process the barcode
      if (e.key === "Enter" && barcodeBuffer.current.length > 0) {
        const barcode = barcodeBuffer.current;
        barcodeBuffer.current = "";
        handleScan(barcode);
        setLastScannedProduct(barcode);
        // Clear highlight after 2 seconds
        setTimeout(() => setLastScannedProduct(null), 2000);
        return;
      }

      // Only accumulate alphanumeric characters
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        barcodeBuffer.current += e.key;
        
        // Reset buffer after 100ms of inactivity (scanner is very fast)
        barcodeTimeout.current = setTimeout(() => {
          barcodeBuffer.current = "";
        }, 100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (barcodeTimeout.current) {
        clearTimeout(barcodeTimeout.current);
      }
    };
  }, [handleScan]);

  // Handle customer scan
  const handleCustomerScan = useCallback(
    async (barcode: string) => {
      if (!barcode.trim()) return;

      try {
        const response = await fetch(`/api/scan/customer/${encodeURIComponent(barcode)}`);
        if (response.ok) {
          const customer: Customer = await response.json();
          setLinkedCustomer(customer);
          toast({
            title: "Customer Linked",
            description: `${customer.name} linked to this sale`,
          });
        } else {
          toast({
            title: "Customer Not Found",
            description: `No customer found with barcode: ${barcode}`,
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Scan Error",
          description: "Failed to scan customer",
          variant: "destructive",
        });
      }
      setCustomerScanInput("");
    },
    [setLinkedCustomer, toast]
  );

  // Complete sale mutation
  const completeSaleMutation = useMutation({
    mutationFn: async (paymentMethod: "cash" | "card" | "credit") => {
      if (items.length === 0) throw new Error("Cart is empty");
      if (paymentMethod === "credit" && !linkedCustomer) {
        throw new Error("Credit payment requires a linked customer");
      }

      const saleItems: SaleItem[] = items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      }));

      const saleData: InsertSale = {
        items: saleItems,
        subtotal: getSubtotal(),
        discount: discount,
        tax: getTax(),
        total: getTotal(),
        paymentMethod,
        customerId: linkedCustomer?.id,
        storeId: "store-001",
        timestamp: new Date().toISOString(),
        createdBy: currentShift?.staffName || currentStaff?.name || "Unknown",
      };

      return apiRequest("POST", "/api/sales/complete", saleData);
    },
    onSuccess: (_, paymentMethod) => {
      toast({
        title: "Sale Completed",
        description: `Payment received via ${paymentMethod}`,
      });
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credit-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sale Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePayment = (method: "cash" | "card" | "credit") => {
    // Validate credit payment
    if (method === "credit") {
      if (!linkedCustomer) {
        toast({
          title: "Customer Required",
          description: "Please link a customer before using credit payment",
          variant: "destructive",
        });
        return;
      }
      // Check if sale exceeds credit limit
      const newBalance = linkedCustomer.currentBalance + getTotal();
      if (linkedCustomer.creditLimit > 0 && newBalance > linkedCustomer.creditLimit) {
        toast({
          title: "Credit Limit Exceeded",
          description: `This sale would exceed ${linkedCustomer.name}'s credit limit`,
          variant: "destructive",
        });
        return;
      }
    }
    completeSaleMutation.mutate(method);
  };

  // Show shift required block if no one is clocked in
  if (!shiftLoading && (!currentShift || !currentShift.isActive)) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">No Active Shift</h2>
                <p className="text-sm text-muted-foreground">
                  A staff member must clock in before processing sales. 
                  Use the button below to start a shift.
                </p>
              </div>
              <ShiftButton />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Shift Status Bar */}
      <div className="flex items-center justify-between gap-4 px-3 py-2 md:px-4 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {currentShift?.staffName} on shift
          </span>
        </div>
        <ShiftButton />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 md:p-4 overflow-hidden">
        {/* Left: Product Grid */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Scan Input */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Scan product barcode..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleScan(scanInput);
                }}
                className="pl-10"
                data-testid="input-product-scan"
              />
            </div>
            <Button onClick={() => handleScan(scanInput)} data-testid="button-scan-product">
              Scan
            </Button>
          </div>

          {/* Product Grid */}
          <Card className="flex-1 overflow-hidden">
            <CardHeader className="p-3">
              <CardTitle className="text-sm font-medium">Quick Add Products</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 overflow-auto max-h-[calc(100%-3rem)]">
              {productsLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : products && products.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {products.map((product) => {
                    const isRecentlyScanned = lastScannedProduct === product.barcode;
                    return (
                    <Button
                      key={product.id}
                      variant="outline"
                      className={`h-auto py-3 px-3 flex flex-col items-start gap-1 text-left transition-all ${isRecentlyScanned ? "ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950" : ""}`}
                      onClick={() => {
                        addItem(product, 1);
                        setLastScannedProduct(product.barcode || null);
                        setTimeout(() => setLastScannedProduct(null), 2000);
                        if (product.stock < 5) {
                          addAlert({
                            type: "tip",
                            message: `Low stock! ${product.name} has only ${product.stock} units. Remind owner to restock soon.`,
                          });
                        }
                      }}
                      data-testid={`button-product-${product.id}`}
                    >
                      <span className="text-xs font-medium line-clamp-2">{product.name}</span>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                          {formatCurrency(product.price)}
                        </span>
                        {product.stock < 5 && (
                          <Badge variant="secondary" className="text-[9px]">
                            Low
                          </Badge>
                        )}
                      </div>
                    </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No products available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Cart & Payment */}
        <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-3 min-h-0">
          {/* Customer Association */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {linkedCustomer ? (
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{linkedCustomer.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Balance: {formatCurrency(linkedCustomer.currentBalance)} / Limit: {formatCurrency(linkedCustomer.creditLimit)}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setLinkedCustomer(null)}
                    data-testid="button-remove-customer"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Scan customer barcode..."
                    value={customerScanInput}
                    onChange={(e) => setCustomerScanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCustomerScan(customerScanInput);
                    }}
                    className="text-sm"
                    data-testid="input-customer-scan"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleCustomerScan(customerScanInput)}
                    data-testid="button-scan-customer"
                  >
                    Link
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cart */}
          <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Cart ({getItemCount()})
                </CardTitle>
                {items.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearCart}
                    className="text-destructive"
                    data-testid="button-clear-cart"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 flex-1 overflow-auto">
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Cart is empty
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"
                      data-testid={`cart-item-${item.productId}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.productName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatCurrency(item.unitPrice)} each
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          data-testid={`button-decrease-${item.productId}`}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium tabular-nums">
                          {item.quantity}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          data-testid={`button-increase-${item.productId}`}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-bold tabular-nums min-w-[60px] text-right">
                        {formatCurrency(item.total)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeItem(item.productId)}
                        data-testid={`button-remove-${item.productId}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Totals & Payment */}
          <Card>
            <CardContent className="p-3 space-y-3">
              {/* Totals */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(getSubtotal())}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span className="tabular-nums">-{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (8%)</span>
                  <span className="tabular-nums">{formatCurrency(getTax())}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span className="tabular-nums text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(getTotal())}
                  </span>
                </div>
              </div>

              {/* Payment Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  className="h-14 flex-col gap-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handlePayment("cash")}
                  disabled={items.length === 0 || completeSaleMutation.isPending}
                  data-testid="button-pay-cash"
                >
                  <Banknote className="w-5 h-5" />
                  <span className="text-xs">Cash</span>
                </Button>
                <Button
                  className="h-14 flex-col gap-1 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => handlePayment("card")}
                  disabled={items.length === 0 || completeSaleMutation.isPending}
                  data-testid="button-pay-card"
                >
                  <Smartphone className="w-5 h-5" />
                  <span className="text-xs">Mobile</span>
                </Button>
                <Button
                  className="h-14 flex-col gap-1 bg-amber-600 hover:bg-amber-700"
                  onClick={() => handlePayment("credit")}
                  disabled={items.length === 0 || !linkedCustomer || completeSaleMutation.isPending}
                  data-testid="button-pay-credit"
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-xs">Credit</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Suggestion Box - Fixed at bottom */}
      {alerts.length > 0 && (
        <div className="border-t bg-background p-3 md:p-4" data-testid="ai-suggestions-box">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">AI Suggestions</p>
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                    alert.type === "warning"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : alert.type === "tip"
                      ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  }`}
                  data-testid={`alert-${alert.type}-${index}`}
                >
                  {alert.type === "warning" ? (
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : alert.type === "tip" ? (
                    <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={clearAlerts}
              className="flex-shrink-0"
              data-testid="button-dismiss-alerts"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
