import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { LunchMenuInstallBanner } from '@/components/LunchMenuInstallBanner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Upload,
  CheckCircle,
  Store,
  Phone,
  MapPin,
  User,
  CreditCard,
  Loader2,
  AlertCircle,
  Star,
  Coffee,
  Sparkles,
  CloudUpload,
  Clock,
  LogOut,
  ChevronDown,
} from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  imageData?: string;
  category?: string;
  unit: string;
  stock: number;
  specialStock?: number;
  isDailySpecial?: boolean;
  isStandardMenu?: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
}

interface StoreSettings {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeLogoUrl?: string;
  mobilePaymentQrUrl?: string;
  currencyCode: string;
  currencySymbol: string;
  currencyPosition: string;
}

interface BusinessUnit {
  id: string;
  name: string;
  type: string;
}

interface MenuData {
  dailySpecials: MenuItem[];
  standardMenu: MenuItem[];
}

export default function LunchMenu() {
  const { toast } = useToast();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string>('');
  const [guestId, setGuestId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [conversionSuccess, setConversionSuccess] = useState(false);
  const [createAccount, setCreateAccount] = useState(false); // Checkout account creation option

  // Customer form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentProof, setPaymentProof] = useState<string>('');
  const [requestedDeliveryTime, setRequestedDeliveryTime] = useState('');
  const [showUploadError, setShowUploadError] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Check auth status on load
  useEffect(() => {
    fetch('/api/customer/profile', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(user => {
        if (user) {
          setCurrentUser(user);
          // Auto-fill details if logged in
          setCustomerName(user.name);
          setCustomerPhone(user.phone !== 'N/A' ? user.phone : '');
        }
      })
      .catch(() => { });
  }, []);

  const handleLogin = async () => {
    try {
      const res = await fetch('/api/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: loginPhone, password: loginPassword })
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Welcome back!', description: `Logged in as ${data.user.name}` });
        setCurrentUser(data.user);
        setCustomerName(data.user.name);
        setLoginOpen(false);
      } else {
        toast({ title: 'Login Failed', description: data.error, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Available only for registered customers', variant: 'destructive' });
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/customer/logout', { method: 'POST', credentials: 'include' });
      setCurrentUser(null);
      setCustomerName('');
      setCustomerPhone('');
      toast({ title: 'Logged out', description: 'See you next time!' });
      window.location.href = '/lunch-menu';
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };
  const [tableNumber, setTableNumber] = useState<string | null>(null);

  // Detect table parameter from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const table = params.get('table');
    if (table) {
      setTableNumber(table);
      console.log('[TABLE-ORDER] Detected table number from URL:', table);
    }
  }, []);

  // Fetch business units
  const { data: businessUnits = [] } = useQuery<BusinessUnit[]>({
    queryKey: ['/api/public/business-units'],
    queryFn: async () => {
      const res = await fetch('/api/public/business-units');
      if (!res.ok) throw new Error('Failed to fetch stores');
      return res.json();
    },
  });

  // Auto-select restaurant unit and update title
  useEffect(() => {
    document.title = "ChawChaw Restaurant";

    if (businessUnits.length > 0 && !selectedStore) {
      const restaurant = businessUnits.find(bu =>
        bu.type === 'restaurant' || bu.name.toLowerCase().includes('restaurant')
      );
      if (restaurant) {
        setSelectedStore(restaurant.id);
      } else {
        setSelectedStore(businessUnits[0].id);
      }
    }
  }, [businessUnits, selectedStore]);

  // Fetch store settings
  const { data: settings } = useQuery<StoreSettings>({
    queryKey: ['/api/public/settings'],
    queryFn: async () => {
      const res = await fetch('/api/public/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
  });

  // Fetch menu items - NUCLEAR FIX: Always fetch ALL items, no businessUnitId filter
  const { data: menuData, isLoading: menuLoading, error: menuError } = useQuery<MenuData>({
    queryKey: ['/api/public/menu'],
    queryFn: async () => {
      // ALWAYS fetch all menu items - no filtering
      const url = '/api/public/menu';
      console.log('[LUNCH-MENU] Fetching from:', url);
      const res = await fetch(url);
      if (!res.ok) {
        console.error('[LUNCH-MENU] API Error:', res.status, res.statusText);
        throw new Error('Failed to fetch menu');
      }
      const data = await res.json();
      console.log('[LUNCH-MENU] API Response:', {
        dailySpecials: data.dailySpecials?.length || 0,
        standardMenu: data.standardMenu?.length || 0
      });
      return data;
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Extract menu items directly from API response
  const dailySpecials = menuData?.dailySpecials || [];
  const standardMenu = menuData?.standardMenu || [];

  // Debug logging
  console.log('[LUNCH-MENU] State:', {
    menuLoading,
    menuError: menuError?.message,
    dailySpecials: dailySpecials.length,
    standardMenu: standardMenu.length,
    hasData: !!menuData
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // CRITICAL: Send session cookies for logged-in users
        body: JSON.stringify(orderData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create order');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setOrderId(data.orderId);
      if (data.guestId) setGuestId(data.guestId);
      setOrderSuccess(true);
      setCheckoutOpen(false);
      setCart([]);
      // Don't clear phone/name/address yet - needed for "Save Details" prompt
      // setCustomerName(''); 
      // setCustomerPhone('');
      // setDeliveryAddress('');
      setPaymentProof('');
      toast({
        title: 'Order Placed!',
        description: `Order #${data.orderId.slice(0, 8)} has been confirmed.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Order Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    const symbol = settings?.currencySymbol || '฿';
    const position = settings?.currencyPosition || 'before';
    const formatted = amount.toLocaleString();
    return position === 'before' ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
  };

  // Cart operations
  const addToCart = (item: MenuItem) => {
    const stockLimit = item.isDailySpecial ? (item.specialStock ?? item.stock) : item.stock;

    if (stockLimit <= 0) {
      toast({
        title: 'Out of Stock',
        description: `${item.name} is currently unavailable.`,
        variant: 'destructive',
      });
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        if (existing.quantity >= stockLimit) {
          toast({
            title: 'Stock Limit',
            description: `Only ${stockLimit} available for ${item.name}.`,
            variant: 'destructive',
          });
          return prev;
        }
        return prev.map(i =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });

    toast({
      title: 'Added to Cart',
      description: `${item.name} added`,
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === itemId) {
          const newQty = item.quantity + delta;
          const stockLimit = item.isDailySpecial ? (item.specialStock ?? item.stock) : item.stock;

          if (newQty <= 0) return { ...item, quantity: 0 };
          if (newQty > stockLimit) {
            toast({
              title: 'Stock Limit',
              description: `Only ${stockLimit} available.`,
              variant: 'destructive',
            });
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Handle file upload
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
    };
    reader.readAsDataURL(file);
  };

  // Handle guest conversion - convert the guest account created during checkout to a full account
  const handleConvertToAccount = async () => {
    if (!password || password.length < 6) {
      toast({ title: 'Invalid Password', description: 'Password must be at least 6 characters.', variant: 'destructive' });
      return;
    }

    // Use the guestId from the order response to convert the specific guest account
    if (!guestId) {
      toast({ title: 'Error', description: 'No guest account to convert.', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch('/api/customer/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        // Send guestId to convert the specific account, plus phone/name for linking
        body: JSON.stringify({ guestId, phone: customerPhone, password, name: customerName }),
      });

      if (!res.ok) throw new Error('Failed to create account');

      const data = await res.json();
      setConversionSuccess(true);

      // Auto-login the user after conversion
      if (data.user) {
        setCurrentUser(data.user);
      }

      toast({ title: 'Account Created!', description: 'You can now track orders and leave feedback.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create account. Please try again.', variant: 'destructive' });
    }
  };

  // Handle order submission
  const handleSubmitOrder = () => {
    if (cart.length === 0) {
      toast({
        title: 'Cart Empty',
        description: 'Please add at least one item before checking out.',
        variant: 'destructive',
      });
      return;
    }

    // Name is optional for Guest Checkout (Delivery), required for Table Orders (maybe?)
    // Actually, user asked to ONLY request Phone and Address.
    // So we skip name validation for delivery orders.
    // if (!customerName.trim()) { ... } -> Removed for Guest/Delivery

    // For consistency, if name is provided, good. If not, we let backend handle it (defaults to Guest XXX).

    const orderType = tableNumber ? 'dine-in' : 'delivery';

    // Phone and address only required for delivery orders (not table orders)
    if (orderType === 'delivery') {
      if (!customerPhone.trim()) {
        toast({ title: 'Required', description: 'Please enter your phone number.', variant: 'destructive' });
        return;
      }
      if (!deliveryAddress.trim()) {
        toast({ title: 'Required', description: 'Please enter your delivery address.', variant: 'destructive' });
        return;
      }
      // Payment slip upload required for delivery orders (manual verification by cashier)
      if (!paymentProof) {
        toast({ title: 'Payment Slip Required', description: 'Please upload your payment slip before placing the order.', variant: 'destructive' });
        // Trigger shake animation
        setShowUploadError(true);
        setTimeout(() => setShowUploadError(false), 1000); // Reset after animation
        return;
      }
    }

    // Validate password if creating account
    if (createAccount && (!password || password.length < 6)) {
      toast({ title: 'Invalid Password', description: 'Password must be at least 6 characters.', variant: 'destructive' });
      return;
    }

    // CRITICAL: Check if user is logged in - if so, link order to their account
    const isLoggedIn = !!currentUser;

    const orderData = {
      customerName: customerName.trim() || currentUser?.name,
      customerPhone: tableNumber ? undefined : customerPhone.trim(),
      deliveryAddress: tableNumber ? undefined : deliveryAddress.trim(),
      paymentProof,
      requestedDeliveryTime,
      businessUnitId: selectedStore,
      orderType: tableNumber ? 'dine-in' : 'delivery',
      tableNumber: tableNumber || undefined,
      // ONLY treat as guest if NOT logged in AND not a table order AND not creating account
      isGuest: !isLoggedIn && !tableNumber && !createAccount,
      // Pass customer ID if logged in so backend links order to account
      customerId: isLoggedIn ? currentUser.id : undefined,
      // Include password for in-checkout account creation (will be hashed on backend)
      createAccountPassword: createAccount ? password : undefined,
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

  // Get product image
  const getProductImage = (item: MenuItem) => {
    if (item.imageData) return item.imageData;
    if (item.imageUrl) return item.imageUrl;
    return null;
  };

  // Group standard items by category
  const groupedStandardItems = standardMenu.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  const hasMenuItems = dailySpecials.length > 0 || standardMenu.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-amber-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-orange-200 dark:border-slate-700 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings?.storeLogoUrl && (
                <img
                  src={settings.storeLogoUrl}
                  alt={settings.storeName}
                  className="h-10 w-10 rounded-full object-cover"
                />
              )}
              <div>
                <h1 className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  ChawChaw Restaurant
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Online Ordering
                </p>
              </div>
            </div>

            {/* Store Branding - Static */}
            {/* Store Selector removed for hardcoded restaurant mode */}

            {/* Cart Button */}
            <Sheet open={cartOpen} onOpenChange={setCartOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-orange-500">
                      {cartCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md flex flex-col">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Your Cart ({cartCount} items)
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto mt-4">
                  {cart.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      Your cart is empty
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                        >
                          {getProductImage(item) && (
                            <img
                              src={getProductImage(item)!}
                              alt={item.name}
                              className="h-12 w-12 rounded object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{item.name}</p>
                            <p className="text-xs text-slate-500">
                              {formatCurrency(item.price)} x {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm">{item.quantity}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-500"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {cart.length > 0 && (
                  <SheetFooter className="mt-4 border-t pt-4">
                    <div className="w-full space-y-4">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-orange-600">{formatCurrency(cartTotal)}</span>
                      </div>
                      <Button
                        className="w-full bg-orange-500 hover:bg-orange-600"
                        onClick={() => {
                          setCartOpen(false);
                          setCheckoutOpen(true);
                        }}
                      >
                        Proceed to Checkout
                      </Button>
                    </div>
                  </SheetFooter>
                )}
              </SheetContent>
            </Sheet>

            {/* Customer Account Controls */}
            <div className="flex gap-2">
              {currentUser ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex bg-orange-50 text-orange-700 border-orange-200 gap-2 px-3">
                      <User className="h-4 w-4" />
                      <span className="hidden md:inline">{currentUser.name}</span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{currentUser.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{currentUser.phone}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => window.location.href = '/my-profile'}>
                      <User className="mr-2 h-4 w-4" />
                      <span>My Account</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.location.href = '/my-orders'}>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      <span>My Orders</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => handleLogout()}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="ghost"
                  className="flex text-slate-600 px-2"
                  onClick={() => setLoginOpen(true)}
                >
                  <User className="h-5 w-5 md:hidden" />
                  <span className="hidden md:inline">Login</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pb-24">
        {menuLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : !hasMenuItems ? (
          <div className="text-center py-20">
            <Store className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <h2 className="text-xl font-semibold text-slate-600 dark:text-slate-400">
              No Menu Items Available
            </h2>
            <p className="text-slate-500 mt-2">
              Please check back later or contact the store.
            </p>
          </div>
        ) : (
          <>
            {/* Table Welcome Banner */}
            {tableNumber && (
              <div className="mb-8 p-6 bg-green-50 dark:bg-green-950/30 border-2 border-green-200 dark:border-green-800 rounded-xl flex items-center gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                  <Coffee className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-green-800 dark:text-green-200">
                    Welcome! You are ordering from Table {tableNumber}
                  </h2>
                  <p className="text-green-600 dark:text-green-400">
                    Add items to your cart and place your order. We'll bring the food to you!
                  </p>
                </div>
              </div>
            )}

            {/* Section 1: Today's Specials (Hero Section) */}
            {dailySpecials.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6 border-b border-orange-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-red-600 dark:from-orange-400 dark:to-red-400">
                      🌟 Today's Specials
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">Chef's recommended highlights for today</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dailySpecials.map(item => (
                    <Card
                      key={item.id}
                      className="overflow-hidden hover:shadow-xl transition-all cursor-pointer group border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-white dark:from-slate-800 dark:to-slate-900"
                      onClick={() => addToCart(item)}
                    >
                      <div className="flex">
                        {/* Image */}
                        <div className="w-1/3 min-h-[140px] bg-orange-100 dark:bg-slate-700 relative overflow-hidden">
                          {getProductImage(item) ? (
                            <img
                              src={getProductImage(item)!}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-orange-300">
                              <Store className="h-12 w-12" />
                            </div>
                          )}
                          {/* Recommended Badge */}
                          <Badge className="absolute top-2 left-2 bg-orange-500 text-white shadow-lg">
                            <Star className="h-3 w-3 mr-1 fill-white" />
                            Recommended
                          </Badge>
                          {item.stock <= 0 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <Badge variant="destructive">Sold Out</Badge>
                            </div>
                          )}
                          {/* Special Stock Logic for "Sold Out" overlay if specialStock is 0 */}
                          {item.isDailySpecial && (item.specialStock !== undefined && item.specialStock <= 0) && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <Badge variant="destructive">Sold Out</Badge>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <CardContent className="flex-1 p-4 flex flex-col justify-between">
                          <div>
                            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">
                              {item.name}
                            </h3>
                            {item.category && (
                              <p className="text-sm text-slate-500">{item.category}</p>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <p className="text-2xl font-bold text-orange-600">
                              {formatCurrency(item.price)}
                            </p>
                            <Button
                              className={`bg-orange-500 hover:bg-orange-600 ${(item.isDailySpecial ? (item.specialStock ?? 0) <= 0 : item.stock <= 0) ? "opacity-50 cursor-not-allowed" : ""}`}
                              disabled={item.isDailySpecial ? (item.specialStock ?? 0) <= 0 : item.stock <= 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(item);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </div>
                          {/* Low Stock Warning */}
                          {(item.isDailySpecial ? (item.specialStock ?? 0) : item.stock) > 0 &&
                            (item.isDailySpecial ? (item.specialStock ?? 0) : item.stock) <= 5 && (
                              <p className="text-xs text-orange-600 mt-2">
                                Only {(item.isDailySpecial ? item.specialStock : item.stock)} left!
                              </p>
                            )}
                        </CardContent>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Section 2: Standard Menu & Add-ons (Compact Grid) */}
            {standardMenu.length > 0 && (
              <section className="mt-8">
                <div className="flex items-center gap-3 mb-6 border-b border-blue-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 dark:bg-slate-800 dark:text-blue-400">
                    <Coffee className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                      🍽️ Standard Menu & Add-ons
                    </h2>
                    <p className="text-sm text-slate-500">Regular favorites, sides, and drinks</p>
                  </div>
                </div>

                {/* Grouped by Category */}
                {Object.entries(groupedStandardItems).map(([category, items]) => (
                  <div key={category} className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                      <span className="h-0.5 w-3 bg-blue-400 rounded" />
                      {category}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {items.map(item => (
                        <Card
                          key={item.id}
                          className={`overflow-hidden hover:shadow-md transition-all group ${item.stock <= 0 ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          onClick={() => {
                            if (item.stock > 0) addToCart(item);
                          }}
                        >
                          {/* Compact Image */}
                          <div className="aspect-square bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                            {getProductImage(item) ? (
                              <img
                                src={getProductImage(item)!}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Coffee className="h-8 w-8" />
                              </div>
                            )}
                            {item.stock <= 0 && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <Badge variant="destructive" className="text-xs">Sold Out</Badge>
                              </div>
                            )}
                          </div>
                          <CardContent className="p-2">
                            <h4 className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
                              {item.name}
                            </h4>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-sm font-bold text-blue-600">
                                {formatCurrency(item.price)}
                              </p>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={item.stock <= 0}
                                className={`h-7 w-7 p-0 text-blue-600 hover:bg-blue-100 ${item.stock <= 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(item);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>

      {/* Sticky Cart Button (Mobile) */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-orange-200 dark:border-slate-700 z-50 shadow-lg">
          <Button
            className="w-full bg-orange-500 hover:bg-orange-600 shadow-lg py-6 text-base"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            View Cart ({cartCount}) - {formatCurrency(cartTotal)}
          </Button>
        </div>
      )}

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
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
                  ? "Review your items and place your order"
                  : "Fill in your delivery details and upload payment proof"
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
              <div className="space-y-4">
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

              {/* Create Account Option - Only show for delivery orders when not logged in */}
              {!tableNumber && !currentUser && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createAccount}
                      onChange={(e) => setCreateAccount(e.target.checked)}
                      className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium text-blue-800 dark:text-blue-200">
                        Create an account for faster checkout?
                      </span>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Track orders, view history, and leave feedback
                      </p>
                    </div>
                  </label>

                  {createAccount && (
                    <div className="mt-4 animate-in slide-in-from-top-2">
                      <Label htmlFor="checkoutPassword" className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2 block">
                        Create Password *
                      </Label>
                      <Input
                        id="checkoutPassword"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        className="border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                      {password && password.length < 6 && (
                        <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Payment Info - Only show for delivery orders */}
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
                    {settings?.storePhone && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        <Phone className="h-3 w-3 inline mr-1" />
                        {settings.storePhone}
                      </p>
                    )}
                  </div>

                  {/* Premium Upload Zone */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">
                      Upload Payment Slip *
                    </Label>

                    {!paymentProof ? (
                      <div className={`relative border-2 border-dashed rounded-lg p-6 text-center bg-white dark:bg-slate-800 hover:border-orange-400 transition-all cursor-pointer ${showUploadError
                        ? 'border-red-500 animate-[shake_0.5s_ease-in-out] bg-red-50 dark:bg-red-950'
                        : 'border-orange-300 dark:border-orange-700'
                        }`}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            setShowUploadError(false); // Reset error on file select
                            handleFileUpload(e);
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <CloudUpload className={`h-10 w-10 mx-auto mb-2 ${showUploadError ? 'text-red-400' : 'text-orange-400'}`} />
                        <p className={`text-sm font-medium ${showUploadError ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {showUploadError ? '⚠️ Please upload your payment slip first!' : 'Click to upload payment slip'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          PNG, JPG up to 5MB
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
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
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        </div>

                        {/* Payment Slip Upload Confirmation - Manual verification by cashier */}
                        {!tableNumber && (
                          <div className="flex flex-col items-center gap-1 p-3 bg-green-50 dark:bg-green-950 border-2 border-green-500 dark:border-green-700 rounded-lg">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                                ✓ Payment Slip Uploaded
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Please wait for staff to confirm your order.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
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
                        <span className="text-slate-500">× {item.quantity}</span>
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
                onClick={() => setCheckoutOpen(false)}
                className="flex-1 border-slate-300 hover:bg-slate-100"
              >
                Cancel
              </Button>
              {/* Place Order Button */}
              <Button
                onClick={handleSubmitOrder}
                disabled={cart.length === 0 || createOrderMutation.isPending || (!tableNumber && !paymentProof)}
                className="w-full h-14 text-lg font-bold bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {createOrderMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Place Order
                  </>
                )}
              </Button>
            </div>

            {/* Payment Status for Delivery Orders */}
            {!tableNumber && cart.length > 0 && (
              <div className="mt-3 text-center">
                {paymentProof ? (
                  <div className="flex flex-col items-center gap-1 text-green-600">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Payment Slip Uploaded ✅</span>
                    </div>
                    <p className="text-xs text-slate-500">Please wait for staff to confirm your order.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">Payment Slip Required</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Upload your payment slip to place your order
                    </p>
                  </div>
                )}
              </div>
            )}
          </div >
        </DialogContent >
      </Dialog >

      {/* Order Success Dialog */}
      < Dialog open={orderSuccess} onOpenChange={setOrderSuccess} >
        <DialogContent>
          <div className="text-center py-6">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${conversionSuccess ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
              {conversionSuccess ? <User className="h-8 w-8" /> : <CheckCircle className="h-10 w-10" />}
            </div>

            <DialogTitle className="text-2xl mb-2">
              {conversionSuccess ? 'Welcome Aboard!' : 'Order Confirmed!'}
            </DialogTitle>

            <DialogDescription className="text-base">
              {conversionSuccess
                ? 'Your account has been created successfully.'
                : 'Your order has been placed successfully.'}
            </DialogDescription>

            {!conversionSuccess && !tableNumber && customerPhone && (
              <div className="mt-6 p-4 bg-orange-50 dark:bg-slate-800 rounded-xl border border-orange-100 dark:border-slate-700 animate-in slide-in-from-bottom-5">
                <h4 className="font-bold text-orange-700 dark:text-orange-400 mb-2 flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Save your details for next time?
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Create a password to track orders and checkout faster.
                </p>
                <div className="flex gap-2 max-w-sm mx-auto">
                  <Input
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white dark:bg-slate-900"
                  />
                  <Button onClick={handleConvertToAccount} className="bg-orange-600 hover:bg-orange-700">
                    Save
                  </Button>
                </div>
              </div>
            )}

            <p className="mt-4 text-sm text-slate-500">
              Order ID: <span className="font-mono font-semibold">{orderId.slice(0, 8)}</span>
            </p>

            <Button
              className="mt-6 w-full max-w-sm bg-slate-100 text-slate-900 hover:bg-slate-200"
              variant="ghost"
              onClick={() => setOrderSuccess(false)}
            >
              Close & Continue Shopping
            </Button>
          </div>
        </DialogContent>
      </Dialog >

      {/* PWA Install Banner */}
      < LunchMenuInstallBanner />

      {/* Footer */}
      < footer className="bg-white dark:bg-slate-900 border-t border-orange-200 dark:border-slate-700 py-4 mt-8" >
        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
          <p>ChawChaw Restaurant - Online Ordering System</p>
          {settings?.storePhone && (
            <p className="mt-1">
              <Phone className="h-3 w-3 inline mr-1" />
              {settings.storePhone}
            </p>
          )}
          {settings?.storeAddress && (
            <p className="mt-1">
              <MapPin className="h-3 w-3 inline mr-1" />
              {settings.storeAddress}
            </p>
          )}
        </div>
      </footer >

      {/* Login Dialog */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customer Login</DialogTitle>
            <DialogDescription>
              Login to track your orders and checkout faster.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                placeholder="09..."
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="******"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoginOpen(false)}>Cancel</Button>
            <Button onClick={handleLogin} className="bg-orange-600 hover:bg-orange-700">Login</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
