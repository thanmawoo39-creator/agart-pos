import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShoppingCart, Plus, Minus, Trash2, DollarSign, Users, Smartphone, Camera, CheckCircle, Printer, Receipt, Upload, AlertCircle, Check, Send, FileText, ChefHat, Bell, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import type { CartItem, Customer, Sale, Shift } from '@shared/schema';
import { API_BASE_URL } from '@/lib/api-config';
import { useCurrency } from '@/hooks/use-currency';
import { useToast } from '@/hooks/use-toast';
import ReceiptTemplate from '@/components/ReceiptTemplate';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// STRICT BUSINESS UNIT ISOLATION: Constants for separate checkout flows
// Restaurant = Full billing workflow with Bill button and receipt printing
// Grocery = Direct checkout without bill preview modal
const RESTAURANT_BUSINESS_UNIT_ID = '2';

type VerifyPaymentResponse = {
  success: boolean;
  amount?: number;
  transactionId?: string;
  warnings?: string[];
  raw?: string;
};

type SelectedTableLike = {
  id?: string;
  number?: string | null;
  serviceStatus?: string | null;
} | null;

interface CartSectionProps {
  cart: CartItem[];
  customers: Customer[];
  selectedCustomer: string;
  setSelectedCustomer: (customerId: string) => void;
  paymentMethod: Sale['paymentMethod'] | '';
  setPaymentMethod: React.Dispatch<React.SetStateAction<Sale['paymentMethod'] | ''>>;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  getTotal: () => number;
  completeSale: () => void;
  completeSaleMutation: any;
  showCameraModal: boolean;
  setShowCameraModal: (show: boolean) => void;
  lastSaleId?: string;
  lastSaleTotal?: number;
  paymentSlipUrl?: string;
  amountReceived: number;
  setAmountReceived: (amount: number) => void;
  onAfterPrint?: () => void;
  selectedTable?: SelectedTableLike;
  onSendToKitchen?: () => void;
  onScanCustomerClick?: () => void;
  isRestaurantMode?: boolean;
  customerSelectTriggerRef?: React.RefObject<HTMLButtonElement>;
  businessUnitId?: string;
  onKitchenOrderSent?: () => void;
}

