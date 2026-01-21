import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io as socketIO } from 'socket.io-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '@/lib/api-config';
import { useToast } from '@/hooks/use-toast';
import { useBusinessMode } from '@/contexts/BusinessModeContext';
import { useAuth } from '@/lib/auth-context';
import { GroceryGrid } from '@/components/sales/GroceryGrid';
import { TableGrid } from '@/components/sales/TableGrid';
import { CartSection } from '@/components/sales/CartSection';
import { TableGridSelection } from '@/components/sales/TableGridSelection';
import { POSOrderingInterface } from '@/components/sales/POSOrderingInterface';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ReceiptTemplate from '@/components/ReceiptTemplate';
import { AlertTriangle, Clock, LogIn } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BusinessUnit, CartItem, CurrentShift, Customer, Product, Sale, SaleItem, Table } from '@shared/schema';
import { FloatingCartButton } from '@/components/sales/FloatingCartButton';
import { CartDrawer } from '@/components/sales/CartDrawer';
import { CateringOrderModal } from '@/components/catering/CateringOrderModal';

type TableWithOrder = Omit<Table, 'currentOrder'> & {
  orderCart?: CartItem[];
  currentOrder?: { items: CartItem[]; total: number } | null;
  customerId?: string;
  customer_id?: string;
  activeSaleId?: string | null;
};

interface EnrichedProduct extends Product {
  businessUnitId?: string | null;
}

interface OrderTableResponse {
  table?: TableWithOrder;
  newItems?: Array<{ quantity: number }>;
}

