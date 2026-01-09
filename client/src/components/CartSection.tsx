import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShoppingCart, Plus, Minus, Trash2, DollarSign, Users, Smartphone, Camera, Eye, CheckCircle, X, Printer, Receipt, Upload, AlertCircle, Check } from 'lucide-react';
import { CartItem, Customer } from '@/types/sales';
import { useAuth } from '@/lib/auth-context';
import type { Shift } from '@shared/schema';
import { any } from 'zod';
import { API_BASE_URL } from '@/lib/api-config';

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
  completeSaleMutation: any;
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
  onAfterPrint
}: CartSectionProps) {
  const { t } = useTranslation();
  const { currentStaff } = useAuth();

  // Query current shift
  const { data: currentShift } = useQuery<Shift | null>({
    queryKey: ['/api/shifts/current'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const [showSuccess, setShowSuccess] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [slipImage, setSlipImage] = useState<string>('');
  const [slipVerification, setSlipVerification] = useState<{verified: boolean, url: string, detectedAmount: number} | null>(null);
  const [isVerifyingSlip, setIsVerifyingSlip] = useState(false);
  const slipInputRef = useRef<HTMLInputElement>(null);

  const calculateTotal = () => {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return total;
  };

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  const handleSlipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, etc.)');
      return;
    }
    
    const formData = new FormData();
    formData.append('image', file);

    setIsVerifyingSlip(true);
    setSlipVerification(null);
    
    // Preview the image
    const reader = new FileReader();
    reader.onload = (e) => {
      setSlipImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/verify-slip`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSlipVerification({
          verified: true,
          url: result.url,
          detectedAmount: result.detectedAmount,
        });
      } else {
        throw new Error(result.error || 'Failed to upload slip');
      }
    } catch (error) {
      console.error('Slip upload error:', error);
      alert('Failed to upload payment slip. Please try again.');
      setSlipVerification(null);
    } finally {
      setIsVerifyingSlip(false);
    }
  };

  const isPaymentVerified = () => {
    if (paymentMethod !== 'mobile') return true; // Only mobile requires verification
    return slipVerification?.verified === true;
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
    // Check if the current shift belongs to the current user
    const shift = currentShift as Shift;
    return shift.staffId === currentStaff.id && shift.status === 'open';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          {t('cart.title')}
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
              {cart.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                {/* Product Info - Left Side */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate leading-tight">{item.name}</h4>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{formatPrice(item.price)} each</p>
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
                  <span className="font-bold text-sm font-mono whitespace-nowrap">{formatPrice(item.price * item.quantity)}</span>
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
              ))}
            </div>

            {/* Totals and Payment Section */}
            <div className="border-t-2 pt-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-muted-foreground">{t('cart.subtotal')}:</span>
                <span className="font-semibold font-mono">{formatPrice(calculateTotal())}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-muted-foreground">{t('cart.tax')} (0%):</span>
                <span className="font-semibold font-mono">$0.00</span>
              </div>
              <div className="flex justify-between items-center font-bold text-xl border-t-2 pt-3 bg-primary/5 -mx-4 px-4 py-3 rounded-lg">
                <span className="text-primary">{t('cart.grandTotal')}:</span>
                <span className="text-primary font-mono">{formatPrice(calculateTotal())}</span>
              </div>

              <div className="space-y-3">
                <div className="flex w-full items-center gap-2">
                  <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                    <SelectTrigger>
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

                {paymentMethod === 'mobile' && (
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
                        {isVerifyingSlip ? 'Verifying...' : 'Upload/Scan Slip'}
                      </Button>
                      
                      {slipVerification && (
                        <div className={`p-3 rounded-lg flex items-center gap-2 ${
                          slipVerification.verified 
                            ? 'bg-green-50 border border-green-200 text-green-800' 
                            : 'bg-red-50 border border-red-200 text-red-800'
                        }`}>
                          {slipVerification.verified ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            <AlertCircle className="w-5 h-5" />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {slipVerification.verified ? 'Payment Slip Uploaded' : 'Verification Failed'}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {slipImage && (
                        <div className="mt-2">
                          <img 
                            src={slipImage} 
                            alt="Payment slip" 
                            className="w-full h-32 object-cover rounded-lg border"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {paymentMethod === 'credit' && (
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
                {paymentMethod === 'cash' && (
                  <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                    <div className="space-y-2">
                      <Label htmlFor="amountReceived" className="text-sm font-medium">
                        Amount Received ($)
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
                        <span className={`text-xl font-bold font-mono ${
                          calculateChange() >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          ${calculateChange().toFixed(2)}
                        </span>
                      </div>
                    )}

                    {amountReceived > 0 && !isPaymentSufficient() && (
                      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-2 rounded">
                        <AlertCircle className="w-4 h-4" />
                        <span>Insufficient payment (${(calculateTotal() - amountReceived).toFixed(2)} short)</span>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={completeSale}
                  disabled={completeSaleMutation.isPending || !paymentMethod || calculateTotal() <= 0 || !isPaymentVerified() || !isPaymentSufficient() || !hasOpenShift()}
                  className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                >
                  {completeSaleMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                      {t('cart.processing')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {t('cart.completeSale')}
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
