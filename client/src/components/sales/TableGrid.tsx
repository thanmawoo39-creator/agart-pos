import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io as socketIO } from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, Minus, Search, Clock, Bell } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { API_BASE_URL } from '@/lib/api-config';
import type { CartItem, Table as SchemaTable } from '@shared/schema';
import { useCurrency } from '@/hooks/use-currency';
import { useToast } from '@/hooks/use-toast';

export type TableWithOrder = Omit<SchemaTable, 'currentOrder'> & {
  currentOrder?: { items: CartItem[]; total: number } | null;
  orderCart?: CartItem[];
  customerId?: string;
  customer_id?: string;
  activeSaleId?: string | null;
};

interface TableGridProps {
  tables: TableWithOrder[];
  onTableSelect: (table: TableWithOrder, autoNavigate?: boolean) => void;
  selectedTable: TableWithOrder | null;
  addToTableOrder: (tableId: string, item: CartItem) => void;
  searchTerm?: string;
  setSearchTerm?: (term: string) => void;
  showSearch?: boolean;
  businessUnitId?: string;
}

export function TableGrid({
  tables,
  onTableSelect,
  selectedTable,
  addToTableOrder,
  searchTerm,
  setSearchTerm,
  showSearch = true,
  businessUnitId
}: TableGridProps) {
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  // Order dialog removed - auto-navigate on mobile instead
  const [newOrderTables, setNewOrderTables] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Socket.IO connection for real-time table updates
  useEffect(() => {
    const socket = socketIO(API_BASE_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('🔌 Table Map connected to Socket.IO');
    });

    socket.on('newOrder', (data: any) => {
      console.log('📦 New order received:', data);
      // Invalidate both sales and tables queries to refresh table statuses and cart data
      queryClient.invalidateQueries({
        queryKey: [`/api/sales?businessUnitId=${businessUnitId}`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/tables?businessUnitId=${businessUnitId}`]
      });
    });

    // New QR Order - Show prominent notification
    socket.on('newQROrder', (data: any) => {
      console.log('📱 NEW QR ORDER RECEIVED:', data);

      // Add table to "new order" set for visual highlight
      if (data.tableNumber) {
        setNewOrderTables(prev => new Set(prev).add(String(data.tableNumber)));

        // Auto-clear highlight after 30 seconds
        setTimeout(() => {
          setNewOrderTables(prev => {
            const next = new Set(prev);
            next.delete(String(data.tableNumber));
            return next;
          });
        }, 30000);
      }

      // Show toast notification
      toast({
        title: `🔔 New QR Order - Table ${data.tableNumber}`,
        description: `${data.items?.length || 0} items • Total: ${data.total?.toLocaleString() || 0}`,
        duration: 10000,
      });

      // Play notification sound (if available)
      try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => { });
      } catch (e) { }

      // Refresh data
      queryClient.invalidateQueries({
        queryKey: [`/api/sales?businessUnitId=${businessUnitId}`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/tables?businessUnitId=${businessUnitId}`]
      });
    });

    socket.on('tableOrderUpdated', (data: any) => {
      console.log('🍽️ Table order updated:', data);

      // If it's a QR order, show notification
      if (data.orderSource === 'qr' && data.tableNumber) {
        setNewOrderTables(prev => new Set(prev).add(String(data.tableNumber)));
        setTimeout(() => {
          setNewOrderTables(prev => {
            const next = new Set(prev);
            next.delete(String(data.tableNumber));
            return next;
          });
        }, 30000);
      }

      // Refresh tables to get updated cart items
      queryClient.invalidateQueries({
        queryKey: [`/api/tables?businessUnitId=${businessUnitId}`]
      });
    });

    // Handle real-time cart updates from QR menu customers
    socket.on('tableCartUpdated', (data: any) => {
      console.log('🛒 Table cart updated in real-time:', data);

      // Add visual highlight for the table
      if (data.tableNumber) {
        setNewOrderTables(prev => new Set(prev).add(String(data.tableNumber)));

        // Show toast for immediate feedback
        toast({
          title: `📱 Table ${data.tableNumber} - Item Added`,
          description: `Customer is ordering (${data.cart?.length || 0} items)`,
          duration: 5000,
        });

        // Clear highlight after 15 seconds
        setTimeout(() => {
          setNewOrderTables(prev => {
            const next = new Set(prev);
            next.delete(String(data.tableNumber));
            return next;
          });
        }, 15000);
      }

      // Refresh tables to show updated cart
      queryClient.invalidateQueries({
        queryKey: [`/api/tables?businessUnitId=${businessUnitId}`]
      });
    });

    socket.on('orderCompleted', () => {
      // Invalidate sales and tables queries when order is completed
      queryClient.invalidateQueries({
        queryKey: [`/api/sales?businessUnitId=${businessUnitId}`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/tables?businessUnitId=${businessUnitId}`]
      });
    });

    // Handle table status updates (e.g., when payment is completed or sync is triggered)
    socket.on('tableStatusUpdated', (data: any) => {
      console.log('🔄 [TABLE-GRID] Table status updated via socket:', data);

      // If this business unit's table was updated, refresh the table list
      if (!data.businessUnitId || data.businessUnitId === businessUnitId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/tables?businessUnitId=${businessUnitId}`]
        });
        queryClient.invalidateQueries({
          queryKey: [`/api/sales?businessUnitId=${businessUnitId}`]
        });

        // Clear the "new order" indicator if the table became available
        if (data.status === 'available' && data.tableNumber) {
          setNewOrderTables(prev => {
            const next = new Set(prev);
            next.delete(String(data.tableNumber));
            return next;
          });
        }
      }
    });

    // Handle service status updates (e.g., "Check Bill" -> billing)
    socket.on('tableServiceStatusUpdated', (data: any) => {
      console.log('📋 [TABLE-GRID] Table service status updated:', data);

      if (!data.businessUnitId || data.businessUnitId === businessUnitId) {
        // Immediately refresh table data to reflect billing/served status
        queryClient.invalidateQueries({
          queryKey: [`/api/tables?businessUnitId=${businessUnitId}`]
        });

        // Show toast for billing status (cashier needs to know)
        if (data.serviceStatus === 'billing' && data.tableNumber) {
          toast({
            title: `💰 Table ${data.tableNumber} - Ready to Pay`,
            description: 'Customer has requested the bill',
            duration: 8000,
          });
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [businessUnitId, queryClient, toast]);

  // Fetch active sales to detect QR orders by table number
  const { data: sales = [] } = useQuery<any[]>({
    queryKey: [`/api/sales?businessUnitId=${businessUnitId}`],
    enabled: !!businessUnitId,
    queryFn: async () => {
      if (!businessUnitId) return [];
      const res = await fetch(`${API_BASE_URL}/api/sales?businessUnitId=${businessUnitId}`, {
        credentials: 'include',
      });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 5000, // Keep polling as fallback
  });

  // Check if a table has active orders by matching table number as string
  // CRITICAL: Must check paymentStatus !== 'paid' to match server logic
  const hasActiveOrder = (tableNumber: string): boolean => {
    return sales.some(
      sale =>
        String(sale.tableNumber) === String(tableNumber) &&
        sale.status !== 'completed' &&
        sale.status !== 'cancelled' &&
        sale.paymentStatus !== 'paid' // Must be unpaid to be "active"
    );
  };

  const filteredTables = showSearch && typeof searchTerm === 'string'
    ? tables.filter(table => table.number.toLowerCase().includes(searchTerm.toLowerCase()))
    : tables;

  const getStatusColor = (status: TableWithOrder['status']) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'occupied':
        return 'bg-red-100 text-red-800';
      case 'reserved':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCardStatusClass = (status: TableWithOrder['status'], serviceStatus?: TableWithOrder['serviceStatus']) => {
    switch (status) {
      case 'available':
        return 'border-green-300 bg-gradient-to-br from-green-50 to-green-100/50 hover:from-green-100 hover:to-green-50 hover:shadow-lg';
      case 'occupied':
        // Premium glow effect for occupied tables with different service states
        const baseOccupied = 'border-orange-300 bg-gradient-to-br from-orange-50 to-amber-100/50 hover:shadow-lg';
        if (serviceStatus === 'ordered') {
          return `${baseOccupied} shadow-[0_0_15px_rgba(59,130,246,0.3)] ring-1 ring-blue-200/50`;
        }
        if (serviceStatus === 'served') {
          return `${baseOccupied} shadow-[0_0_15px_rgba(34,197,94,0.3)] ring-1 ring-green-200/50`;
        }
        if (serviceStatus === 'billing') {
          return `${baseOccupied} shadow-[0_0_15px_rgba(168,85,247,0.4)] ring-1 ring-purple-300/50 animate-pulse`;
        }
        return `${baseOccupied} shadow-[0_0_12px_rgba(249,115,22,0.25)]`;
      case 'reserved':
        return 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50/50 hover:from-yellow-100 hover:to-amber-50 hover:shadow-lg shadow-[0_0_10px_rgba(234,179,8,0.2)]';
      default:
        return '';
    }
  };

  const getStatusText = (status: TableWithOrder['status'], serviceStatus?: TableWithOrder['serviceStatus']) => {
    if (status !== 'available') {
      if (serviceStatus === 'billing') return 'Billing';
      if (serviceStatus === 'served') return 'Served';
      if (serviceStatus === 'ordered') return 'Ordered';
    }
    switch (status) {
      case 'available':
        return 'Available';
      case 'occupied':
        return 'Occupied';
      case 'reserved':
        return 'Reserved';
      default:
        return 'Unknown';
    }
  };

  const getWorkflowBadgeClass = (serviceStatus?: TableWithOrder['serviceStatus']) => {
    switch (serviceStatus) {
      case 'ordered':
        return 'bg-blue-100 text-blue-800';
      case 'served':
        return 'bg-green-100 text-green-800';
      case 'billing':
        return 'bg-purple-100 text-purple-800';
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      {showSearch ? (
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tables..."
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm?.(e.target.value)}
            className="pl-10"
          />
        </div>
      ) : null}

      {/* Tables Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {filteredTables.map((table) => {
          // Check if this table has an active order - prefer server-provided activeSaleId
          const hasOrder = !!table.activeSaleId || hasActiveOrder(table.number);
          // Use server-provided status (already accounts for active sales) or fallback to local detection
          const effectiveStatus = table.activeSaleId ? table.status : (hasOrder ? 'occupied' : table.status);
          const effectiveServiceStatus = table.activeSaleId ? table.serviceStatus : (hasOrder ? 'ordered' : table.serviceStatus);
          // Check if this table has a new QR order
          const hasNewQROrder = newOrderTables.has(String(table.number));

          return (
            <Card
              key={table.id}
              className={`cursor-pointer transition-all duration-300 ease-in-out hover:scale-[1.02] relative ${selectedTable?.id === table.id
                ? 'ring-2 ring-primary shadow-[0_0_0_1px_hsl(var(--primary))_inset,0_0_24px_hsl(var(--primary)/0.4)] scale-[1.02]'
                : ''
                } ${getCardStatusClass(effectiveStatus, effectiveServiceStatus)} ${hasNewQROrder ? 'ring-2 ring-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.5)]' : ''}`}
              onClick={() => {
                // Auto-navigate on mobile (< 768px width)
                const isMobile = window.innerWidth < 768;
                onTableSelect(table, isMobile);

                // Clear the "new" indicator when table is selected
                if (hasNewQROrder) {
                  setNewOrderTables(prev => {
                    const next = new Set(prev);
                    next.delete(String(table.number));
                    return next;
                  });
                }
              }}
            >
              {/* NEW ORDER Badge */}
              {hasNewQROrder && (
                <div className="absolute -top-2 -right-2 z-10">
                  <Badge className="bg-red-500 text-white animate-bounce shadow-lg">
                    <Bell className="w-3 h-3 mr-1" />
                    NEW
                  </Badge>
                </div>
              )}
              <CardContent className="p-4 text-center">
                <div className="flex flex-col items-center space-y-2">
                  <div className={`p-2 rounded-full ${effectiveStatus === 'occupied'
                    ? 'bg-orange-100 text-orange-600'
                    : effectiveStatus === 'reserved'
                      ? 'bg-yellow-100 text-yellow-600'
                      : 'bg-green-100 text-green-600'
                    }`}>
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-lg">Table {table.number}</h3>
                  <Badge className={`${getWorkflowBadgeClass(effectiveServiceStatus) || getStatusColor(effectiveStatus)} font-medium`}>
                    {getStatusText(effectiveStatus, effectiveServiceStatus)}
                  </Badge>
                  {hasOrder && (
                    <Badge className="bg-blue-100 text-blue-800 text-xs">
                      Active Order
                    </Badge>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {table.capacity} guests
                  </p>
                  {table.currentOrder && (
                    <div className="text-sm font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {formatCurrency(Number(table.currentOrder.total) || 0)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Selected Table Details - Desktop Only (Mobile auto-navigates to products) */}
      {selectedTable && (
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Table {selectedTable.number} - {getStatusText(selectedTable.status, selectedTable.serviceStatus)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Capacity:</span>
                <span className="font-medium">{selectedTable.capacity} guests</span>
              </div>

              {selectedTable.currentOrder && (
                <div className="space-y-2">
                  <h4 className="font-medium">Current Order</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTable?.currentOrder?.items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatCurrency(Number(item.unitPrice ?? item.price) || 0)}</TableCell>
                          <TableCell>{formatCurrency((Number(item.quantity) || 0) * (Number(item.unitPrice ?? item.price) || 0))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between items-center font-bold text-lg pt-2 border-t">
                    <span>Total:</span>
                    <span>{formatCurrency(Number(selectedTable?.currentOrder?.total) || 0)}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TableGrid;
