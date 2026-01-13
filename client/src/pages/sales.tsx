import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/api-config';
import { useToast } from '@/hooks/use-toast';
import { useBusinessMode } from '@/contexts/BusinessModeContext';
import { useAuth } from '@/lib/auth-context';
import { GroceryGrid } from '@/components/sales/GroceryGrid';
import { TableGrid } from '@/components/sales/TableGrid';
import { CartSection } from '@/components/sales/CartSection';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ReceiptTemplate from '@/components/ReceiptTemplate';
import { AlertTriangle } from 'lucide-react';
import type { BusinessUnit, CartItem, CurrentShift, Customer, Product, Sale, SaleItem, Table } from '@shared/schema';

type TableWithOrder = Omit<Table, 'currentOrder'> & {
  orderCart?: CartItem[];
  currentOrder?: { items: CartItem[]; total: number } | null;
  customerId?: string;
  customer_id?: string;
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
  const { businessUnit, setBusinessUnit } = useBusinessMode();
  const { currentStaff } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<Sale['paymentMethod'] | ''>('');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState<Sale['paymentMethod'] | ''>('');
  const [receiptAmountReceived, setReceiptAmountReceived] = useState<number>(0);
  const { toast } = useToast();

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

  const { data: currentShift } = useQuery<CurrentShift | null>({
    queryKey: ['/api/shifts/current'],
  });

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

  const mockTables = tables;

  const [selectedTable, setSelectedTable] = useState<TableWithOrder | null>(null);
  const [tableSearchTerm, setTableSearchTerm] = useState('');

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

  const handleTableSelect = (table: TableWithOrder) => {
    setSelectedTable(table);

    if (!businessUnitId) return;

    if (Array.isArray(table?.orderCart)) {
      setCart(table.orderCart);
    } else {
      const key = tableCartKey(table.id);
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setCart(parsed);
          } else {
            setCart([]);
          }
        } catch {
          setCart([]);
        }
      } else {
        setCart([]);
      }
    }

    if (table.status === 'available') {
      setSelectedCustomer('');
      setPaymentMethod('');
      setAmountReceived(0);
      updateTableStatusMutation.mutate({ tableId: table.id, status: 'occupied' });
      updateTableOrderMutation.mutate({ tableId: table.id, cart: [] });
    }
  };

  useEffect(() => {
    if (!isRestaurantMode) return;
    if (!selectedTable?.id) return;
    if (!businessUnitId) return;
    localStorage.setItem(tableCartKey(selectedTable.id), JSON.stringify(cart));

    const t = setTimeout(() => {
      updateTableOrderMutation.mutate({ tableId: selectedTable.id, cart });
    }, 400);
    return () => clearTimeout(t);
  }, [cart, selectedTable?.id, businessUnitId, isRestaurantMode]);

  const completeSaleMutation = useMutation<Sale, Error, void>({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/sales`, {
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
    if (isRestaurantMode && selectedTable?.id && selectedTable?.serviceStatus !== 'billing') {
      toast({
        title: 'Not Ready to Pay',
        description: 'Click Check Bill before completing the sale.',
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Sales - {businessUnitName}</h1>

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
                    const shiftId = currentShift?.shiftId || currentShift?.attendanceId;
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {isRestaurantMode ? (
            <div className="space-y-6">
              <TableGrid
                tables={mockTables}
                onTableSelect={handleTableSelect}
                selectedTable={selectedTable}
                addToTableOrder={addToTableOrder}
                showSearch={false}
              />
              {selectedTable ? (
                <GroceryGrid
                  products={visibleProducts}
                  productsLoading={productsLoading}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  onScanSuccess={handleScanSuccess}
                  addToCart={addToCart}
                />
              ) : (
                <div className="text-sm text-muted-foreground">
                  Select an available table to start an order and load the menu.
                </div>
              )}
            </div>
          ) : (
            <GroceryGrid
              products={visibleProducts}
              productsLoading={productsLoading}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onScanSuccess={handleScanSuccess}
              addToCart={addToCart}
            />
          )}
        </div>
        <div>
          {isShiftMismatch ? (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Shift mismatch</div>
                  <div className="text-sm mt-1">
                    Your open shift belongs to a different store. Switch back to your shift store to continue.
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-amber-300 bg-white"
                  disabled={!currentStaff?.businessUnitId}
                  onClick={() => {
                    if (currentStaff?.businessUnitId) {
                      setBusinessUnit(currentStaff.businessUnitId);
                    }
                  }}
                >
                  Switch back to Shift Store
                </Button>
              </div>
            </div>
          ) : null}
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
            showMobilePayment={false}
            setShowMobilePayment={() => { }}
            showCameraModal={false}
            setShowCameraModal={() => { }}
            amountReceived={amountReceived}
            setAmountReceived={setAmountReceived}
            isRestaurantMode={isRestaurantMode}
            selectedTable={selectedTable}
            onOrder={() => {
              if (!selectedTable?.id) return;

              const currentCart = cart;
              const alreadySent = Array.isArray(selectedTable?.orderCart) ? selectedTable.orderCart : [];

              if (currentCart.length === 0) {
                toast({ title: 'Cart Empty', description: 'Add items before ordering.', variant: 'destructive' });
                return;
              }

              const keyOf = (it: CartItem) => String(it.productId || it.id || it.name || '');
              const toQtyMap = (arr: CartItem[]) => {
                const m = new Map<string, number>();
                for (const it of arr) {
                  const k = keyOf(it);
                  const q = Number(it.quantity) || 0;
                  if (!k) continue;
                  m.set(k, (m.get(k) || 0) + q);
                }
                return m;
              };

              const cartMap = toQtyMap(currentCart);
              const sentMap = toQtyMap(alreadySent);
              const isIdentical = cartMap.size === sentMap.size && Array.from(cartMap.entries()).every(([k, q]) => (sentMap.get(k) || 0) === q);

              if (isIdentical) {
                toast({ title: 'No new items to order', description: 'Add new items or increase quantity before ordering.', variant: 'destructive' });
                return;
              }

              orderTableMutation.mutate({
                tableId: selectedTable.id,
                tableNumber: selectedTable.number,
                cart: currentCart,
              });
            }}
            orderPending={orderTableMutation.isPending}
            onCheckBill={() => {
              if (!selectedTable?.id) return;
              if (!selectedTable?.currentOrder) {
                toast({ title: 'No order yet', description: 'Send an order before checking the bill.', variant: 'destructive' });
                return;
              }

              const tableCustomerId = selectedTable.customerId || selectedTable.customer_id;
              if (typeof tableCustomerId === 'string' && tableCustomerId.trim().length > 0) {
                setSelectedCustomer(tableCustomerId);
              }

              checkBillMutation.mutate({ tableId: selectedTable.id });
            }}
            checkBillPending={checkBillMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
};

export default Sales;