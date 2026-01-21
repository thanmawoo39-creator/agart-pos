import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  CloudUpload,
  Trash2,
  CheckCircle,
  Phone,
  MapPin,
  User,
  CreditCard,
  Loader2,
  Star,
  Coffee,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isDailySpecial?: boolean;
}

interface StoreSettings {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  mobilePaymentQrUrl?: string;
  currencyCode?: string;
  currencySymbol?: string;
  currencyPosition?: string;
}

interface CheckoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  cartTotal: number;
  tableNumber: string | null;
  settings: StoreSettings | undefined;
  customerName: string;
  setCustomerName: (name: string) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  deliveryAddress: string;
  setDeliveryAddress: (address: string) => void;
  requestedDeliveryTime: string;
  setRequestedDeliveryTime: (time: string) => void;
  paymentProof: string;
  setPaymentProof: (proof: string) => void;
  onSubmitOrder: () => void;
  isSubmitting: boolean;
  formatCurrency: (amount: number) => string;
}

export function Checkout({
  open,
  onOpenChange,
  cart,
  cartTotal,
  tableNumber,
  settings,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  deliveryAddress,
  setDeliveryAddress,
  requestedDeliveryTime,
  setRequestedDeliveryTime,
  paymentProof,
  setPaymentProof,
  onSubmitOrder,
  isSubmitting,
  formatCurrency,
}: CheckoutProps) {
  const { toast } = useToast();
  // STRICT: isPaymentVerified can ONLY be set to true by handleVerifyClick after server confirms
  const [isPaymentVerified, setIsPaymentVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Handle file upload - DOES NOT auto-verify, only stores the image
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload an image file.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPaymentProof(reader.result as string);
      // Reset verification when new slip is uploaded - user must re-verify
      setIsPaymentVerified(false);
    };
    reader.readAsDataURL(file);
  };

  // STRICT SERVER-SIDE VALIDATION
  // This is the ONLY function that can set isPaymentVerified to true
  // It MUST receive { verified: true } from the server to unlock
  const handleVerifyClick = async () => {
    // Pre-check: slip must be uploaded first
    if (!paymentProof) {
      toast({
        title: 'No Slip Uploaded',
        description: 'Please upload a payment slip first.',
        variant: 'destructive',
      });
      return;
    }

    // Start loading state
    setIsVerifying(true);
    // Ensure we don't have stale verification
    setIsPaymentVerified(false);

    try {
      // BLOCKING API CALL - Server checks if SMS exists in payment_buffers table
      const response = await fetch(`/api/public/check-payment-buffer?amount=${cartTotal}`);

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      // STRICT CHECK: Server MUST return { verified: true }
      // This means the SMS was actually found in the database
      if (data.success === true && data.verified === true) {
        // ONLY HERE can we unlock - server confirmed payment exists
        setIsPaymentVerified(true);
        toast({
          title: 'Payment Verified ✓',
          description: `Amount ${formatCurrency(data.amount || cartTotal)} confirmed in our system. You can now place your order.`,
        });
      } else {
        // Server explicitly said payment NOT found - keep locked
        setIsPaymentVerified(false);
        toast({
          title: 'Payment SMS Not Found!',
          description: 'Please transfer money first, then click "Verify Payment" again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[CHECKOUT] Payment verification error:', error);
      // On any error, keep locked
      setIsPaymentVerified(false);
      toast({
        title: 'Verification Failed',
        description: 'Could not connect to server. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Reset verification state when dialog closes or opens
  // User must always re-verify when opening checkout
  useEffect(() => {
    if (!open) {
      setIsPaymentVerified(false);
      setIsVerifying(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-slate-50 dark:bg-slate-900">
        {/* White Card Container */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 md:p-8 -m-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
              {tableNumber ? (
                <>
                  <Coffee className="h-6 w-6 text-green-500" />
                  Confirm Table Order
                </>
              ) : (
                <>
                  <CreditCard className="h-6 w-6 text-orange-500" />
                  Complete Your Order
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              {tableNumber
                ? "Review your items, upload payment slip, and verify payment to place order"
                : "Fill in your delivery details, upload payment proof, and verify to proceed"
              }
            </DialogDescription>
          </DialogHeader>

          {/* Table Order Badge */}
          {tableNumber && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg mb-6">
              <Coffee className="h-4 w-4 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100">Ordering for Table {tableNumber}</p>
                <p className="text-xs text-green-700 dark:text-green-300">Your order will be delivered to your table</p>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Customer Details */}
            <div className={tableNumber ? "hidden" : "space-y-4"}>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Customer Information</h3>

              <div>
                <Label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Your Name *
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter your name"
                    className="pl-10 border-slate-300 focus:border-orange-500 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Phone - Hide for table orders */}
              {!tableNumber && (
                <div>
                  <Label htmlFor="phone" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Phone Number *
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="phone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="09xxxxxxxxx"
                      className="pl-10 border-slate-300 focus:border-orange-500 focus:ring-orange-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="deliveryTime" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  {tableNumber ? 'Preferred Serving Time' : 'Preferred Delivery Time'}
                </Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                  <Input
                    id="deliveryTime"
                    type="time"
                    required
                    value={requestedDeliveryTime}
                    onChange={(e) => setRequestedDeliveryTime(e.target.value)}
                    className="pl-10 border-slate-300 focus:border-orange-500 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Delivery Address - Hide for table orders */}
              {!tableNumber && (
                <div>
                  <Label htmlFor="address" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Delivery Address *
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Textarea
                      id="address"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Enter your full delivery address"
                      className="pl-10 border-slate-300 focus:border-orange-500 focus:ring-orange-500 min-h-[80px]"
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Payment Info - Highlighted (Only for Delivery) */}
            {!tableNumber && (
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 border-2 border-orange-200 dark:border-orange-800 rounded-xl p-6 space-y-4">
                <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-100 uppercase tracking-wide flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Information
                </h3>

                {settings?.mobilePaymentQrUrl && (
                  <div className="text-center bg-white dark:bg-slate-800 rounded-lg p-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 font-medium">Scan QR Code to Pay</p>
                    <img
                      src={settings.mobilePaymentQrUrl}
                      alt="Payment QR"
                      className="mx-auto max-w-[180px] rounded-lg border-2 border-orange-200 shadow-md"
                    />
                  </div>
                )}

                {/* Transfer Info Box */}
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-lg p-4 text-center border border-orange-200 dark:border-orange-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Transfer to:</p>
                  <p className="font-bold text-lg text-orange-700 dark:text-orange-400">ChawChaw Restaurant</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                    {formatCurrency(cartTotal)}
                  </p>
                  {settings?.storePhone && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      <Phone className="h-3 w-3 inline mr-1" />
                      {settings.storePhone}
                    </p>
                  )}
                </div>

                {/* Upload Zone and Verify Button */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">
                    Step 1: Upload Payment Slip *
                  </Label>

                  {!paymentProof ? (
                    <div className="relative border-2 border-dashed border-orange-300 dark:border-orange-700 rounded-lg p-6 text-center bg-white dark:bg-slate-800 hover:border-orange-400 transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <CloudUpload className="h-10 w-10 text-orange-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Click to upload payment slip
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        PNG, JPG up to 5MB
                      </p>
                    </div>
                  ) : (
                    <div className="relative bg-white dark:bg-slate-800 rounded-lg p-3 border-2 border-orange-200 dark:border-orange-700">
                      <img
                        src={paymentProof}
                        alt="Payment proof"
                        className="max-h-48 rounded-lg mx-auto shadow-md"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 right-2 shadow-lg"
                        onClick={() => {
                          setPaymentProof('');
                          setIsPaymentVerified(false);
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                      <p className="text-xs text-center text-green-600 dark:text-green-400 mt-2 font-medium">
                        Payment slip uploaded
                      </p>
                    </div>
                  )}

                  {/* Verify Payment Button */}
                  <div className="pt-2">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                      Step 2: Verify Payment
                    </Label>

                    {isPaymentVerified ? (
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border-2 border-green-300 dark:border-green-700 rounded-lg">
                        <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div className="flex-1">
                          <p className="font-semibold text-green-800 dark:text-green-200">Payment Verified</p>
                          <p className="text-xs text-green-600 dark:text-green-400">SMS confirmation received. You can place your order.</p>
                        </div>
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full border-2 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950"
                          onClick={handleVerifyClick}
                          disabled={!paymentProof || isVerifying}
                        >
                          {isVerifying ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Checking SMS...
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-4 w-4 mr-2" />
                              Verify Payment
                            </>
                          )}
                        </Button>
                        {paymentProof && !isPaymentVerified && (
                          <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                              After making payment, click "Verify Payment" to check if we received the SMS confirmation.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Order Summary */}
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Order Summary</h3>
              <div className="space-y-2 text-sm max-h-40 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center py-1">
                    <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      {item.isDailySpecial && <Star className="h-3 w-3 text-orange-500 fill-orange-500" />}
                      <span className="font-medium">{item.name}</span>
                      <span className="text-slate-500">x {item.quantity}</span>
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t-2 border-slate-300 dark:border-slate-600 pt-3 flex justify-between items-center">
                <span className="font-bold text-base text-slate-700 dark:text-slate-300">Total:</span>
                <span className="font-bold text-2xl text-orange-600 dark:text-orange-400">{formatCurrency(cartTotal)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-8">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-slate-300 hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onSubmitOrder}
              disabled={isSubmitting || (!tableNumber && !isPaymentVerified)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : !tableNumber && !isPaymentVerified ? (
                <>
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Verify Payment First
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Place Order
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
