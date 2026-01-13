import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownRight, X, Camera, Eye, ScanBarcode } from "lucide-react";
import type { Customer, CreditLedger, CurrentShift, SaleItem, EnrichedCreditLedger } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useBarcodeScanner, isCustomerCode } from "@/hooks/use-scanner";
import MobileScanner from "@/components/MobileScanner";
import { useBusinessMode } from "@/contexts/BusinessModeContext";
import { useCurrency } from "@/hooks/use-currency";

export default function DebtManagementDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { businessUnit } = useBusinessMode();
  const { formatCurrency } = useCurrency();
  const businessUnitId = businessUnit;

  const [repaymentAmounts, setRepaymentAmounts] = useState<{ [key: string]: string }>({});
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [voucherImage, setVoucherImage] = useState<string | null>(null); // Base64 image data
  const [voucherFileName, setVoucherFileName] = useState<string | null>(null);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false); // For viewing proof images

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setVoucherFileName(file.name);

      // Convert file to Base64 for preview and temporary storage
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setVoucherImage(base64String);
      };
      reader.onerror = () => {
        toast({
          title: "Error reading image",
          description: "Failed to read the selected image file.",
          variant: "destructive",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveVoucher = () => {
    setVoucherImage(null);
    setVoucherFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSheetClose = (open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
      // Clear voucher image when sheet closes
      setVoucherImage(null);
      setVoucherFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const { data: customers, isLoading: isLoadingCustomers } = useQuery<Customer[]>({
    queryKey: [`/api/customers?businessUnitId=${businessUnitId}`] as const,
    enabled: !!businessUnitId,
  });

  const { data: currentShift } = useQuery<CurrentShift>({
    queryKey: ["/api/attendance/current"] as const,
  });

  const { data: ledgerEntries, isLoading: isLoadingLedger } = useQuery<EnrichedCreditLedger[]>({
    queryKey: [`/api/customers/${selectedCustomer?.id}/ledger?businessUnitId=${businessUnitId}`] as const,
    enabled: !!selectedCustomer && !!businessUnitId,
  });

  // Query to get all credit sales for the main view
  const { data: allCreditSales, isLoading: isLoadingAllSales } = useQuery<EnrichedCreditLedger[]>({
    queryKey: ["/api/ledger", "credit-sales", businessUnitId] as const,
  });

  const repayMutation = useMutation({
    mutationFn: async ({ customerId, amount }: { customerId: string; amount: number }) => {
      const response = await fetch(`/api/customers/${customerId}/repay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amount,
          businessUnitId,
          description: "Debt Repayment",
          createdBy: (currentShift?.staffName ?? undefined) || "System"
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process repayment");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Repayment Successful",
        description: `Successfully processed repayment for customer.`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/customers?businessUnitId=${businessUnitId}`] });
      queryClient.invalidateQueries({
        queryKey: [`/api/customers/${variables.customerId}/ledger?businessUnitId=${businessUnitId}`],
      });
      setRepaymentAmounts((prev) => ({ ...prev, [variables.customerId]: "" }));
    },
    onError: (error: Error) => {
      toast({
        title: "Repayment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRepaymentChange = (customerId: string, amount: string) => {
    setRepaymentAmounts((prev) => ({ ...prev, [customerId]: amount }));
  };

  const handleRepay = (customerId: string) => {
    const amountStr = repaymentAmounts[customerId] || "0";
    const amount = parseFloat(amountStr);
    if (amount > 0) {
      repayMutation.mutate({ customerId, amount });
    }
  };

  const openCustomerLedger = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsSheetOpen(true);
  };

  // Smart Barcode Scanner - Automatically opens repayment dialog when customer card is scanned
  const handleBarcodeScan = (scannedCode: string) => {
    console.log('🔍 Ledger: Barcode scanned:', scannedCode);

    // Check if this is a customer code (starts with "C-")
    if (isCustomerCode(scannedCode)) {
      // Find customer by memberId, barcode, phone, or ID
      const foundCustomer = customers?.find(c =>
        c.memberId?.toUpperCase() === scannedCode.toUpperCase() ||
        c.barcode === scannedCode ||
        c.phone === scannedCode ||
        c.id === scannedCode
      );

      if (foundCustomer) {
        // Automatically open the repayment dialog
        openCustomerLedger(foundCustomer);

        // Show success notification
        const debtDisplay = (foundCustomer.currentBalance ?? 0) > 0
          ? `Debt: ${formatCurrency(foundCustomer.currentBalance ?? 0)}`
          : 'No Outstanding Debt';

        toast({
          title: `👤 Customer Found: ${foundCustomer.name}`,
          description: debtDisplay,
        });

        console.log('✅ Customer repayment dialog opened:', foundCustomer.name);
      } else {
        toast({
          title: "Customer Not Found",
          description: `No customer found with code: ${scannedCode}`,
          variant: "destructive",
        });
      }
    } else {
      // Not a customer code - ignore or show message
      toast({
        title: "Invalid Code",
        description: "Only customer codes (starting with C-) can be scanned on this page.",
        variant: "destructive",
      });
    }
  };

  // Enable barcode scanner
  useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: !isSheetOpen, // Disable scanner when sheet is open to avoid conflicts
  });

  const handleViewProof = (imageUrl: string) => {
    setProofImage(imageUrl);
  };

  const handleCloseProof = () => {
    setProofImage(null);
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: 'numeric',
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const debtors: Customer[] = customers?.filter((c) => c.currentBalance > 0) || [];

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-semibold">Debt Management Dashboard</h1>
        <Button onClick={() => setIsScannerOpen(true)} variant="outline">
          <ScanBarcode className="w-4 h-4 mr-2" />
          Scan Customer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding Balances</CardTitle>
        </CardHeader>
        <CardContent>
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
              {isLoadingCustomers ? (
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
                        onClick={() => openCustomerLedger(customer)}
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
                        onChange={(e) => handleRepaymentChange(customer.id, e.target.value)}
                        min="0"
                        max={customer.currentBalance}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => handleRepay(customer.id)}
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
        </CardContent>
      </Card>

      {/* Credit Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Credit Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingAllSales ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-9 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : allCreditSales && allCreditSales.length > 0 ? (
                allCreditSales
                  .filter(entry => entry.type === 'sale')
                  .map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          className="p-0 h-auto"
                          onClick={() => {
                            const customer = customers?.find(c => c.id === entry.customerId);
                            if (customer) openCustomerLedger(customer);
                          }}
                        >
                          {entry.customerName}
                        </Button>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(entry.timestamp)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {formatCurrency(entry.amount)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.description}
                      </TableCell>
                      <TableCell>
                        {entry.voucherImageUrl ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewProof(entry.voucherImageUrl!)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Proof
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled>
                            No Proof
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    No credit sales found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={isSheetOpen} onOpenChange={handleSheetClose}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Ledger for {selectedCustomer?.name}</SheetTitle>
            <div className="flex items-center gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <Camera className="w-4 h-4 mr-2" />
                Add Voucher Photo
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            {/* Voucher Image Preview */}
            {voucherImage && (
              <div className="mt-4 p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Voucher Photo Preview</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRemoveVoucher}
                    type="button"
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {voucherFileName && (
                  <p className="text-xs text-muted-foreground mb-2">{voucherFileName}</p>
                )}
                <div className="relative w-full rounded-md overflow-hidden border">
                  <img
                    src={voucherImage}
                    alt="Voucher preview"
                    className="w-full h-auto max-h-64 object-contain"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Image will be uploaded when you process the repayment.
                </p>
              </div>
            )}
          </SheetHeader>
          <div className="py-4 space-y-4">
            {isLoadingLedger ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : ledgerEntries && ledgerEntries.length > 0 ? (
              ledgerEntries.map((entry) => {
                const isCharge = entry.type === "sale";
                return (
                  <div key={entry.id} className={`p-3 rounded-lg border ${isCharge ? 'border-red-500/20 bg-red-500/5' : 'border-green-500/20 bg-green-500/5'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {isCharge ? (
                          <ArrowUpRight className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${isCharge ? 'text-red-600' : 'text-green-600'}`}>
                            {isCharge ? 'Sale' : 'Repayment'}: {formatCurrency(Math.abs(entry.amount))}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {entry.description || (isCharge ? "Credit sale" : "Repayment")}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDate(entry.timestamp)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <Badge variant={isCharge ? "destructive" : "outline"} className="capitalize">
                          {entry.type}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          Balance: {formatCurrency(entry.balanceAfter)}
                        </div>
                      </div>
                    </div>
                    {isCharge && entry.saleItems && entry.saleItems.length > 0 && (
                      <Card className="mt-3 bg-background/50">
                        <CardHeader className="p-2">
                          <p className="text-xs font-semibold text-muted-foreground">
                            Sale ID: <span className="font-mono">{entry.saleId}</span>
                          </p>
                        </CardHeader>
                        <CardContent className="p-2">
                          <ul className="space-y-1">
                            {entry.saleItems.map(item => (
                              item && item.productName && (
                                <li key={item?.productId} className="flex justify-between items-center text-xs">
                                  <span>{item?.productName} <span className="text-muted-foreground">x{item?.quantity}</span></span>
                                  <span className="font-mono">{formatCurrency(item?.total)}</span>
                                </li>
                              )
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                    {entry.voucherImageUrl && (
                      <div className="mt-3 p-2 border rounded-md bg-background/50">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Voucher Photo</p>
                        <div className="relative w-full rounded-md overflow-hidden border">
                          <img
                            src={entry.voucherImageUrl}
                            alt="Voucher"
                            className="w-full h-auto max-h-48 object-contain"
                            onError={(e) => {
                              // Hide image if it fails to load
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-center text-muted-foreground py-8">No ledger history found for this customer.</p>
            )}
          </div>
          <SheetFooter className="pt-4 border-t sticky bottom-0 bg-background">
            <div className="w-full flex justify-between items-center font-bold text-lg">
              <span>Current Balance:</span>
              <span className="text-red-600">{formatCurrency(selectedCustomer?.currentBalance ?? 0)}</span>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Proof Image Dialog */}
      {proofImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Credit Note Proof</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCloseProof}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4">
              <img
                src={proofImage}
                alt="Credit note proof"
                className="w-full h-auto max-h-[70vh] object-contain rounded"
              />
            </div>
            <div className="p-4 border-t">
              <Button onClick={handleCloseProof} className="w-full">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <MobileScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleBarcodeScan}
      />
    </div>
  );
}