import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  ShoppingCart,
  Camera,
  Smartphone,
  X,
  Upload,
  Printer
} from 'lucide-react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { SalesGrid } from '@/components/SalesGrid';
import { CartSection } from '@/components/CartSection';
import { SalesHistory } from '@/components/SalesHistory';
import ReceiptTemplate from '@/components/ReceiptTemplate';
import MobileScanner from '@/components/MobileScanner';
import { Product, CartItem, Customer, Sale } from '@/types/sales';
import { API_BASE_URL } from '@/lib/api-config';
import { isCustomerCode } from '@/hooks/use-scanner';

// Helper function to format currency in Myanmar Kyat
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('my-MM', {
    style: 'currency',
    currency: 'MMK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function Sales() {
  const [activeTab, setActiveTab] = useState('new-sale');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [showMobilePayment, setShowMobilePayment] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [paymentSlipUrl, setPaymentSlipUrl] = useState<string>('');
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [lastSaleId, setLastSaleId] = useState<string>('');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [lastSaleTotal, setLastSaleTotal] = useState<number>(0);
  const [lastSaleData, setLastSaleData] = useState<{
    cartItems: CartItem[];
    total: number;
    paymentMethod: string;
    amountReceived: number;
    timestamp: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<any>(null);
  const [scanner, setScanner] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const componentRef = useRef(null);
  const [isCustomerScannerOpen, setIsCustomerScannerOpen] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const handleCustomerScanSuccess = (decodedText: string) => {
    if (isCustomerCode(decodedText)) {
      const foundCustomer = customers.find(c =>
        (c.barcode && c.barcode.toUpperCase() === decodedText.toUpperCase()) ||
        c.id === decodedText
      );

      if (foundCustomer) {
        setSelectedCustomer(foundCustomer.id);
        const creditDisplay = (foundCustomer.currentBalance ?? 0) > 0
          ? `Debt: ${formatCurrency(foundCustomer.currentBalance ?? 0)}`
          : 'No Outstanding Debt';
        toast({
          title: `👤 Customer Linked: ${foundCustomer.name}`,
          description: creditDisplay,
        });
      } else {
        toast({
          title: "Customer Not Found",
          description: `No customer found with code: ${decodedText}`,
          variant: "destructive",
        });
      }
    } else {
        toast({
            title: "Invalid Customer Card",
            description: "This does not appear to be a valid customer card.",
            variant: "destructive",
        });
    }
  };

  // Cart state from local component (can be migrated to useCart hook later)
  const [cart, setCart] = useState<CartItem[]>([]);
  const clearCart = () => setCart([]);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
  } as any);

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/products`);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    }
  });

  // Fetch customers
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/customers`);
      if (!response.ok) throw new Error('Failed to fetch customers');
      return response.json();
    }
  });

  // Fetch recent sales
  const { data: sales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ['sales'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/sales`);
      if (!response.ok) throw new Error('Failed to fetch sales');
      return response.json();
    }
  });

  // Complete sale mutation with graceful degradation
  const completeSaleMutation = useMutation({
    mutationFn: async (saleData: {
      items: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        total: number;
      }>;
      subtotal: number;
      discount: number;
      tax: number;
      total: number;
      paymentMethod: string;
      paymentStatus: string;
      customerId?: string;
      paymentSlipUrl?: string;
      timestamp: string;
    }) => {
      const response = await fetch(`${API_BASE_URL}/api/sales/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData)
      });
      if (!response.ok) {
        const errorData = await response.json().catch((error: any) => ({}));
        throw new Error(errorData.error || 'Failed to complete sale');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Save last sale data for reprinting (BEFORE clearing cart)
      setLastSaleData({
        cartItems: [...cart],
        total: getTotal(),
        paymentMethod: paymentMethod,
        amountReceived: amountReceived,
        timestamp: new Date().toISOString(),
      });
      setLastSaleId(data.id || '');

      // Show print preview dialog instead of printing immediately
      setShowPrintPreview(true);

      // Clear the cart state
      clearCart();
      // Reset the 'Amount Received' input
      setAmountReceived(0);
      // Reset payment method and customer
      setPaymentMethod('');
      setSelectedCustomer('');
      setCapturedImage('');
      setPaymentSlipUrl('');

      // Show success toast
      toast({ title: "Sale Completed", description: "Review your receipt before printing" });
    },
    onError: (error: any) => {
      console.error('Sale completion error:', error);
      
      // Extract error code and message from backend if available
      const errorCode = error.code;
      const errorMessage = error.message || 'Failed to complete sale';
      
      // Check for specific error types from backend
      if (errorCode === 'INSUFFICIENT_STOCK') {
        toast({
          title: "Stock Issue",
          description: "Not enough stock for one or more items. Please check inventory levels.",
          variant: "destructive",
        });
      } else if (errorCode === 'PRODUCT_NOT_FOUND') {
        toast({
          title: "Product Error",
          description: "One or more products in cart not found. Please refresh and try again.",
          variant: "destructive",
        });
      } else if (errorCode === 'CUSTOMER_NOT_FOUND') {
        toast({
          title: "Customer Error",
          description: "Selected customer not found. Please choose a different customer.",
          variant: "destructive",
        });
      } else if (errorCode === 'CUSTOMER_REQUIRED') {
        toast({
          title: "Customer Required",
          description: "A customer is required for credit sales. Please select a customer.",
          variant: "destructive",
        });
      } else if (errorCode === 'CREDIT_LIMIT_EXCEEDED') {
        toast({
          title: "Credit Limit Exceeded",
          description: "Customer has exceeded their credit limit. Please use a different payment method.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('stock') || errorMessage.includes('inventory')) {
        toast({
          title: "Stock Issue",
          description: "Not enough stock for one or more items. Please check inventory.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('Invalid sale data')) {
        toast({
          title: "Data Error",
          description: "Invalid sale data. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage || "Failed to complete sale. Please try again.",
          variant: "destructive",
        });
      }
    }
  });

  // QR Scanner callback
  const handleScanSuccess = useCallback((decodedText: string) => {
    console.log('🔍 Sales: Barcode scanned:', decodedText);

    // PRIORITY 1: Check if this is a Customer Member Card (starts with "C-" or matches customer data)
    if (isCustomerCode(decodedText)) {
      const foundCustomer = customers.find(c =>
        c.memberId?.toUpperCase() === decodedText.toUpperCase() ||
        c.barcode === decodedText ||
        c.phone === decodedText ||
        c.id === decodedText
      );

      if (foundCustomer) {
        // Customer card scanned - link to current sale
        setSelectedCustomer(foundCustomer.id);

        // Format credit/debt display
        const creditDisplay = (foundCustomer.currentBalance ?? 0) > 0
          ? `Debt: ${formatCurrency(foundCustomer.currentBalance ?? 0)}`
          : 'No Outstanding Debt';

        toast({
          title: `👤 Customer Linked: ${foundCustomer.name}`,
          description: creditDisplay,
        });

        console.log('✅ Customer linked:', foundCustomer.name);
        return; // STOP - Do not search for product
      } else {
        toast({
          title: "Customer Not Found",
          description: `No customer found with code: ${decodedText}`,
          variant: "destructive",
        });
        return;
      }
    }

    // PRIORITY 2: Find product by barcode (normal product scan)
    const product = products.find(p => p.barcode === decodedText);
    if (product) {
      if (product.stock > 0) {
        addToCart(product);
        toast({
          title: "Product Added",
          description: `${product.name} added to cart`,
        });
      } else {
        toast({
          title: "Out of Stock",
          description: `${product.name} is out of stock`,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Product Not Found",
        description: `No product found with barcode: ${decodedText}`,
        variant: "destructive",
      });
    }
  }, [products, customers, toast, setSelectedCustomer]);


  // Cart functions
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCart(prev => prev.map(item =>
      item.id === id ? { ...item, quantity } : item
    ));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const getTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // Callback for CartSection to call after printing receipt
  const handleAfterPrint = () => {
    console.log('🖨️ Print completed, clearing cart...');
    // Clear cart and reset form
    setCart([]);
    setSelectedCustomer('');
    setPaymentMethod('');
    setAmountReceived(0);
    setCapturedImage('');
    setPaymentSlipUrl('');
  };

  // Camera functions
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const imageData = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(imageData);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setCapturedImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPaymentSlip = async (imageData: string) => {
    try {
      const response = await fetch(imageData);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append('image', blob, 'payment-slip.jpg');

      const uploadResponse = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) throw new Error('Upload failed');

      const uploadResult = await uploadResponse.json();
      setPaymentSlipUrl(uploadResult.url);
      return uploadResult.url;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  // Scanner functions
  const startScanner = () => {
    setShowScanner(true);
    
    setTimeout(() => {
      const scannerInstance = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        },
        false
      );

      scannerInstance.render(
        (decodedText) => {
          // On successful scan
          console.log('Scanned barcode:', decodedText);
          findAndAddProductByBarcode(decodedText);
          stopScanner();
        },
        (errorMessage) => {
          // On scan failure (ignore continuous errors)
          console.debug('Scan error:', errorMessage);
        }
      );

      scannerRef.current = scannerInstance;
      setScanner(scannerInstance);
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch((error: any) => {
        console.error('Failed to clear scanner:', error);
      });
      scannerRef.current = null;
      setScanner(null);
    }
    setShowScanner(false);
  };

  const findAndAddProductByBarcode = (barcode: string) => {
    // PRIORITY 1: Check if this is a Customer Member Card (starts with "C-")
    if (isCustomerCode(barcode)) {
      const foundCustomer = customers.find(c =>
        c.memberId?.toUpperCase() === barcode.toUpperCase() ||
        c.barcode === barcode ||
        c.phone === barcode ||
        c.id === barcode
      );

      if (foundCustomer) {
        // Customer card scanned - link to current sale
        setSelectedCustomer(foundCustomer.id);

        // Format credit/debt display
        const creditDisplay = (foundCustomer.currentBalance ?? 0) > 0
          ? `Debt: ${formatCurrency(foundCustomer.currentBalance ?? 0)}`
          : 'No Outstanding Debt';

        toast({
          title: `👤 Customer Linked: ${foundCustomer.name}`,
          description: creditDisplay,
        });

        console.log('✅ Customer linked:', foundCustomer.name);
        return; // STOP - Do not search for product
      } else {
        toast({
          title: "Customer Not Found",
          description: `No customer found with code: ${barcode}`,
          variant: "destructive",
        });
        return;
      }
    }

    // PRIORITY 2: Find product by barcode (normal product scan)
    const product = products.find(p => p.barcode === barcode);

    if (product) {
      if (product.stock > 0) {
        addToCart(product);
        toast({
          title: "Product Added",
          description: `${product.name} has been added to cart.`,
        });
      } else {
        toast({
          title: "Out of Stock",
          description: `${product.name} is currently out of stock.`,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Product Not Found",
        description: `No product found with barcode: ${barcode}`,
        variant: "destructive",
      });
    }
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Please add items to the cart before completing the sale.",
        variant: "destructive",
      });
      return;
    }

    if (!paymentMethod) {
      toast({
        title: "Payment method required",
        description: "Please select a payment method.",
        variant: "destructive",
      });
      return;
    }

    // Credit validation: require customer selection
    if (paymentMethod === 'credit' && !selectedCustomer) {
      toast({
        title: "Customer Required",
        description: "Please select a customer for credit sales.",
        variant: "destructive",
      });
      return;
    }

    try {
      let slipUrl = '';
      
      // If mobile payment and slip is captured, upload it with graceful degradation
      if (paymentMethod === 'mobile' && capturedImage) {
        try {
          slipUrl = await uploadPaymentSlip(capturedImage);
        } catch (uploadError) {
          console.error('Upload failed, proceeding without slip:', uploadError);
          // Graceful degradation: continue with sale even if upload fails
          toast({
            title: "Upload Warning",
            description: "Payment slip upload failed, but sale will proceed.",
            variant: "default",
          });
        }
      }

      // If credit payment and slip is captured (I.O.U. or credit note), upload it
      if (paymentMethod === 'credit' && capturedImage) {
        try {
          slipUrl = await uploadPaymentSlip(capturedImage);
        } catch (uploadError) {
          console.error('Credit slip upload failed, proceeding without slip:', uploadError);
          // Graceful degradation: continue with sale even if AI analysis fails
          toast({
            title: "Credit Note Warning",
            description: "Credit note upload failed, but sale will proceed.",
            variant: "default",
          });
        }
      }

      // Transform cart items to match backend schema
      const saleItems = cart.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.price * item.quantity
      }));

      const saleData = {
        items: saleItems,
        subtotal: getTotal(), // Add required subtotal field
        discount: 0, // Add required discount field
        tax: 0, // Add required tax field
        total: getTotal(),
        paymentMethod,
        paymentStatus: paymentMethod === 'credit' ? 'unpaid' : 'paid', // Add payment status
        customerId: selectedCustomer || undefined,
        paymentSlipUrl: slipUrl || undefined,
        timestamp: new Date().toISOString() // Add required timestamp
      };

      console.log('🛒 Sending sale data:', saleData);

      // Complete the sale with or without slip
      await completeSaleMutation.mutateAsync(saleData);

      setShowCameraModal(false);
      setCapturedImage('');
      
    } catch (error) {
      console.error('Sale completion error:', error);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
      stopScanner();
    };
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Sales</h1>
        {lastSaleData && (
          <Button
            onClick={handlePrint}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Reprint Last Receipt
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="new-sale">New Sale</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="new-sale" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Product Grid */}
            <div className="lg:col-span-2">
              <SalesGrid
                products={products}
                productsLoading={productsLoading}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                onScanSuccess={handleScanSuccess}
                addToCart={addToCart}
              />
            </div>

            {/* Cart */}
            <div>
              <CartSection
                cart={cart}
                customers={customers}
                selectedCustomer={selectedCustomer}
                setSelectedCustomer={setSelectedCustomer}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                updateQuantity={updateQuantity}
                removeFromCart={removeFromCart}
                getTotal={getTotal}
                completeSale={completeSale}
                completeSaleMutation={completeSaleMutation}
                showMobilePayment={showMobilePayment}
                setShowMobilePayment={setShowMobilePayment}
                showCameraModal={showCameraModal}
                setShowCameraModal={setShowCameraModal}
                lastSaleId={lastSaleId}
                lastSaleTotal={lastSaleTotal}
                paymentSlipUrl={paymentSlipUrl}
                amountReceived={amountReceived}
                setAmountReceived={setAmountReceived}
                onAfterPrint={handleAfterPrint}
                onScanCustomerClick={() => setIsCustomerScannerOpen(true)}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <SalesHistory
            sales={sales}
            salesLoading={salesLoading}
          />
        </TabsContent>
      </Tabs>

      <MobileScanner
        isOpen={isCustomerScannerOpen}
        onClose={() => setIsCustomerScannerOpen(false)}
        onScanSuccess={handleCustomerScanSuccess}
      />

      {/* Mobile Payment QR Code Dialog */}
      <Dialog open={showMobilePayment} onOpenChange={setShowMobilePayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mobile Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-48 h-48 mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                <Smartphone className="w-16 h-16 text-gray-400" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Scan the QR code to complete payment
              </p>
            </div>
            <Button
              onClick={() => {
                setShowMobilePayment(false);
                setShowCameraModal(true);
              }}
              className="w-full"
            >
              <Camera className="w-4 h-4 mr-2" />
              Capture Payment Slip
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Camera Modal */}
      <Dialog open={showCameraModal} onOpenChange={setShowCameraModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {paymentMethod === 'credit' ? 'Capture Credit Note (I.O.U.)' : 'Capture Payment Slip'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!capturedImage ? (
              <div className="space-y-4">
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={startCamera} className="flex-1">
                    <Camera className="w-4 h-4 mr-2" />
                    Start Camera
                  </Button>
                  <Button onClick={capturePhoto} className="flex-1">
                    <Camera className="w-4 h-4 mr-2" />
                    Capture
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <img
                  src={capturedImage}
                  alt="Captured payment slip"
                  className="w-full rounded-lg"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCapturedImage('');
                      startCamera();
                    }}
                    className="flex-1"
                  >
                    Retake
                  </Button>
                  <Button
                    onClick={() => {
                      setShowCameraModal(false);
                      completeSale();
                    }}
                    className="flex-1"
                  >
                    Complete Sale
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Preview Dialog */}
      <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
        <DialogContent className="max-w-md print:max-w-full">
          <DialogHeader className="print:hidden">
            <DialogTitle className="text-black dark:text-white">Receipt Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Thermal Receipt Preview - 80mm width optimized */}
            <div id="receipt-content" className="mx-auto w-[300px] print:w-[80mm] bg-white p-4 print:p-0 border print:border-0 rounded print:rounded-none shadow print:shadow-none">
              {lastSaleData && (
                <div className="text-black font-mono text-sm print:text-[12px]">
                  {/* Header - Store Info */}
                  <div className="text-center border-b-2 border-dashed border-black pb-2 mb-2">
                    <h1 className="font-bold text-xl print:text-[18px] tracking-wide">AGART POS</h1>
                    <p className="text-[11px] print:text-[10px] mt-1">No. 123, Main Street, Yangon</p>
                    <p className="text-[11px] print:text-[10px]">Tel: 09-123-456-789</p>
                  </div>

                  {/* Receipt Info */}
                  <div className="text-[11px] print:text-[10px] mb-2 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Receipt #:</span>
                      <span className="font-semibold">{lastSaleId.substring(0, 8).toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span>{new Date(lastSaleData.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Time:</span>
                      <span>{new Date(lastSaleData.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Payment:</span>
                      <span className="font-semibold">{lastSaleData.paymentMethod.toUpperCase()}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t-2 border-dashed border-black my-2"></div>

                  {/* Items Table */}
                  <div className="mb-2">
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1 text-[11px] print:text-[10px] font-bold mb-1">
                      <div>Item</div>
                      <div className="text-center w-8">Qty</div>
                      <div className="text-right w-16">Price</div>
                      <div className="text-right w-20">Amount</div>
                    </div>
                    <div className="border-t border-black pt-1">
                      {lastSaleData.cartItems.map((item, index) => (
                        <div key={index} className="grid grid-cols-[1fr_auto_auto_auto] gap-1 text-[11px] print:text-[10px] py-0.5">
                          <div className="truncate">{item.name}</div>
                          <div className="text-center w-8">{item.quantity}</div>
                          <div className="text-right w-16">{formatCurrency(item.price)}</div>
                          <div className="text-right w-20 font-semibold">{formatCurrency(item.price * item.quantity)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t-2 border-dashed border-black my-2"></div>

                  {/* Totals Section */}
                  <div className="space-y-1 text-[12px] print:text-[11px]">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-mono">{formatCurrency(lastSaleData.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax (0%):</span>
                      <span className="font-mono">{formatCurrency(0)}</span>
                    </div>
                    <div className="border-t-2 border-black pt-1 mt-1"></div>
                    <div className="flex justify-between font-bold text-[14px] print:text-[13px]">
                      <span>GRAND TOTAL:</span>
                      <span className="font-mono">{formatCurrency(lastSaleData.total)}</span>
                    </div>
                    {lastSaleData.amountReceived > 0 && (
                      <>
                        <div className="flex justify-between text-[11px] print:text-[10px] mt-2">
                          <span>Amount Received:</span>
                          <span className="font-mono">{formatCurrency(lastSaleData.amountReceived)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Change:</span>
                          <span className="font-mono">{formatCurrency(lastSaleData.amountReceived - lastSaleData.total)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t-2 border-dashed border-black my-2"></div>

                  {/* Footer */}
                  <div className="text-center text-[11px] print:text-[10px] space-y-1">
                    <p className="font-bold">Thank You!</p>
                    <p className="myanmar-text">ကျေးဇူးတင်ပါသည်၊</p>
                    <p className="myanmar-text">နောက်လည်း ကြွခဲ့ပါဦး။</p>
                    <div className="mt-2 pt-2 border-t border-dashed border-gray-400">
                      <p className="text-[10px] print:text-[9px]">Facebook: fb.com/agartpos</p>
                      <p className="text-[10px] print:text-[9px] text-gray-600 mt-1">Powered by AGART POS System</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons - Hidden on Print */}
            <div className="flex gap-2 print:hidden">
              <Button
                variant="outline"
                onClick={() => setShowPrintPreview(false)}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  handlePrint();
                  setShowPrintPreview(false);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-content,
          #receipt-content * {
            visibility: visible;
          }
          #receipt-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            margin: 0;
            padding: 0;
          }
          .myanmar-text {
            font-family: 'Myanmar Text', 'Padauk', sans-serif;
          }
        }
      `}</style>

      <div style={{ display: "none" }}>
        {/* Render receipt with lastSaleData if available, otherwise use current cart */}
        {(lastSaleData || cart.length > 0) && (
          <ReceiptTemplate
            ref={componentRef}
            cartItems={(lastSaleData?.cartItems || cart).map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              total: item.price * item.quantity
            }))}
            total={lastSaleData?.total || getTotal()}
            discount={0}
            paymentMethod={lastSaleData?.paymentMethod || paymentMethod}
            date={lastSaleData?.timestamp || new Date().toISOString()}
            orderId={lastSaleId || ''}
            amountGiven={lastSaleData?.amountReceived || amountReceived}
            change={(lastSaleData?.amountReceived || amountReceived) - (lastSaleData?.total || getTotal())}
          />
        )}
      </div>
    </div>
  );
}
