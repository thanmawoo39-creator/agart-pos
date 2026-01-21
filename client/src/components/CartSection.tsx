import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ShoppingCart, Plus, Minus, Trash2, DollarSign, Users, Smartphone,
  Camera, Eye, CheckCircle, X, AlertCircle
} from 'lucide-react';
import type { CartItem, Customer, Shift } from '@shared/schema';
import { useAuth } from '@/lib/auth-context';
import { API_BASE_URL } from '@/lib/api-config';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';

interface CartSectionProps {
  cart: CartItem[];
  customers: Customer[];
  selectedCustomer: string;
  setSelectedCustomer: (customerId: string) => void;
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  getTotal: () => number;
  completeSale: () => void;
  completeSaleMutation: { isPending: boolean };
  showMobilePayment: boolean;
  setShowMobilePayment: (show: boolean) => void;
  showCameraModal: boolean;
  setShowCameraModal: (show: boolean) => void;
  lastSaleId?: string;
  lastSaleTotal?: number;
  paymentSlipUrl?: string;
  amountReceived: number;
  setAmountReceived: (amount: number) => void;
  onAfterPrint?: () => void;
  onScanCustomerClick?: () => void;
  /** Mobile-first: When true, renders as a compact panel for bottom sheet */
  isMobileSheet?: boolean;
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
  getTotal,
  completeSale,
  completeSaleMutation,
  showMobilePayment,
  setShowMobilePayment,
  showCameraModal,
  setShowCameraModal,
  paymentSlipUrl,
  amountReceived,
  setAmountReceived,
  onScanCustomerClick,
  onAfterPrint,
  isMobileSheet = false,
}: CartSectionProps) {
  const { t } = useTranslation();
  const { currentStaff } = useAuth();
  const { formatCurrency } = useCurrency();

  // Query current shift
  const { data: currentShift } = useQuery<Shift | null>({
    queryKey: ['/api/shifts/current'],
    refetchInterval: 30000,
  });

  const [showQRDialog, setShowQRDialog] = useState(false);
  const [slipImage, setSlipImage] = useState<string>('');
  const [slipVerification, setSlipVerification] = useState<{
    verified: boolean;
    url: string;
    detectedAmount: number;
  } | null>(null);
  const [isVerifyingSlip, setIsVerifyingSlip] = useState(false);
  const slipInputRef = useRef<HTMLInputElement>(null);

  const calculateTotal = () => {
    const total = cart.reduce((sum, item) => {
      const unitPrice = Number(item.unitPrice ?? item.price) || 0;
      return sum + (unitPrice * item.quantity);
    }, 0);
    return total;
  };

  const formatPrice = (price: number) => {
    return formatCurrency(Number(price) || 0);
  };

  const handleSlipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, etc.)');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    setIsVerifyingSlip(true);
    setSlipVerification(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setSlipImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/verify-payment`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        const isVerified = result.isValid === true || result.verified === true;
        setSlipVerification({
          verified: isVerified,
          url: slipImage,
          detectedAmount: result.extractedAmount || result.detectedAmount || 0,
        });

        if (isVerified && result.extractedAmount) {
          setAmountReceived(result.extractedAmount);
        }
      } else {
        throw new Error(result.error || 'Failed to verify payment slip');
      }
    } catch (error) {
      console.error('Slip verification error:', error);
      setSlipVerification({
        verified: false,
        url: slipImage,
        detectedAmount: 0,
      });
    } finally {
      setIsVerifyingSlip(false);
    }
  };

  const isPaymentVerified = () => {
    if (paymentMethod !== 'mobile') return true;
    return slipVerification?.verified === true;
  };

  const calculateChange = () => {
    const total = calculateTotal();
    const change = amountReceived - total;
    return change > 0 ? change : 0;
  };

  const isPaymentSufficient = () => {
    if (paymentMethod !== 'cash') return true;
    return amountReceived >= calculateTotal();
  };

  const hasOpenShift = () => {
    if (!currentStaff?.id || !currentShift) return false;
    return currentShift.staffId === currentStaff.id && currentShift.status === 'open';
  };

  // Mobile-optimized wrapper
  const Wrapper = isMobileSheet ? 'div' : Card;
  const HeaderWrapper = isMobileSheet ? 'div' : CardHeader;
  const ContentWrapper = isMobileSheet ? 'div' : CardContent;

  return (
    <Wrapper className={cn(!isMobileSheet && "h-full flex flex-col")}>
      {/* Header */}
      <HeaderWrapper className={cn(
        isMobileSheet ? "px-4 py-3 border-b" : ""
      )}>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          {t('cart.title')}
          {cart.length > 0 && (
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {cart.length} {cart.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </CardTitle>
      </HeaderWrapper>

      <ContentWrapper className={cn(
        "flex flex-col flex-1 min-h-0",
        isMobileSheet ? "px-4 pb-4" : "space-y-4"
      )}>
        {/* Shift Warning */}
        {!hasOpenShift() && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 md:p-4 mb-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="font-semibold text-amber-800 dark:text-amber-200 text-sm md:text-base">
                  Your shift is not open
                </h3>
                <p className="text-xs md:text-sm text-amber-700 dark:text-amber-300">
                  Please open your shift first
                </p>
              </div>
            </div>
          </div>
        )}

        {cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="text-center">
              <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">{t('cart.empty')}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Cart Items - Scrollable Area */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 -mr-1 space-y-2 mb-4">
              {cart.map((item) => {
                const unitPrice = Number(item.unitPrice ?? item.price) || 0;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 md:gap-3 py-2 md:py-3 border-b last:border-0"
                  >
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{item.name}</h4>
                      <p className="text-xs text-muted-foreground font-mono">
                        {formatPrice(unitPrice)} each
                      </p>
                    </div>

                    {/* Quantity Controls - Touch-friendly sizing */}
                    <div className="flex items-center gap-1 bg-muted/30 rounded-lg px-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 min-h-[44px] min-w-[44px] md:h-8 md:w-8 md:min-h-0 md:min-w-0 hover:bg-background"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center font-semibold text-sm">
                        {item.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 min-h-[44px] min-w-[44px] md:h-8 md:w-8 md:min-h-0 md:min-w-0 hover:bg-background"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Total & Delete */}
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm font-mono whitespace-nowrap">
                        {formatPrice(unitPrice * item.quantity)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 min-h-[44px] min-w-[44px] md:h-8 md:w-8 md:min-h-0 md:min-w-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fixed Bottom Section - Totals and Checkout */}
            <div className="flex-shrink-0 border-t-2 pt-3 space-y-3 bg-background">
              {/* Totals */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{t('cart.subtotal')}:</span>
                  <span className="font-mono">{formatPrice(calculateTotal())}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{t('cart.tax')} (0%):</span>
                  <span className="font-mono">{formatCurrency(0)}</span>
                </div>
              </div>

              {/* Grand Total - Highlighted */}
              <div className="flex justify-between items-center font-bold text-lg md:text-xl bg-primary/5 -mx-4 px-4 py-3 rounded-lg">
                <span className="text-primary">{t('cart.grandTotal')}:</span>
                <span className="text-primary font-mono">{formatPrice(calculateTotal())}</span>
              </div>

              {/* Customer Selection */}
              <div className="flex w-full items-center gap-2">
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger className="h-12 min-h-[48px]">
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
                  <Button
                    onClick={onScanCustomerClick}
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 min-h-[48px] min-w-[48px]"
                  >
                    <Camera className="w-5 h-5" />
                  </Button>
                )}
              </div>

              {/* Payment Method Buttons - Touch-friendly */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={paymentMethod === 'cash' ? 'default' : 'secondary'}
                  onClick={() => setPaymentMethod('cash')}
                  className="h-14 min-h-[56px] flex flex-col items-center justify-center gap-1 bg-slate-800 text-white hover:bg-slate-700"
                >
                  <DollarSign className="w-5 h-5" />
                  <span className="text-xs">{t('cart.cash')}</span>
                </Button>
                <Button
                  variant={paymentMethod === 'mobile' ? 'default' : 'secondary'}
                  onClick={() => setPaymentMethod('mobile')}
                  className="h-14 min-h-[56px] flex flex-col items-center justify-center gap-1 bg-slate-800 text-white hover:bg-slate-700"
                >
                  <Smartphone className="w-5 h-5" />
                  <span className="text-xs">{t('cart.mobile')}</span>
                </Button>
                <Button
                  variant={paymentMethod === 'credit' ? 'default' : 'secondary'}
                  onClick={() => setPaymentMethod('credit')}
                  className="h-14 min-h-[56px] flex flex-col items-center justify-center gap-1 bg-slate-800 text-white hover:bg-slate-700"
                >
                  <Users className="w-5 h-5" />
                  <span className="text-xs">{t('cart.credit')}</span>
                </Button>
              </div>

              {/* Mobile Payment Section */}
              {paymentMethod === 'mobile' && (
                <div className="space-y-3 p-3 md:p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                    <Smartphone className="w-5 h-5" />
                    <span className="font-semibold text-sm md:text-base">Mobile Payment (QR/KPay)</span>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setShowQRDialog(true)}
                    className="w-full h-12 min-h-[48px] bg-white dark:bg-slate-800"
                  >
                    <Eye className="w-5 h-5 mr-2" />
                    Show QR Code
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-blue-200 dark:border-blue-700" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-blue-50 dark:bg-blue-950 px-2 text-blue-600 dark:text-blue-400">
                        After payment
                      </span>
                    </div>
                  </div>

                  {/* QR Verify Button - Fixed at bottom on mobile */}
                  <div className="space-y-2">
                    <input
                      ref={slipInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleSlipUpload}
                      className="hidden"
                      id="slip-upload"
                    />
                    <Button
                      onClick={() => slipInputRef.current?.click()}
                      disabled={isVerifyingSlip}
                      className={cn(
                        "w-full h-14 min-h-[56px] font-semibold text-base",
                        slipVerification?.verified
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      )}
                    >
                      {isVerifyingSlip ? (
                        <>
                          <div className="w-5 h-5 border-2 border-current border-t-transparent animate-spin rounded-full mr-2" />
                          Verifying...
                        </>
                      ) : slipVerification?.verified ? (
                        <>
                          <CheckCircle className="w-5 h-5 mr-2" />
                          Payment Verified
                        </>
                      ) : (
                        <>
                          <Camera className="w-5 h-5 mr-2" />
                          Verify QR Payment
                        </>
                      )}
                    </Button>

                    {/* Verification Result */}
                    {slipVerification && (
                      <div className={cn(
                        "p-3 rounded-lg flex items-start gap-3",
                        slipVerification.verified
                          ? 'bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-200'
                          : 'bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-200'
                      )}>
                        {slipVerification.verified ? (
                          <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">
                            {slipVerification.verified ? 'Payment Verified' : 'Verification Failed'}
                          </p>
                          {slipVerification.verified && slipVerification.detectedAmount > 0 && (
                            <p className="text-xs mt-1 opacity-80">
                              Amount: {formatCurrency(Number(slipVerification.detectedAmount) || 0)}
                            </p>
                          )}
                          {!slipVerification.verified && (
                            <p className="text-xs mt-1 opacity-80">
                              Try a clearer image
                            </p>
                          )}
                        </div>
                        {slipVerification.verified && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-green-200 dark:hover:bg-green-800"
                            onClick={() => {
                              setSlipVerification(null);
                              setSlipImage('');
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Slip Preview */}
                    {slipImage && !slipVerification?.verified && (
                      <div className="relative">
                        <img
                          src={slipImage}
                          alt="Payment slip"
                          className="w-full h-24 md:h-32 object-cover rounded-lg border"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2 h-8 w-8 p-0"
                          onClick={() => {
                            setSlipImage('');
                            setSlipVerification(null);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {!slipVerification?.verified && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
                      Upload payment slip to verify
                    </p>
                  )}
                </div>
              )}

              {/* Credit Payment */}
              {paymentMethod === 'credit' && (
                <Button
                  variant="outline"
                  onClick={() => setShowCameraModal(true)}
                  className="w-full h-12 min-h-[48px]"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Capture Credit Note (I.O.U.)
                </Button>
              )}

              {/* Cash Payment - Amount Received */}
              {paymentMethod === 'cash' && (
                <div className="space-y-3 p-3 md:p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                  <div className="space-y-2">
                    <Label htmlFor="amountReceived" className="text-sm font-medium">
                      Amount Received
                    </Label>
                    <Input
                      id="amountReceived"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={amountReceived || ''}
                      onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                      placeholder="Enter amount"
                      className="text-lg font-mono h-14 min-h-[56px]"
                    />
                  </div>

                  {amountReceived > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm font-medium">Change:</span>
                      <span className={cn(
                        "text-xl font-bold font-mono",
                        calculateChange() >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      )}>
                        {formatCurrency(calculateChange())}
                      </span>
                    </div>
                  )}

                  {amountReceived > 0 && !isPaymentSufficient() && (
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-2 rounded">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{formatCurrency(calculateTotal() - amountReceived)} short</span>
                    </div>
                  )}
                </div>
              )}

              {/* Complete Sale Button */}
              <Button
                onClick={completeSale}
                disabled={
                  completeSaleMutation.isPending ||
                  !paymentMethod ||
                  calculateTotal() <= 0 ||
                  !isPaymentVerified() ||
                  !isPaymentSufficient() ||
                  !hasOpenShift()
                }
                className="w-full h-16 min-h-[64px] bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-lg"
              >
                {completeSaleMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-current border-t-transparent animate-spin rounded-full" />
                    {t('cart.processing')}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    {t('cart.completeSale')} - {formatPrice(calculateTotal())}
                  </div>
                )}
              </Button>
            </div>
          </div>
        )}
      </ContentWrapper>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Payment QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-4">
            <div className="bg-white p-4 rounded-lg">
              {/* Placeholder for QR code */}
              <div className="w-48 h-48 bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300 rounded">
                <span className="text-sm text-gray-500">QR Code</span>
              </div>
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Amount: <span className="font-bold">{formatPrice(calculateTotal())}</span>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}

// Re-export for backward compatibility
export default CartSection;