function ReceiptModal({
  open,
  onOpenChange,
  sale,
  paymentMethod,
  amountReceived,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  paymentMethod: Sale['paymentMethod'] | '';
  amountReceived: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receipt</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {sale ? (
            <ReceiptTemplate
              cartItems={(sale.items || []).map((i: SaleItem) => ({
                name: i.productName,
                quantity: Number(i.quantity) || 0,
                price: Number(i.unitPrice) || 0,
                total:
                  Number(i.total) ||
                  (Number(i.unitPrice) || 0) * (Number(i.quantity) || 0),
              }))}
              total={Number(sale.total) || 0}
              discount={Number(sale.discount) || 0}
              paymentMethod={sale.paymentMethod || ''}
              date={sale.timestamp || new Date().toISOString()}
              orderId={sale.id || ''}
              amountGiven={paymentMethod === 'cash' ? amountReceived : undefined}
              change={
                paymentMethod === 'cash'
                  ? Math.max(0, amountReceived - (Number(sale.total) || 0))
                  : undefined
              }
            />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={() => window.print()}>
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const Sales = () => {
  const { t } = useTranslation();
  const { businessUnit, setBusinessUnit } = useBusinessMode();
  const { currentStaff } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<Sale['paymentMethod'] | ''>('');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const customerSelectTriggerRef = useRef<HTMLButtonElement>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState<Sale['paymentMethod'] | ''>('');
  const [receiptAmountReceived, setReceiptAmountReceived] = useState<number>(0);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [paymentSlipUrl, setPaymentSlipUrl] = useState<string>('');
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<TableWithOrder | null>(null);
  const [tableSearchTerm, setTableSearchTerm] = useState('');

  // View Mode State
  const [viewMode, setViewMode] = useState<'table-selection' | 'ordering'>('table-selection');

  const { toast } = useToast();

  const isWaiter = currentStaff?.role === 'waiter';
  const isCashierLike = currentStaff?.role === 'cashier' || currentStaff?.role === 'manager' || currentStaff?.role === 'owner';

  // Get business unit ID from context
  const businessUnits = useQuery<BusinessUnit[]>({
    queryKey: ['/api/business-units'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/business-units`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch business units');
      return response.json();
    }
  });

  // BusinessModeContext stores the businessUnit as the business unit ID (UUID)
  const businessUnitId = businessUnit;
  const currentBusinessUnit = businessUnits.data?.find(u => u.id === businessUnitId) || null;
  const businessUnitName = currentBusinessUnit?.name || businessUnit || '';

  // Strict type checking for restaurant mode
  const isRestaurantMode =
    (currentBusinessUnit?.type?.toLowerCase() === 'restaurant') ||
    (currentBusinessUnit?.name?.toLowerCase() === 'restaurant');

  const tableCartKey = (tableId: string) => `table_cart:${businessUnitId || 'none'}:${tableId}`;

  const { data: currentShift, refetch: refetchShift } = useQuery<CurrentShift | null>({
    queryKey: ['/api/shifts/current'],
  });

  // State for open shift dialog
  const [showOpenShiftDialog, setShowOpenShiftDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [showCateringModal, setShowCateringModal] = useState(false);

  // Open shift mutation for waiter/staff
  const openShiftMutation = useMutation({
    mutationFn: async (data: { staffId: string; staffName: string; openingCash: number; businessUnitId?: string | null }) => {
      const response = await fetch(`${API_BASE_URL}/api/shifts/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to open shift');
      }
      return response.json();
    },
    onSuccess: () => {
      refetchShift();
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/current'] });
      setShowOpenShiftDialog(false);
      setOpeningCash('');
      toast({ title: 'Shift Opened', description: 'You can now start processing sales.' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to open shift',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const closeShiftMutation = useMutation({
    mutationFn: async (data: { shiftId: string; actualCash: number }) => {
      const response = await fetch(`${API_BASE_URL}/api/shifts/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to close shift');
      }
      return response.json();
    },
    onSuccess: () => {
      refetchShift();
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/current'] });
      toast({ title: 'Shift Closed', description: 'Shift has been closed.' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to close shift',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const waiterClockInMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ startingCash: 0 }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || 'Failed to start shift');
      }
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: 'Shift Started' });
      await refetchShift();
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/current'] });
      window.location.reload();
    },
    onError: (error) => {
      toast({
        title: 'Failed to start shift',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const waiterClockOutMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const response = await fetch(`${API_BASE_URL}/api/shifts/${shiftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endingCash: 0 }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || 'Failed to end shift');
      }
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: 'Shift Ended' });
      await refetchShift();
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/current'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to end shift',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const handleOpenShift = () => {
    if (!currentStaff?.id) return;

    if (isWaiter) {
      openShiftMutation.mutate({
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        openingCash: 0,
        businessUnitId: businessUnitId,
      });
      return;
    }

    if (!openingCash) return;
    openShiftMutation.mutate({
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      openingCash: parseFloat(openingCash) || 0,
      businessUnitId: businessUnitId,
    });
  };

  const handleCloseShift = () => {
    if (!currentShift?.attendanceId) return;
    // Waiters only
    closeShiftMutation.mutate({
      shiftId: currentShift.attendanceId,
      actualCash: 0,
    });
  };

  const handleWaiterClockIn = () => {
    if (waiterClockInMutation.isPending) return;
    waiterClockInMutation.mutate();
  };

  const handleWaiterClockOut = () => {
    if (waiterClockOutMutation.isPending) return;

    const activeShiftId =
      (currentShift as any)?.id ||
      (currentShift as any)?.attendanceId ||
      (currentShift as any)?.shiftId;

    if (!activeShiftId) return;
    waiterClockOutMutation.mutate(activeShiftId);
  };

  // Check if shift is not open (for warning display)
  const isShiftNotOpen = !currentShift?.isActive;

  const isShiftMismatch =
    !!(currentShift?.isActive && currentShift?.businessUnitId && businessUnitId && currentShift.businessUnitId !== businessUnitId);

  const [shiftMismatchOpen, setShiftMismatchOpen] = useState(false);
  useEffect(() => {
    if (isShiftMismatch) {
      setShiftMismatchOpen(true);
    } else {
      setShiftMismatchOpen(false);
    }
  }, [isShiftMismatch]);

  const previousBusinessUnitIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!businessUnitId) {
      previousBusinessUnitIdRef.current = businessUnitId;
      setSelectedTable(null);
      setTableSearchTerm('');
      return;
    }

    if (previousBusinessUnitIdRef.current && previousBusinessUnitIdRef.current !== businessUnitId) {
      setCart([]);
      setSelectedCustomer('');
      setPaymentMethod('');
      setAmountReceived(0);
      setShowReceipt(false);
      setReceiptSale(null);
      setSelectedTable(null);
      setTableSearchTerm('');
    }

    previousBusinessUnitIdRef.current = businessUnitId;
  }, [businessUnitId]);

  // Reset view mode when switching business units or if table is cleared externally
  useEffect(() => {
    if (!selectedTable && viewMode === 'ordering') {
      setViewMode('table-selection');
    }
  }, [selectedTable, viewMode]);

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: [`/api/products?businessUnitId=${businessUnitId}`],
    queryFn: async () => {
      if (!businessUnitId) return [];
      const response = await fetch(`${API_BASE_URL}/api/products?businessUnitId=${businessUnitId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    }
  });

  const visibleProducts = businessUnitId
    ? products.filter((p: EnrichedProduct) => (p?.businessUnitId || null) === businessUnitId)
    : [];

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: [`/api/customers?businessUnitId=${businessUnitId}`],
    enabled: !!businessUnitId,
    queryFn: async () => {
      if (!businessUnitId) return [];
      const response = await fetch(`${API_BASE_URL}/api/customers?businessUnitId=${businessUnitId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch customers');
      return response.json();
    },
  });

  const orderTableMutation = useMutation<OrderTableResponse, Error, { tableId: string; tableNumber?: string; cart: CartItem[] }>({
    mutationFn: async ({ tableId, tableNumber, cart }: { tableId: string; tableNumber?: string; cart: CartItem[] }) => {
      if (!businessUnitId) throw new Error('Business unit not set');
      const res = await fetch(`${API_BASE_URL}/api/tables/${tableId}/order?businessUnitId=${businessUnitId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tableNumber: tableNumber || null,
          cart: cart || [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to order');
      return data as OrderTableResponse;
    },
    onSuccess: (data) => {
      const newCount = Array.isArray(data?.newItems)
        ? data.newItems.reduce((s, i) => s + (Number(i?.quantity) || 0), 0)
        : 0;
      toast({ title: 'Order Sent', description: `New items: ${newCount}` });
      if (data?.table?.id && selectedTable?.id === data.table.id) {
        setSelectedTable(data.table);
      } else if (selectedTable?.id) {
        setSelectedTable((prev) => (prev ? { ...prev, serviceStatus: 'ordered' } : prev));
      }
      queryClient.invalidateQueries({ queryKey: [`/api/tables?businessUnitId=${businessUnitId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/kitchen-tickets?businessUnitId=${businessUnitId}`] });
    },
    onError: (e) => {
      toast({
        title: 'Order Failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const checkBillMutation = useMutation<TableWithOrder, Error, { tableId: string }>({
    mutationFn: async ({ tableId }: { tableId: string }) => {
      if (!businessUnitId) throw new Error('Business unit not set');
      const res = await fetch(`${API_BASE_URL}/api/tables/${tableId}/service-status?businessUnitId=${businessUnitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ serviceStatus: 'billing' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to check bill');
      return data as TableWithOrder;
    },
    onSuccess: (data) => {
      toast({ title: 'Billing', description: 'Table is ready to pay.' });
      if (data?.id && selectedTable?.id === data.id) {
        setSelectedTable(data);
      } else if (selectedTable?.id) {
        setSelectedTable((prev) => (prev ? { ...prev, serviceStatus: 'billing' } : prev));
      }
      queryClient.invalidateQueries({ queryKey: [`/api/tables?businessUnitId=${businessUnitId}`] });
    },
  });

  const { data: tables = [], isLoading: tablesLoading } = useQuery<TableWithOrder[]>({
    queryKey: [`/api/tables?businessUnitId=${businessUnitId}`],
    queryFn: async () => {
      if (!businessUnitId) return [];
      const response = await fetch(`${API_BASE_URL}/api/tables?businessUnitId=${businessUnitId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch tables');
      return response.json();
    }
  });

  const updateQuantity = (id: string, newQuantity: number) => {
    setCart(prev => {
      const quantity = Math.max(0, newQuantity);
      if (quantity === 0) return prev.filter(item => item.id !== id);
      return prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            quantity,
            total: quantity * (Number(item.unitPrice) || 0),
          };
        }
        return item;
      });
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + ((Number(item.unitPrice) || 0) * item.quantity), 0);
  };

  const addToCart = (product: Product) => {
    if (isRestaurantMode && !selectedTable) {
      toast({ title: 'Select a table first', description: 'Tap an available table to start an order.', variant: 'destructive' });
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * (Number(item.unitPrice) || 0) }
            : item
        );
      }

      // Use proper type access
      const unitPrice = Number(product.price) || 0;
      const newItem: CartItem = {
        id: crypto.randomUUID(),
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice,
        total: unitPrice,
        name: product.name,
        price: unitPrice,
        product: product,
      };
      return [...prev, newItem];
    });
  };

  const handleScanSuccess = useCallback((decodedText: string) => {
    const product = visibleProducts.find(p => p.barcode === decodedText);
    if (product) {
      addToCart(product);
      toast({ title: "Product Added", description: `${product.name} added to cart` });
    } else {
      toast({ title: "Product Not Found", variant: "destructive" });
    }
  }, [visibleProducts, toast, addToCart]);


  // Socket.IO listener for real-time cart updates from QR menu customers
  useEffect(() => {
    if (!isRestaurantMode) return;

    const socket = socketIO(API_BASE_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('🔌 Sales page connected to Socket.IO for cart sync');
    });

    // Listen for real-time cart updates from customers
    socket.on('tableCartUpdated', async (data: any) => {
      console.log('🛒 [SALES] Real-time cart update received:', data);

      // If this is for the currently selected table, refresh the cart
      if (selectedTable && (
        String(selectedTable.id) === String(data.tableId) ||
        String(selectedTable.number) === String(data.tableNumber)
      )) {
        console.log('🔄 [SALES] Refreshing cart for selected table:', selectedTable.number);

        // Update cart with the new items from the socket event
        if (data.cart && Array.isArray(data.cart)) {
          const normalizedCart: CartItem[] = data.cart.map((item: any) => {
            const unitPrice = Number(item.unitPrice ?? item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            const productName = item.productName || item.name || 'Unknown Item';

            return {
              id: item.id || crypto.randomUUID(),
              productId: item.productId,
              productName: productName,
              name: productName,
              quantity: quantity,
              unitPrice: unitPrice,
              price: unitPrice,
              total: Number(item.total) || (unitPrice * quantity),
            };
          });
          setCart(normalizedCart);

          toast({
            title: '🛒 Cart Updated',
            description: `Customer added items (${normalizedCart.length} total)`,
            duration: 3000,
          });
        }
      }

      // Invalidate tables query to refresh table status visuals
      queryClient.invalidateQueries({ queryKey: [`/api/tables?businessUnitId=${businessUnitId}`] });
    });

    // Listen for table status updates (when payment is completed)
    socket.on('tableStatusUpdated', async (data: any) => {
      console.log('✅ [SALES] Table status updated:', data);

      // Refresh tables to show updated status
      queryClient.invalidateQueries({ queryKey: [`/api/tables?businessUnitId=${businessUnitId}`] });

      // If this is the currently selected table and it was cleared, deselect it
      if (selectedTable && String(selectedTable.id) === String(data.tableId) && data.status === 'available') {
        console.log('🔄 [SALES] Clearing selected table after payment');
        setSelectedTable(null);
        setCart([]);
        toast({
          title: '✅ Payment Complete',
          description: `Table ${selectedTable.number} is now available`,
          duration: 3000,
        });
      }
    });

    // Listen for table order cleared events
    socket.on('tableOrderCleared', async (data: any) => {
      console.log('🗑️ [SALES] Table order cleared:', data);

      // Refresh tables to show cleared orders
      queryClient.invalidateQueries({ queryKey: [`/api/tables?businessUnitId=${businessUnitId}`] });
    });

    return () => {
      socket.disconnect();
    };
  }, [isRestaurantMode, selectedTable, queryClient, businessUnitId, toast]);


  const fetchTableOrderFromDb = useCallback(async (tableId: string) => {
    if (!businessUnitId) return null;
    const res = await fetch(`${API_BASE_URL}/api/tables?businessUnitId=${businessUnitId}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch tables');
    const all = (await res.json()) as TableWithOrder[];
    return all.find((t) => t.id === tableId) || null;
  }, [businessUnitId]);

  const updateTableStatusMutation = useMutation<TableWithOrder, Error, { tableId: string; status: 'available' | 'occupied' | 'reserved' }>({
    mutationFn: async ({ tableId, status }: { tableId: string; status: 'available' | 'occupied' | 'reserved' }) => {
      if (!businessUnitId) throw new Error('Business unit not set');
      const res = await fetch(`${API_BASE_URL}/api/tables/${tableId}/status?businessUnitId=${businessUnitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update table');
      return data as TableWithOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tables?businessUnitId=${businessUnitId}`] });
    },
  });

  const updateTableOrderMutation = useMutation<TableWithOrder, Error, { tableId: string; cart: CartItem[] | null }>({
    mutationFn: async ({ tableId, cart }: { tableId: string; cart: CartItem[] | null }) => {
      if (!businessUnitId) throw new Error('Business unit not set');
      const res = await fetch(`${API_BASE_URL}/api/tables/${tableId}/order?businessUnitId=${businessUnitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cart }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update table order');
      return data as TableWithOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tables?businessUnitId=${businessUnitId}`] });
    },
  });

  const addToTableOrder = (_tableId: string, _item: CartItem) => {
    // Table ordering is handled by the shared cart once a table is selected
  };

  const handleTableSelect = useCallback(async (table: TableWithOrder, autoNavigate?: boolean) => {
    try {
      setSelectedTable(table);
      if (!isRestaurantMode) return;

      const fresh = await fetchTableOrderFromDb(table.id);
      const effective = fresh || table;
      setSelectedTable(effective);

      console.log('[CART-LOAD] Table selected:', {
        tableNumber: effective.number,
        tableId: effective.id,
        hasOrderCart: !!effective.orderCart,
        orderCartLength: effective.orderCart?.length || 0,
        activeSaleId: effective.activeSaleId,
        status: effective.status,
        serviceStatus: effective.serviceStatus,
        orderCart: effective.orderCart,
        autoNavigate
      });

      // Switch to ordering view
      setViewMode('ordering');


      // Load cart items from the table's orderCart (which now includes QR order items)
      if (Array.isArray(effective.orderCart) && effective.orderCart.length > 0) {
        console.log('[CART-LOAD] Loading cart with items from table/sale:', effective.orderCart);
        // Ensure items have all required CartItem properties
        const normalizedCart: CartItem[] = effective.orderCart.map((item: any) => {
          const unitPrice = Number(item.unitPrice ?? item.price) || 0;
          const quantity = Number(item.quantity) || 0;
          const productName = item.productName || item.name || 'Unknown Item';

          // Create a minimal product object for items loaded from QR orders
          const minimalProduct: Product = {
            id: item.productId,
            name: productName,
            price: unitPrice,
            stock: 999, // Placeholder - actual stock is managed server-side
            minStockLevel: 0,
            status: 'active',
            unit: 'pcs',
            category: null,
            isDailySpecial: false,
            isStandardMenu: false,
            businessUnitId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            id: item.id || crypto.randomUUID(),
            productId: item.productId,
            productName: productName,
            name: productName,
            quantity: quantity,
            unitPrice: unitPrice,
            price: unitPrice,
            total: Number(item.total) || (unitPrice * quantity),
            product: minimalProduct,
          };
        });
        setCart(normalizedCart);
      } else {
        console.log('[CART-LOAD] No items in cart, clearing');
        setCart([]);
      }

      setSelectedCustomer('');
      setPaymentMethod('');
      setAmountReceived(0);

      // On mobile, opening drawer automatically when table is selected would be annoying
      // User can tap the FAB when they want to see the cart
    } catch (e) {
      toast({
        title: 'Failed to load table order',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [fetchTableOrderFromDb, isRestaurantMode, toast]);

  // Send to Kitchen function for waiters
  const sendToKitchen = async () => {
    if (!selectedTable?.id || cart.length === 0) {
      toast({
        title: 'Cannot Send to Kitchen',
        description: 'Please select a table and add items to the cart',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/tables/${selectedTable.id}/order?businessUnitId=${businessUnitId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tableId: selectedTable.id,
          tableNumber: selectedTable.number || undefined,
          cart: cart,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send order to kitchen');
      }

      // Clear cart after sending to kitchen
      setCart([]);

      toast({
        title: 'Order Sent to Kitchen',
        description: `Table ${selectedTable.number || selectedTable.id} order has been sent to kitchen`
      });

      // Update table status to occupied
      updateTableStatusMutation.mutate({ tableId: selectedTable.id, status: 'occupied' });

      queryClient.invalidateQueries({ queryKey: [`/api/tables?businessUnitId=${businessUnitId}`] });

      // Force the waiter to pick the next table (prevents accidental overwrite of existing table order)
      setSelectedTable(null);
      // View mode will automatically switch back to table selection via effect


    } catch (error) {
      console.error('Send to kitchen error:', error);
      toast({
        title: 'Failed to Send Order',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const completeSaleMutation = useMutation<Sale, Error, void>({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/sales/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          items: cart.map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice ?? item.price) || 0,
            total: (Number(item.unitPrice ?? item.price) || 0) * item.quantity,
          })),
          total: getTotal(),
          paymentMethod,
          customerId: selectedCustomer || undefined,
          amountReceived,
          businessUnitId,
          storeId: isRestaurantMode ? (selectedTable?.id || undefined) : undefined,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to complete sale');
      }
      return result as Sale;
    },
    onSuccess: (result) => {
      setReceiptSale(result);
      setReceiptPaymentMethod(paymentMethod);
      setReceiptAmountReceived(amountReceived);
      setShowReceipt(true);
      toast({ title: "Sale Complete", description: `Sale #${result.id} completed successfully` });
      setCart([]);
      setSelectedCustomer('');
      setPaymentMethod('');
      setAmountReceived(0);

      if (isRestaurantMode && selectedTable?.id) {
        localStorage.removeItem(tableCartKey(selectedTable.id));
        updateTableOrderMutation.mutate({ tableId: selectedTable.id, cart: null });
        updateTableStatusMutation.mutate({ tableId: selectedTable.id, status: 'available' });
        setSelectedTable(null);
      }
    },
    onError: (error) => {
      toast({
        title: "Sale Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    },
  });

  const completeSale = () => {
    if (isWaiter) {
      toast({
        title: 'Permission denied',
        description: 'Waiters cannot process payments. Send the order to kitchen instead.',
        variant: 'destructive',
      });
      return;
    }
    if (!isCashierLike) {
      toast({
        title: 'Permission denied',
        description: 'Only cashiers/managers/owners can process payments.',
        variant: 'destructive',
      });
      return;
    }
    if (cart.length === 0) {
      toast({ title: "Cart Empty", description: "Please add items to cart", variant: "destructive" });
      return;
    }
    if (!businessUnitId) {
      toast({ title: "Sale Failed", description: "Business unit is not set", variant: "destructive" });
      return;
    }

    if (isShiftMismatch) {
      setShiftMismatchOpen(true);
      toast({
        title: "Business unit mismatch",
        description: "Your open shift belongs to a different store. Switch store or open a new shift for this store.",
        variant: "destructive",
      });
      return;
    }

    completeSaleMutation.mutate();
  };

  useEffect(() => {
    const shouldIgnoreKeydown = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const isAnyDialogOpen = () => {
      return !!document.querySelector('[role="dialog"][data-state="open"]');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreKeydown(e.target)) return;
      if (isAnyDialogOpen()) return;

      if (e.key === 'F2') {
        e.preventDefault();
        productSearchRef.current?.focus();
        return;
      }

      if (e.key === 'F8') {
        e.preventDefault();
        customerSelectTriggerRef.current?.click();
        customerSelectTriggerRef.current?.focus();
        return;
      }

      if (e.key === 'F9') {
        e.preventDefault();

        if (isRestaurantMode && selectedTable?.id && selectedTable?.serviceStatus !== 'billing') {
          if (!selectedTable?.currentOrder) {
            toast({ title: 'No order yet', description: 'Send an order before checking the bill.', variant: 'destructive' });
            return;
          }
          checkBillMutation.mutate({ tableId: selectedTable.id });
          return;
        }

        completeSale();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [checkBillMutation, completeSale, isRestaurantMode, selectedTable?.currentOrder, selectedTable?.id, selectedTable?.serviceStatus, toast]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Sales - {businessUnitName}</h1>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2 font-semibold shadow-sm"
            onClick={() => setShowCateringModal(true)}
          >
            📦 {t('catering.biryaniPreorder')}
          </Button>
        </div>

        {isWaiter && !isShiftNotOpen && (
          <Button
            variant="destructive"
            onClick={handleWaiterClockOut}
            disabled={waiterClockOutMutation.isPending}
            className="gap-2"
          >
            {waiterClockOutMutation.isPending ? (
              'Clocking Out...'
            ) : (
              <>
                <Clock className="h-4 w-4" />
                Clock Out (End Shift)
              </>
            )}
          </Button>
        )}
      </div>

      {/* No Active Shift Warning */}
      {isShiftNotOpen && !isShiftMismatch && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 px-4 py-3 text-amber-900 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-amber-700 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Your shift is not open</div>
              <div className="text-sm mt-1">
                You need to open a shift before you can process sales.
              </div>
            </div>
            <Button
              variant="default"
              className={isWaiter ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}
              onClick={() => isWaiter ? handleWaiterClockIn() : setShowOpenShiftDialog(true)}
              disabled={isWaiter ? waiterClockInMutation.isPending : openShiftMutation.isPending}
            >
              <LogIn className="h-4 w-4 mr-2" />
              {isWaiter ? (waiterClockInMutation.isPending ? 'Clocking In...' : 'Clock In (Start Shift)') : 'Open Shift'}
            </Button>
          </div>
        </div>
      )}

      {/* Open Shift Dialog */}
      <Dialog open={showOpenShiftDialog} onOpenChange={setShowOpenShiftDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Open Shift
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Start your shift to begin processing sales and managing transactions.
            </p>
            <div className="space-y-2">
              <Label htmlFor="openingCash">Opening Cash Amount</Label>
              <Input
                id="openingCash"
                type="number"
                placeholder="Enter opening cash amount"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                disabled={openShiftMutation.isPending}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowOpenShiftDialog(false)}
                disabled={openShiftMutation.isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleOpenShift}
                disabled={!openingCash || openShiftMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {openShiftMutation.isPending ? 'Opening...' : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Open Shift
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shiftMismatchOpen} onOpenChange={setShiftMismatchOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Business unit mismatch</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              Active store: <span className="font-mono">{businessUnitId || '-'}</span>
            </div>
            <div>
              Open shift store: <span className="font-mono">{currentShift?.businessUnitId || '-'}</span>
            </div>
            <div className="text-muted-foreground">
              To continue, switch back to the store that owns the open shift, or close that shift and open a new shift for the current store.
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShiftMismatchOpen(false)}>
                Close
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const shiftId = currentShift?.attendanceId;
                    if (!shiftId) return;
                    const res = await fetch(`${API_BASE_URL}/api/shifts/close`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ shiftId }),
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      throw new Error(err?.error || 'Failed to close shift');
                    }
                    queryClient.invalidateQueries({ queryKey: ['/api/shifts/current'] });
                    setShiftMismatchOpen(false);
                    toast({ title: 'Shift Closed', description: 'Now open a new shift for the current store.' });
                  } catch (e) {
                    toast({
                      title: 'Close shift failed',
                      description: e instanceof Error ? e.message : 'Unknown error',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                Close shift
              </Button>
              <Button
                onClick={() => {
                  if (currentShift?.businessUnitId) {
                    setBusinessUnit(currentShift.businessUnitId);
                  }
                }}
              >
                Switch to shift store
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ReceiptModal
        open={showReceipt}
        onOpenChange={setShowReceipt}
        sale={receiptSale}
        paymentMethod={receiptPaymentMethod}
        amountReceived={receiptAmountReceived}
      />
      <div className="grid grid-cols-1 gap-6">
        <div className="w-full">
          {isRestaurantMode ? (
            <AnimatePresence mode="wait">
              {viewMode === 'table-selection' ? (
                <TableGridSelection
                  key="table-selection"
                  tables={tables as any} // Cast to bypass strict type check for refactor
                  onTableSelect={handleTableSelect}
                  selectedTable={selectedTable as any}
                  addToTableOrder={addToTableOrder}
                  businessUnitId={businessUnitId}
                  showSearch={true}
                />
              ) : (
                <POSOrderingInterface
                  key="ordering"
                  products={visibleProducts}
                  productsLoading={productsLoading}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  onScanSuccess={handleScanSuccess}
                  addToCart={addToCart}
                  searchInputRef={productSearchRef}
                  cart={cart}
                  updateQuantity={updateQuantity}
                  removeFromCart={removeFromCart}
                  getTotal={getTotal}
                  customers={customers}
                  selectedCustomer={selectedCustomer}
                  setSelectedCustomer={setSelectedCustomer}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  amountReceived={amountReceived}
                  setAmountReceived={setAmountReceived}
                  completeSale={completeSale}
                  completeSaleMutation={completeSaleMutation}
                  showCameraModal={showCameraModal}
                  setShowCameraModal={setShowCameraModal}
                  paymentSlipUrl={paymentSlipUrl}
                  selectedTable={selectedTable as any}
                  onSendToKitchen={sendToKitchen}
                  isRestaurantMode={isRestaurantMode}
                  onBackToTables={() => setViewMode('table-selection')}
                  customerSelectTriggerRef={customerSelectTriggerRef}
                  businessUnitId={businessUnitId}
                  lastSaleId={receiptSale?.id}
                  lastSaleTotal={receiptSale?.total}
                  onKitchenOrderSent={() => {
                    queryClient.invalidateQueries({ queryKey: [`/api/tables?businessUnitId=${businessUnitId}`] });
                    // Provide option to go back or stay? For now stay to allow ordering more or checking bill
                  }}
                />
              )}
            </AnimatePresence>
          ) : (
            // Non-restaurant mode (Retail) - Direct Ordering Interface but adapted layout
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <GroceryGrid
                  products={visibleProducts}
                  productsLoading={productsLoading}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  onScanSuccess={handleScanSuccess}
                  addToCart={addToCart}
                  searchInputRef={productSearchRef}
                  cart={cart}
                  updateQuantity={updateQuantity}
                />
              </div>
              {/* Desktop Cart for Retail Mode */}
              <div className="hidden lg:block">
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
                  showCameraModal={showCameraModal}
                  setShowCameraModal={setShowCameraModal}
                  paymentSlipUrl={paymentSlipUrl}
                  amountReceived={amountReceived}
                  setAmountReceived={setAmountReceived}
                  selectedTable={selectedTable as any}
                  onSendToKitchen={sendToKitchen}
                  isRestaurantMode={isRestaurantMode}
                  businessUnitId={businessUnitId || undefined}
                />
              </div>
            </div>
          )}
        </div>


      </div>

      {/* Mobile: Floating Cart Button + Drawer */}
      {(isRestaurantMode && selectedTable) || !isRestaurantMode ? (
        <>
          <FloatingCartButton
            cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
            onClick={() => setCartDrawerOpen(true)}
          />
          <CartDrawer
            open={cartDrawerOpen}
            onClose={() => setCartDrawerOpen(false)}
          >
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
              showCameraModal={showCameraModal}
              setShowCameraModal={setShowCameraModal}
              lastSaleId={receiptSale?.id}
              lastSaleTotal={receiptSale?.total}
              paymentSlipUrl={paymentSlipUrl}
              amountReceived={amountReceived}
              setAmountReceived={setAmountReceived}
              onSendToKitchen={sendToKitchen}
              isRestaurantMode={isRestaurantMode}
              selectedTable={selectedTable}
              customerSelectTriggerRef={customerSelectTriggerRef}
              businessUnitId={businessUnitId}
              onKitchenOrderSent={() => {
                queryClient.invalidateQueries({ queryKey: [`/api/tables?businessUnitId=${businessUnitId}`] });
                // Close drawer after sending to kitchen
                setCartDrawerOpen(false);
              }}
            />
          </CartDrawer>
        </>
      ) : null}
      <CateringOrderModal
        open={showCateringModal}
        onOpenChange={setShowCateringModal}
      />
    </div>
  );
};

export default Sales;