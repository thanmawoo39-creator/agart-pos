import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { LunchMenuInstallBanner } from '@/components/LunchMenuInstallBanner';
import { Checkout } from '@/components/sales/Checkout';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Loader2,
  Store,
  MapPin,
  Phone,
} from 'lucide-react';
import { CategoryBar } from './components/CategoryBar';
import { MenuCard } from './components/MenuCard';
import { FloatingCart } from './components/FloatingCart';
import { OrderStatusTracker } from './components/OrderStatusTracker';

// --- Interfaces ---
interface MenuItem {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  imageData?: string;
  category?: string;
  unit: string;
  stock: number;
  isDailySpecial?: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
}

interface StoreSettings {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeLogoUrl?: string;
  currencyCode: string;
  currencySymbol: string;
  currencyPosition: string;
}

interface BusinessUnit {
  id: string;
  name: string;
  type: string;
}

export default function PublicMenu({ params }: { params: { tableId?: string } }) {
  const { toast } = useToast();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Customer form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentProof, setPaymentProof] = useState<string>('');
  const [requestedDeliveryTime, setRequestedDeliveryTime] = useState('');

  // Table number from URL parameter
  const [tableNumber, setTableNumber] = useState<string | null>(params?.tableId || null);

  // Auto-set from route params
  useEffect(() => {
    if (params?.tableId) {
      setTableNumber(params.tableId);
      setCustomerName(`Table ${params.tableId}`);
      setCustomerPhone('0000');
      setDeliveryAddress('Dine-in');
    }
  }, [params?.tableId]);

  // Fetch store settings
  const { data: settings } = useQuery<StoreSettings>({
    queryKey: ['/api/public/settings'],
    queryFn: async () => {
      const res = await fetch('/api/public/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
  });

  // Fetch menu items
  const { data: products = [], isLoading: menuLoading } = useQuery<MenuItem[]>({
    queryKey: ['/api/public/menu-items'],
    queryFn: async () => {
      const res = await fetch('/api/public/menu-items');
      if (!res.ok) throw new Error('Failed to fetch menu');
      return res.json();
    },
  });

  // Business Unit Logic - Fallback to '2' (Restaurant)
  useEffect(() => {
    // ⚠️ HARDCODED RESTAURANT UNIT ID 
    setSelectedStore('2');
  }, []);

  // Format currency helper
  const formatCurrency = (amount: number) => {
    const symbol = settings?.currencySymbol || '฿';
    const position = settings?.currencyPosition || 'before';
    const formatted = amount.toLocaleString();
    return position === 'before' ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
  };

  // Extract Categories
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category || 'Other'));
    return Array.from(cats).sort();
  }, [products]);

  // Scroll Handling for Categories
  const handleCategorySelect = (category: string) => {
    setActiveCategory(category);
    if (category === 'All') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const element = document.getElementById(`category-${category}`);
      if (element) {
        // Offset for sticky headers (Header + CategoryBar approx 130px)
        const y = element.getBoundingClientRect().top + window.scrollY - 130;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
  };

  // Cart Logic
  const addToCart = async (item: MenuItem) => {
    if (item.stock <= 0) {
      toast({ title: 'Out of Stock', description: 'Item unavailable', variant: 'destructive' });
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        if (existing.quantity >= item.stock) return prev;
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });

    // Sync with POS (Fire and Forget)
    if (tableNumber) {
      fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: tableNumber,
          tableId: tableNumber,
          productId: item.id,
          productName: item.name,
          quantity: 1,
          unitPrice: item.price,
          businessUnitId: "2", // Hardcoded
        }),
      }).catch(err => console.error("POS Sync Error:", err));
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === itemId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return { ...item, quantity: 0 }; // Will be filtered out
          if (newQty > item.stock) return item;
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const getItemQuantity = (id: string) => cart.find(i => i.id === id)?.quantity || 0;

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Order Mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      if (!res.ok) throw new Error('Failed to create order');
      return res.json();
    },
    onSuccess: (data) => {
      setOrderId(data.orderId);
      setOrderSuccess(true);
      setCheckoutOpen(false);
      setCart([]);
      toast({ title: 'Order Sent!', description: 'Kitchen has received your order.' });
    },
    onError: (err) => toast({ title: 'Failed', description: err.message, variant: 'destructive' })
  });

  const handleSubmitOrder = () => {
    const orderData = {
      customerName: tableNumber ? `Table ${tableNumber}` : customerName,
      customerPhone: tableNumber ? 'N/A' : customerPhone,
      deliveryAddress: tableNumber ? 'Dine-in' : deliveryAddress,
      paymentProof,
      requestedDeliveryTime,
      businessUnitId: '2', // Hardcoded
      orderType: tableNumber ? 'dine-in' : 'delivery',
      tableNumber: tableNumber || undefined,
      items: cart.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.price * item.quantity,
      })),
    };
    createOrderMutation.mutate(orderData);
  };

  // Group items for display
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {};
    products.forEach(p => {
      const cat = p.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    return grouped;
  }, [products]);

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 font-sans">
      {/* 1. Order Tracker (Sticky Top) */}
      {tableNumber && <OrderStatusTracker tableNumber={tableNumber} />}

      {/* 2. App Header */}
      <header className="bg-white dark:bg-slate-900 px-4 py-3 shadow-sm border-b border-slate-100 dark:border-slate-800 z-40 sticky top-0">
        <div className="flex items-center gap-3">
          {settings?.storeLogoUrl ? (
            <img src={settings.storeLogoUrl} className="w-8 h-8 rounded-full object-cover" alt="Logo" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <Store className="w-4 h-4 text-orange-600" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg leading-tight text-slate-900 dark:text-slate-100">
              ChawChaw Restaurant
            </h1>
            {tableNumber && (
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                Table {tableNumber}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 3. Sticky Category Bar */}
      <CategoryBar
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={handleCategorySelect}
      />

      {/* 4. Menu Content */}
      <main className="p-4 space-y-8">
        {menuLoading && (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
        )}

        {/* Display sections */}
        {categories.map(category => {
          const items = itemsByCategory[category] || [];
          if (items.length === 0) return null;

          return (
            <section key={category} id={`category-${category}`} className="scroll-mt-[140px]">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-1 bg-orange-500 rounded-full" />
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{category}</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map(item => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    quantity={getItemQuantity(item.id)}
                    onAdd={() => addToCart(item)}
                    onRemove={() => updateQuantity(item.id, -1)}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </main>

      {/* 5. Floating Cart Bottom Bar */}
      <FloatingCart
        count={cartCount}
        total={formatCurrency(cartTotal)}
        onClick={() => setCartOpen(true)}
      />

      {/* 6. Modals (Sheet & Checkout) */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="w-full flex flex-col h-full">
          <SheetHeader>
            <SheetTitle>Your Cart</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto mt-4 space-y-4">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Cart is empty</p>
            ) : (
              cart.map(item => (
                <div key={item.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="font-bold text-sm min-w-[1rem] text-center">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <SheetFooter className="mt-auto border-t pt-4">
            <div className="w-full space-y-3">
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(cartTotal)}</span>
              </div>
              <Button
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                size="lg"
                disabled={cart.length === 0}
                onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
              >
                Checkout
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Checkout
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        cart={cart}
        cartTotal={cartTotal}
        tableNumber={tableNumber}
        settings={settings}
        customerName={customerName}
        setCustomerName={setCustomerName}
        customerPhone={customerPhone}
        setCustomerPhone={setCustomerPhone}
        deliveryAddress={deliveryAddress}
        setDeliveryAddress={setDeliveryAddress}
        requestedDeliveryTime={requestedDeliveryTime}
        setRequestedDeliveryTime={setRequestedDeliveryTime}
        paymentProof={paymentProof}
        setPaymentProof={setPaymentProof}
        onSubmitOrder={handleSubmitOrder}
        isSubmitting={createOrderMutation.isPending}
        formatCurrency={formatCurrency}
      />

      <Dialog open={orderSuccess} onOpenChange={setOrderSuccess}>
        <DialogContent>
          <div className="text-center py-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <DialogTitle className="text-2xl font-bold mb-2">Order Confirmed!</DialogTitle>
            <DialogDescription>
              Your order has been sent to the kitchen.
            </DialogDescription>
            <p className="mt-4 font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded">
              Order #{orderId.slice(0, 8)}
            </p>
            <Button className="mt-6 w-full" onClick={() => setOrderSuccess(false)}>
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Install App Banner */}
      <LunchMenuInstallBanner />
    </div>
  );
}