export function CartSection({
  cart,
  customers,
  selectedCustomer,
  setSelectedCustomer,
  paymentMethod,
  setPaymentMethod,
  updateQuantity,
  removeFromCart,
  completeSale,
  completeSaleMutation,
  setShowCameraModal,
  amountReceived,
  setAmountReceived,
  onSendToKitchen,
  onScanCustomerClick,
  isRestaurantMode,
  selectedTable,
  customerSelectTriggerRef,
  businessUnitId,
  onKitchenOrderSent
}: CartSectionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentStaff } = useAuth();
  const { formatCurrency } = useCurrency();

  const isWaiter = currentStaff?.role === 'waiter';
  const isCashierLike = currentStaff?.role === 'cashier' || currentStaff?.role === 'manager' || currentStaff?.role === 'owner';

  // STRICT BUSINESS UNIT ISOLATION: Bill button and full receipt printing is ONLY for Restaurant
  // Grocery side uses Direct Checkout flow without Bill Preview modal
  const isRestaurantBusinessUnit = businessUnitId === RESTAURANT_BUSINESS_UNIT_ID;
  const showBillButton = isRestaurantMode && isRestaurantBusinessUnit && isCashierLike;

  // Query current shift
  const { data: currentShift } = useQuery<Shift | null>({
    queryKey: ['/api/shifts/current'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Query app settings for mobile payment QR
  const { data: appSettings } = useQuery({
    queryKey: ['/api/settings'],
  });

  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipImage, setSlipImage] = useState<string>('');
  const [slipVerification, setSlipVerification] = useState<VerifyPaymentResponse | null>(null);
  const [isVerifyingSlip, setIsVerifyingSlip] = useState(false);
  const slipInputRef = useRef<HTMLInputElement>(null);

  // Check Bill dialog state
  const [showCheckBillDialog, setShowCheckBillDialog] = useState(false);

  // QR dialog state for mobile payment
  const [showQRDialog, setShowQRDialog] = useState(false);

  // Kitchen order state - track what's been sent vs new items
  const [sentToKitchenIds, setSentToKitchenIds] = useState<Set<string>>(new Set());
  const [isKitchenSending, setIsKitchenSending] = useState(false);
  const [showKOTPrompt, setShowKOTPrompt] = useState(false);
  const [lastKitchenOrder, setLastKitchenOrder] = useState<{ items: CartItem[]; tableNumber: string } | null>(null);

  // Print Confirmation State
  const [showPrintConfirmation, setShowPrintConfirmation] = useState(false);

  const handleCompleteSaleWithConfirmation = () => {
    // GROCERY: Immediate checkout, no print dialog
    if (!isRestaurantMode) {
      completeSale();
      return;
    }

    // RESTAURANT: Ask if they want to print the bill
    setShowPrintConfirmation(true);
  };

  const handlePrintAndComplete = () => {
    // 🖨️ Print Receipt
    window.print();

    // Then Complete Sale
    setTimeout(() => {
      completeSale();
      setShowPrintConfirmation(false);
    }, 500);
  };

  // Calculate which items are new (not yet sent to kitchen)
  const newKitchenItems = useMemo(() => {
    return cart.filter(item => !sentToKitchenIds.has(item.id));
  }, [cart, sentToKitchenIds]);

  const hasNewKitchenItems = newKitchenItems.length > 0;
  const allItemsSent = cart.length > 0 && newKitchenItems.length === 0;

  // Reset sent items when table changes
  useEffect(() => {
    setSentToKitchenIds(new Set());
  }, [selectedTable?.id]);

  // Kitchen order mutation - 🚨 EMERGENCY STABILIZATION: Hardcoded businessUnitId
  const sendToKitchenMutation = useMutation({
    mutationFn: async ({ tableId, tableNumber, items }: { tableId: string; tableNumber: string; items: CartItem[] }) => {
      // 🚨 FORCED STABLE VALUE - No dynamic dependencies
      const HARDCODED_BUSINESS_UNIT_ID = '2'; // Updated to 2 (Restaurant)

      const res = await fetch(`${API_BASE_URL}/api/tables/${tableId}/order?businessUnitId=${HARDCODED_BUSINESS_UNIT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tableNumber,
          cart: items,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to send order to kitchen');
      return { ...data, sentItems: items };
    },
    onSuccess: (data) => {
      // Mark these items as sent
      const sentItems = data.sentItems as CartItem[];
      setSentToKitchenIds(prev => {
        const next = new Set(prev);
        sentItems.forEach(item => next.add(item.id));
        return next;
      });

      // Show success toast
      toast({
        title: '🔔 Order Sent to Kitchen!',
        description: `${sentItems.length} item(s) sent to Table ${selectedTable?.number}`,
      });

      // Store for KOT printing
      setLastKitchenOrder({
        items: sentItems,
        tableNumber: selectedTable?.number || ''
      });

      // Show KOT print prompt
      setShowKOTPrompt(true);

      // 🚨 Use hardcoded ID for query invalidation too
      const HARDCODED_BUSINESS_UNIT_ID = '2'; // Updated to 2

      // 🖨️ HW-SPECIALIST: Auto-print KOT
      import('@/lib/printer').then(({ printKOT }) => {
        printKOT({
          tableNumber: selectedTable?.number || 'Unknown',
          items: sentItems.map(i => ({ name: i.productName, quantity: i.quantity })),
          timestamp: new Date().toISOString(),
          businessUnitId: HARDCODED_BUSINESS_UNIT_ID
        });
      });

      // Invalidate queries to update table status
      queryClient.invalidateQueries({ queryKey: [`/api/tables?businessUnitId=${HARDCODED_BUSINESS_UNIT_ID}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/kitchen-tickets?businessUnitId=${HARDCODED_BUSINESS_UNIT_ID}`] });

      // Callback for parent component
      onKitchenOrderSent?.();
    },
    onError: (error) => {
      toast({
        title: 'Failed to send to kitchen',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  // Handle send to kitchen
  const handleSendToKitchen = () => {
    if (!selectedTable?.id || !selectedTable?.number || !hasNewKitchenItems) return;

    setIsKitchenSending(true);
    sendToKitchenMutation.mutate({
      tableId: selectedTable.id,
      tableNumber: selectedTable.number,
      items: newKitchenItems,
    });
    setIsKitchenSending(false);
  };

  // Print KOT (Kitchen Order Ticket)
  const printKOT = () => {
    if (!lastKitchenOrder) return;

    const kotWindow = window.open('', '_blank', 'width=300,height=400');
    if (!kotWindow) return;

    const kotHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Kitchen Order Ticket</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 10px; font-size: 14px; }
          h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
          h2 { text-align: center; font-size: 24px; margin: 10px 0; border: 2px solid black; padding: 5px; }
          .time { text-align: center; font-size: 12px; margin-bottom: 10px; }
          hr { border: 1px dashed black; }
          .item { display: flex; justify-content: space-between; padding: 5px 0; font-size: 16px; font-weight: bold; }
          .qty { font-size: 20px; font-weight: bold; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <h1>🍴 KITCHEN ORDER</h1>
        <h2>TABLE ${lastKitchenOrder.tableNumber}</h2>
        <div class="time">${new Date().toLocaleString()}</div>
        <hr />
        ${lastKitchenOrder.items.map(item => `
          <div class="item">
            <span class="qty">${item.quantity}x</span>
            <span>${item.name}</span>
          </div>
        `).join('')}
        <hr />
        <p style="text-align: center; font-weight: bold;">** NEW ORDER **</p>
        <script>window.print(); window.close();</script>
      </body>
      </html>
    `;

    kotWindow.document.write(kotHtml);
    kotWindow.document.close();
    setShowKOTPrompt(false);
  };

  const calculateTotal = () => {
    const total = cart.reduce((sum, item) => sum + ((Number(item.unitPrice) || 0) * item.quantity), 0);
    return total;
  };

  const formatPrice = (price: number) => {
    return formatCurrency(Number(price) || 0);
  };

  const handleSlipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, etc.)');
      return;
    }

    setSlipFile(file);
    setSlipVerification(null);

    // Preview the image
    const reader = new FileReader();
    reader.onload = (e) => {
      setSlipImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const verifySlip = async () => {
    if (!slipFile) return;

    const formData = new FormData();
    formData.append('image', slipFile);

    setIsVerifyingSlip(true);
    setSlipVerification(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/verify-payment`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const result = (await response.json().catch(() => ({}))) as VerifyPaymentResponse;
      if (!response.ok) {
        throw new Error((result as { error?: string })?.error || 'Failed to verify payment slip');
      }
      setSlipVerification(result);
    } catch (error) {
      console.error('Slip verify error:', error);
      setSlipVerification({
        success: false,
        warnings: [error instanceof Error ? error.message : 'Failed to verify payment slip'],
      });
    } finally {
      setIsVerifyingSlip(false);
    }
  };

  const isPaymentVerified = () => {
    if (paymentMethod !== 'mobile') return true; // Only mobile requires verification
    return slipVerification?.success === true;
  };

  // Calculate change
  const calculateChange = () => {
    const total = calculateTotal();
    const change = amountReceived - total;
    return change > 0 ? change : 0;
  };

  // Check if payment is sufficient
  const isPaymentSufficient = () => {
    if (paymentMethod !== 'cash') return true; // Only cash needs amount validation
    return amountReceived >= calculateTotal();
  };

  const hasOpenShift = () => {
    if (!currentStaff?.id || !currentShift) return false;
    // Check if current shift belongs to the current user
    const shift = currentShift as Shift;
    return shift.staffId === currentStaff.id && shift.status === 'open';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          {isRestaurantMode && selectedTable?.id
            ? `Current Order: Table ${selectedTable.number ?? ''}`
            : t('cart.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Shift Warning */}
        {!hasOpenShift() && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">Your shift is not open</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">Please open your shift first</p>
              </div>
            </div>
          </div>
        )}

        {cart.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">{t('cart.empty')}</p>
        ) : (
          <div className="space-y-4">
            {/* Cart Items - Scrollable Area */}
            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2">
              {cart.map((item) => {
                // Data guard: ensure price defaults to 0 if undefined/null
                const itemPrice = Number(item.unitPrice) || 0;
                return (
                  <div key={item.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                    {/* Product Info - Left Side */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate leading-tight">{item.name}</h4>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{formatPrice(itemPrice)} each</p>
                    </div>

                    {/* Quantity Controls - Center */}
                    <div className="flex items-center gap-1 bg-muted/30 rounded-md px-1 py-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 hover:bg-background"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-7 text-center font-semibold text-sm">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 hover:bg-background"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* Total Price - Right Side */}
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm font-mono whitespace-nowrap">{formatPrice(itemPrice * item.quantity)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals and Payment Section */}
            <div className="border-t-2 pt-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-muted-foreground">{t('cart.subtotal')}:</span>
                <span className="font-semibold font-mono">{formatPrice(calculateTotal())}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-muted-foreground">{t('cart.tax')} (0%):</span>
                <span className="font-semibold font-mono">{formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between items-center font-bold text-xl border-t-2 pt-3 bg-primary/5 -mx-4 px-4 py-3 rounded-lg">
                <span className="text-primary">{t('cart.grandTotal')}:</span>
                <span className="text-primary font-mono">{formatPrice(calculateTotal())}</span>
              </div>

              <div className="space-y-3">
                <div className="flex w-full items-center gap-2">
                  <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                    <SelectTrigger ref={customerSelectTriggerRef}>
                      <SelectValue placeholder={t('cart.selectCustomer')} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {onScanCustomerClick && (
                    <Button onClick={onScanCustomerClick} variant="outline" size="icon">
                      <Camera className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Waiter should not see payment UI */}
                {!isWaiter ? (
                  <div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <Button
                        variant={paymentMethod === 'cash' ? 'default' : 'secondary'}
                        onClick={() => setPaymentMethod('cash')}
                        className="h-12 flex items-center justify-center gap-2 bg-slate-800 text-white hover:bg-slate-700"
                      >
                        <DollarSign className="w-4 h-4" />
                        {t('cart.cash')}
                      </Button>
                      <Button
                        variant={paymentMethod === 'mobile' ? 'default' : 'secondary'}
                        onClick={() => setPaymentMethod('mobile')}
                        className="h-12 flex items-center justify-center gap-2 bg-slate-800 text-white hover:bg-slate-700"
                      >
                        <Smartphone className="w-4 h-4" />
                        {t('cart.mobile')}
                      </Button>
                      <Button
                        variant={paymentMethod === 'credit' ? 'default' : 'secondary'}
                        onClick={() => setPaymentMethod('credit')}
                        className="h-12 flex items-center justify-center gap-2 bg-slate-800 text-white hover:bg-slate-700"
                      >
                        <Users className="w-4 h-4" />
                        {t('cart.credit')}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {!isWaiter && paymentMethod === 'mobile' && (
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowQRDialog(true)}
                      className="w-full h-12"
                    >
                      <Smartphone className="w-4 h-4 mr-2" />
                      Show QR for Customer
                    </Button>

                    <div className="space-y-2">
                      <input
                        ref={slipInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSlipUpload}
                        className="hidden"
                        id="slip-upload"
                      />
                      <Button
                        variant="outline"
                        onClick={() => slipInputRef.current?.click()}
                        disabled={isVerifyingSlip}
                        className="w-full h-12"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload/Scan Slip
                      </Button>

                      <Button
                        onClick={verifySlip}
                        disabled={!slipFile || isVerifyingSlip}
                        className="w-full h-12"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {isVerifyingSlip ? 'Verifying...' : 'Verify QR'}
                      </Button>

                      {slipVerification ? (
                        <div
                          className={`p-3 rounded-lg flex items-center gap-2 ${slipVerification.success
                            ? 'bg-green-50 border border-green-200 text-green-800'
                            : 'bg-red-50 border border-red-200 text-red-800'
                            }`}
                        >
                          {slipVerification.success ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            <AlertCircle className="w-5 h-5" />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {slipVerification.success ? 'Payment Verified' : 'Verification Failed'}
                            </p>
                            {typeof slipVerification.amount === 'number' ? (
                              <p className="text-xs opacity-80">Amount: {formatPrice(slipVerification.amount)}</p>
                            ) : null}
                            {slipVerification.transactionId ? (
                              <p className="text-xs opacity-80">Txn: {slipVerification.transactionId}</p>
                            ) : null}
                            {Array.isArray(slipVerification.warnings) && slipVerification.warnings.length > 0 ? (
                              <p className="text-xs opacity-80">{slipVerification.warnings[0]}</p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {slipImage ? (
                        <div className="mt-2">
                          <img
                            src={slipImage}
                            alt="Payment slip"
                            className="w-full h-32 object-cover rounded-lg border"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {!isWaiter && paymentMethod === 'credit' && (
                  <Button
                    variant="outline"
                    onClick={() => setShowCameraModal(true)}
                    className="w-full h-12"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Capture Credit Note (I.O.U.)
                  </Button>
                )}

                {/* Amount Received Input (Cash Only) */}
                {!isWaiter && paymentMethod === 'cash' && (
                  <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                    <div className="space-y-2">
                      <Label htmlFor="amountReceived" className="text-sm font-medium">
                        Amount Received
                      </Label>
                      <Input
                        id="amountReceived"
                        type="number"
                        min="0"
                        step="0.01"
                        value={amountReceived || ''}
                        onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                        placeholder="Enter amount received"
                        className="text-lg font-mono h-12"
                      />
                    </div>

                    {amountReceived > 0 && (
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-sm font-medium">Change:</span>
                        <span className={`text-xl font-bold font-mono ${calculateChange() >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                          {formatCurrency(calculateChange())}
                        </span>
                      </div>
                    )}

                    {amountReceived > 0 && !isPaymentSufficient() && (
                      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-2 rounded">
                        <AlertCircle className="w-4 h-4" />
                        <span>Insufficient payment ({formatCurrency(calculateTotal() - amountReceived)} short)</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ACTION BUTTONS - 2x2 Grid Layout for compact display */}
                {isRestaurantMode && selectedTable?.id && cart.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    {/* Send to Kitchen Button */}
                    <Button
                      onClick={handleSendToKitchen}
                      disabled={
                        sendToKitchenMutation.isPending ||
                        isKitchenSending ||
                        !hasNewKitchenItems ||
                        !hasOpenShift()
                      }
                      className={`h-10 font-semibold text-sm transition-all duration-300 ${allItemsSent
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : hasNewKitchenItems
                          ? 'bg-orange-500 hover:bg-orange-600 text-white animate-pulse'
                          : 'bg-gray-400 text-gray-600'
                        }`}
                    >
                      {sendToKitchenMutation.isPending || isKitchenSending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : allItemsSent ? (
                        <span className="flex items-center justify-center gap-1"><ChefHat className="w-4 h-4" />Sent</span>
                      ) : (
                        <span className="flex items-center justify-center gap-1"><ChefHat className="w-4 h-4" />Kitchen</span>
                      )}
                    </Button>

                    {/* Check Bill Button - ONLY for Restaurant business unit (businessUnitId='2')
                        Grocery side uses Direct Checkout flow without Bill Preview modal */}
                    {showBillButton ? (
                      <Button
                        onClick={() => setShowCheckBillDialog(true)}
                        className="h-10 bg-blue-600 text-white hover:bg-blue-700 font-semibold text-sm"
                      >
                        <span className="flex items-center justify-center gap-1"><FileText className="w-4 h-4" />Bill</span>
                      </Button>
                    ) : (
                      <div /> /* Empty placeholder for grid alignment - Grocery doesn't have Bill button */
                    )}

                    {/* Quick Pay Button - Only for cashiers */}
                    {!isWaiter && isCashierLike && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          const total = calculateTotal();
                          setPaymentMethod('cash');
                          setAmountReceived(total);
                          handleCompleteSaleWithConfirmation();
                        }}
                        disabled={
                          completeSaleMutation.isPending ||
                          calculateTotal() <= 0 ||
                          !hasOpenShift()
                        }
                        className="h-10 text-sm font-semibold"
                      >
                        <span className="flex items-center justify-center gap-1"><DollarSign className="w-4 h-4" />Cash</span>
                      </Button>
                    )}

                    {/* Complete Sale Button - Only for cashiers */}
                    {!isWaiter && isCashierLike && (
                      <Button
                        onClick={handleCompleteSaleWithConfirmation}
                        disabled={
                          completeSaleMutation.isPending ||
                          !paymentMethod ||
                          calculateTotal() <= 0 ||
                          !isPaymentVerified() ||
                          !isPaymentSufficient() ||
                          !hasOpenShift()
                        }
                        className="h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm"
                      >
                        {completeSaleMutation.isPending ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                        ) : (
                          <span className="flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4" />Done</span>
                        )}
                      </Button>
                    )}
                  </div>
                )}

                {/* Waiter-only hint text */}
                {isRestaurantMode && selectedTable?.id && isWaiter && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {allItemsSent ? '✓ All items sent. Add more to send updates.' : hasNewKitchenItems ? 'Tap to fire order to kitchen' : ''}
                  </p>
                )}

                {/* Non-restaurant mode buttons (Grocery/Retail) */}
                {!isRestaurantMode && !isWaiter && isCashierLike ? (
                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const total = calculateTotal();
                        setPaymentMethod('cash');
                        setAmountReceived(total);
                        handleCompleteSaleWithConfirmation();
                      }}
                      disabled={
                        completeSaleMutation.isPending ||
                        calculateTotal() <= 0 ||
                        !hasOpenShift()
                      }
                      className="h-10 text-sm font-semibold"
                    >
                      <span className="flex items-center justify-center gap-1"><DollarSign className="w-4 h-4" />Cash</span>
                    </Button>

                    <Button
                      onClick={handleCompleteSaleWithConfirmation}
                      disabled={
                        completeSaleMutation.isPending ||
                        !paymentMethod ||
                        calculateTotal() <= 0 ||
                        !isPaymentVerified() ||
                        !isPaymentSufficient() ||
                        !hasOpenShift()
                      }
                      className="h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm"
                    >
                      {completeSaleMutation.isPending ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                      ) : (
                        <span className="flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4" />Done</span>
                      )}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* KOT Print Prompt Dialog */}
      <Dialog open={showKOTPrompt} onOpenChange={setShowKOTPrompt}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-6 h-6" />
              Order Sent Successfully!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-center text-muted-foreground">
              {lastKitchenOrder?.items.length} item(s) sent to kitchen for Table {lastKitchenOrder?.tableNumber}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowKOTPrompt(false)}
                className="flex-1"
              >
                Skip
              </Button>
              <Button
                onClick={printKOT}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print KOT
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Check Bill Dialog - PREVIEW STEP (80mm Slip) */}
      <Dialog open={showCheckBillDialog} onOpenChange={setShowCheckBillDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Bill Preview
            </DialogTitle>
          </DialogHeader>

          <div className="flex justify-center bg-gray-100 p-4 rounded-lg overflow-hidden">
            {/* 80mm Receipt Preview */}
            <ReceiptTemplate
              cartItems={cart.map(i => ({
                name: i.productName,
                quantity: i.quantity,
                price: Number(i.unitPrice) || 0,
                total: i.total
              }))}
              total={calculateTotal()}
              discount={0}
              paymentMethod={paymentMethod || 'cash'}
              date={new Date().toISOString()}
              orderId={selectedTable?.number ? `TBL-${selectedTable.number}` : 'NEW'}
              amountGiven={amountReceived}
              change={calculateChange()}
            />
          </div>

          <div className="space-y-4 pt-4">
            {/* Payment Method Selection inside Bill Preview */}
            <div className="space-y-2">
              <Label>Payment Method:</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  onClick={() => {
                    setPaymentMethod('cash');
                    setAmountReceived(calculateTotal()); // Auto-fill amount
                  }}
                  className="h-10"
                >
                  <DollarSign className="w-4 h-4 mr-1" />
                  Cash
                </Button>
                <Button
                  variant={paymentMethod === 'mobile' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('mobile')}
                  className="h-10"
                >
                  <Smartphone className="w-4 h-4 mr-1" />
                  Mobile
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCheckBillDialog(false)}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setShowCheckBillDialog(false);
                  handleCompleteSaleWithConfirmation();
                }}
                disabled={!paymentMethod || calculateTotal() <= 0}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Proceed to Pay
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Confirmation Dialog (Burmese) */}
      <AlertDialog open={showPrintConfirmation} onOpenChange={setShowPrintConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-xl font-bold">
              ဘောက်ချာ ထုတ်ပေးရမလား?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-lg">
              (Do you want to print the receipt?)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:justify-center">
            <AlertDialogCancel
              onClick={() => {
                setShowPrintConfirmation(false);
                completeSale(); // Save without printing
              }}
              className="flex-1 h-12 text-base font-semibold"
            >
              မထုတ်ပါ (No)
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePrintAndComplete}
              className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold"
            >
              ထုတ်မည် (Yes)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile Payment QR Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Show Payment QR to Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {appSettings?.mobilePaymentQrUrl ? (
              <div className="flex flex-col items-center gap-4">
                <img
                  src={appSettings.mobilePaymentQrUrl}
                  alt="Payment QR Code"
                  className="w-64 h-64 object-contain border-2 border-gray-200 rounded-lg"
                />
                <div className="text-center">
                  <p className="font-bold text-2xl text-primary mb-1">
                    {formatPrice(calculateTotal())}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Customer should scan and pay this amount
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowQRDialog(false)}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <Smartphone className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No payment QR code configured. Please add one in System Settings.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowQRDialog(false)}
                  className="mt-4"
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card >
  );
}
