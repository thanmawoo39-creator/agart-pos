import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBusinessMode } from '@/contexts/BusinessModeContext';
import { useCurrency } from '@/hooks/use-currency';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { notificationManager } from '@/lib/notification-manager';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Volume2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Truck,
  Package,
  Phone,
  MapPin,
  User,
  Calendar,
  Printer,
  Clock,
  DollarSign,
  ShoppingBag,
  Eye,
  Image,
  Loader2,
  RefreshCw,
  CheckCircle,
  Check,
  VolumeX,
  Zap,
  Map,
  Search,
  MessageSquare,
} from 'lucide-react';
import DeliveryMap from '@/components/admin/delivery-map';

interface DeliveryOrder {
  id: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  total: number;
  timestamp: string;
  paymentProofUrl?: string;
  paymentStatus: string;
  requestedDeliveryTime?: string;
  status: string;
}

interface DeliverySummary {
  summary: Array<{
    productName: string;
    totalQuantity: number;
  }>;
  totalOrders: number;
  totalRevenue: number;
}

// Constants for business unit isolation
// Restaurant businessUnitId = '2' - Only show restaurant orders
const RESTAURANT_BUSINESS_UNIT_ID = '2';

export default function DeliveryDashboard() {
  const { businessUnit } = useBusinessMode();
  const { formatCurrency } = useCurrency();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showSmsLogs, setShowSmsLogs] = useState(false);
  const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previousOrderCount, setPreviousOrderCount] = useState<number | null>(null);

  // STRICT BUSINESS UNIT ISOLATION: Only fetch Restaurant orders (businessUnitId='2')
  // This ensures Grocery staff don't see Restaurant orders and vice versa
  const effectiveBusinessUnitId = RESTAURANT_BUSINESS_UNIT_ID;

  // Initialize notification manager on mount
  useEffect(() => {
    notificationManager.requestNotificationPermission();
    notificationManager.requestWakeLock();

    return () => {
      notificationManager.acknowledge();
    };
  }, []);

  // Fetch delivery orders - STRICT ISOLATION: Only Restaurant orders (businessUnitId='2')
  const {
    data: orders = [],
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useQuery<DeliveryOrder[]>({
    queryKey: ['/api/delivery/orders', effectiveBusinessUnitId, selectedDate],
    queryFn: async () => {
      // STRICT: Always use Restaurant business unit for delivery dashboard
      const res = await apiRequest(
        'GET',
        `/api/delivery/orders?businessUnitId=${effectiveBusinessUnitId}&date=${selectedDate}`
      );
      return res.json();
    },
    enabled: true, // Always enabled since we have a fixed business unit
    refetchInterval: 30000,
    select: (data) => {
      // Sort by requestedDeliveryTime (ascending) then timestamp
      return data.sort((a, b) => {
        if (a.requestedDeliveryTime && b.requestedDeliveryTime) {
          return a.requestedDeliveryTime.localeCompare(b.requestedDeliveryTime);
        }
        if (a.requestedDeliveryTime) return -1;
        if (b.requestedDeliveryTime) return 1;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
    }
  });

  // Detect new orders by comparing order count (must be after orders is declared)
  useEffect(() => {
    const pendingOrders = orders.filter(o => o.status !== 'delivered' && o.status !== 'completed' && o.status !== 'cancelled');

    if (previousOrderCount !== null && pendingOrders.length > previousOrderCount) {
      // New order detected
      const newOrders = pendingOrders.slice(0, pendingOrders.length - previousOrderCount);
      newOrders.forEach((order) => {
        notificationManager.triggerAlert(
          '📦 NEW DELIVERY ORDER!',
          `New delivery order received`,
          `Order #${order.id.slice(0, 8)} - ${order.customerName || 'Customer'} - ${formatCurrency(order.total)}`
        );
      });
    }

    setPreviousOrderCount(pendingOrders.length);
  }, [orders]);

  // Listen for payment verification events via Socket.IO
  useEffect(() => {
    const socket = io();

    socket.on('paymentVerified', (data: any) => {
      console.log('[DELIVERY-DASHBOARD] Payment verified:', data);

      // Invalidate queries to fetch updated order data
      queryClient.invalidateQueries({ queryKey: ['/api/delivery/orders'] });

      // Show success toast
      toast({
        title: '✅ Payment Verified!',
        description: `Order ${data.orderNumber} has been auto-verified via SMS`,
      });
    });

    return () => {
      socket.off('paymentVerified');
      socket.disconnect();
    };
  }, [queryClient, toast]);

  // Mark Order as Delivered Mutation
  const markDeliveredMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest('POST', `/api/delivery/orders/${orderId}/status`, { status: 'delivered' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update status');
      }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/delivery/orders'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/delivery/summary'] });
      toast({ title: "Success! Order marked as Delivered." });
      // Force page reload to ensure UI updates correctly
      window.location.reload();
    },
    onError: (error: Error) => {
      console.error('Mark as Delivered failed:', error);
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  // Verify Payment Mutation (Manual verification by cashier)
  const verifyPaymentMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest('POST', `/api/delivery/orders/${orderId}/verify-payment`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to verify payment');
      }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/delivery/orders'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/delivery/summary'] });
      toast({ title: "✅ Payment Verified!", description: "Order payment marked as paid." });
    },
    onError: (error: Error) => {
      console.error('Verify Payment failed:', error);
      toast({ title: "Failed to verify payment", description: error.message, variant: "destructive" });
    },
  });

  const verifyPayment = (id: string) => {
    verifyPaymentMutation.mutate(id);
  };

  // Helper to check if order is due soon (<10 mins)
  const isDueSoon = (timeStr?: string) => {
    if (!timeStr) return false;
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    // Handle day wrap around (if time is for tomorrow, though usually same day)
    // Assuming today for simplicity as typically POS resets

    const diffMins = (target.getTime() - now.getTime()) / 60000;
    return diffMins < 10 && diffMins > -60; // Due soon or slightly overdue
  };

  const markAsDelivered = (id: string) => {
    markDeliveredMutation.mutate(id);
  };

  // Fetch delivery summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery<DeliverySummary>({
    queryKey: ['/api/delivery/summary', businessUnit, selectedDate],
    queryFn: async () => {
      if (!businessUnit) return { summary: [], totalOrders: 0, totalRevenue: 0 };
      const res = await apiRequest(
        'GET',
        `/api/delivery/summary?businessUnitId=${businessUnit}&date=${selectedDate}`
      );
      return res.json();
    },
    enabled: !!businessUnit,
    refetchInterval: 30000,
  });

  // Format time from ISO string
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Print delivery label (Lunch Box Stickers)
  const printLabel = (order: DeliveryOrder) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Generate individual stickers for every unit of every item
    const stickers: string[] = [];
    let totalItemsCount = 0;

    // First pass to count total items for "Box X of Y" logic (optional but helpful)
    order.items.forEach(item => totalItemsCount += item.quantity);

    let currentItemIndex = 0;

    order.items.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        currentItemIndex++;
        stickers.push(`
          <div class="sticker">
            <div class="header">
              <div class="order-id">ORDER #${order.id.slice(0, 8)}</div>
              <div class="counter">${currentItemIndex} / ${totalItemsCount}</div>
            </div>
            
            <div class="product-name">
              ${item.productName}
            </div>
            
            <div class="details">
              <strong>${order.customerName || 'Guest'}</strong><br/>
              ${order.customerPhone || ''}<br/>
              <span class="address">${order.deliveryAddress ? order.deliveryAddress.substring(0, 50) + (order.deliveryAddress.length > 50 ? '...' : '') : ''}</span>
            </div>

            <div class="footer">
              <div class="paid-status">
                PAID ✓
              </div>
              <div class="time">
                ${new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        `);
      }
    });

    const labelContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Stickers - #${order.id.slice(0, 8)}</title>
          <style>
            @page {
              size: 80mm auto; /* Standard thermal width */
              margin: 0;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 0;
              margin: 0;
              background: #fff;
            }
            .sticker {
              width: 76mm; /* Slight margin for 80mm paper */
              height: 48mm; /* Approximate height for 2" label, or let it flow */
              padding: 2mm;
              box-sizing: border-box;
              border: 1px dashed #ddd; /* Helper border for visualization, remove for production if needed */
              margin-bottom: 2mm;
              page-break-after: always;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              position: relative;
            }
            .sticker:last-child {
              page-break-after: auto;
            }
            .header {
              display: flex;
              justify-content: space-between;
              border-bottom: 2px solid #000;
              padding-bottom: 2px;
              margin-bottom: 5px;
            }
            .order-id {
              font-weight: bold;
              font-size: 14px;
            }
            .counter {
              font-size: 12px;
              color: #666;
            }
            .product-name {
              font-size: 24px; /* Very Large Text */
              font-weight: 900;
              line-height: 1.1;
              margin-bottom: 5px;
              word-wrap: break-word;
              text-transform: uppercase;
            }
            .details {
              font-size: 12px;
              line-height: 1.3;
              color: #333;
              border-top: 1px dotted #999;
              padding-top: 3px;
            }
            .footer {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 5px;
              border-top: 1px solid #000;
              padding-top: 2px;
            }
            .paid-status {
              font-weight: bold;
              font-size: 14px;
              border: 1px solid #000;
              padding: 1px 4px;
              border-radius: 4px;
            }
            .time {
              font-size: 12px;
            }
            @media print {
              body { background: none; }
              .sticker { border: none; } /* Remove border when printing */
            }
          </style>
        </head>
        <body>
          ${stickers.join('')}
          <script>
            window.onload = () => {
              window.print();
              // setTimeout(() => window.close(), 500); // Optional: close after print
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(labelContent);
    printWindow.document.close();
  };

  // Print delivery voucher (full receipt with address and phone)
  const printVoucher = (order: DeliveryOrder) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const voucherContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Voucher - #${order.id.slice(0, 8)}</title>
          <style>
            /* 58mm Thermal Printer Optimized - Sunmi D3 Mini */
            @page {
              size: 58mm auto;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Arial', sans-serif;
              width: 58mm;
              padding: 2mm;
              margin: 0 auto;
              background: #fff;
              font-size: 11px;
              line-height: 1.3;
            }
            /* Header - Restaurant Name */
            .header {
              text-align: center;
              padding-bottom: 3mm;
              border-bottom: 1px dashed #000;
              margin-bottom: 2mm;
            }
            .header h1 {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 1mm;
            }
            .header p {
              font-size: 10px;
              color: #333;
            }
            /* Order Info Section */
            .order-info {
              padding: 2mm 0;
              border-bottom: 1px dashed #000;
              margin-bottom: 2mm;
            }
            .order-info h2 {
              font-size: 12px;
              font-weight: bold;
              margin-bottom: 1mm;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              padding: 0.5mm 0;
            }
            .label {
              font-weight: bold;
            }
            /* Customer Section */
            .customer-section {
              padding: 2mm 0;
              border-bottom: 1px dashed #000;
              margin-bottom: 2mm;
            }
            .customer-section h3 {
              font-size: 12px;
              font-weight: bold;
              margin-bottom: 1mm;
            }
            .customer-section .info-row {
              flex-wrap: wrap;
            }
            .customer-section .value {
              max-width: 35mm;
              word-wrap: break-word;
              text-align: right;
            }
            /* Items Table - Optimized for 58mm */
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 2mm 0;
              font-size: 10px;
            }
            .items-table th {
              background: #000;
              color: #fff;
              padding: 1.5mm 1mm;
              text-align: left;
              font-size: 9px;
              font-weight: bold;
            }
            .items-table th:nth-child(1) { width: 8mm; } /* Qty */
            .items-table th:nth-child(2) { width: auto; } /* Item Name */
            .items-table th:nth-child(3) { width: 15mm; text-align: right; } /* Price */
            .items-table td {
              padding: 1.5mm 1mm;
              border-bottom: 1px solid #ddd;
              vertical-align: top;
            }
            .items-table td:nth-child(1) { text-align: center; font-weight: bold; }
            .items-table td:nth-child(2) { 
              word-wrap: break-word; 
              max-width: 28mm;
              font-size: 10px;
            }
            .items-table td:nth-child(3) { text-align: right; font-weight: bold; }
            /* Total Section */
            .total-section {
              padding: 2mm 0;
              border-top: 2px solid #000;
              margin-top: 2mm;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              padding: 1mm 0;
            }
            .total-row.grand-total {
              font-size: 16px;
              font-weight: bold;
              padding: 2mm 0;
            }
            .payment-badge {
              display: block;
              text-align: center;
              background: #000;
              color: #fff;
              padding: 2mm;
              margin-top: 2mm;
              font-weight: bold;
              font-size: 12px;
            }
            /* Footer */
            .footer {
              text-align: center;
              margin-top: 3mm;
              padding-top: 2mm;
              border-top: 1px dashed #000;
              font-size: 9px;
            }
            .footer p {
              margin: 1mm 0;
            }
            /* Print specific */
            @media print {
              body { 
                background: none; 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ChawChaw Restaurant</h1>
            <p>Delivery Voucher</p>
          </div>

          <div class="order-info">
            <h2>Order #${order.id.slice(0, 8).toUpperCase()}</h2>
            <div class="info-row">
              <span class="label">Time:</span>
              <span>${new Date(order.timestamp).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            ${order.requestedDeliveryTime ? `
            <div class="info-row">
              <span class="label">Deliver:</span>
              <span>${order.requestedDeliveryTime}</span>
            </div>
            ` : ''}
          </div>

          <div class="customer-section">
            <h3>Customer</h3>
            <div class="info-row">
              <span class="label">Name:</span>
              <span class="value">${order.customerName || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="label">Phone:</span>
              <span class="value">${order.customerPhone || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="label">Address:</span>
              <span class="value">${order.deliveryAddress || 'N/A'}</span>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Qty</th>
                <th>Item</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr>
                  <td>${item.quantity}x</td>
                  <td>${item.productName}</td>
                  <td>${formatCurrency(item.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-row grand-total">
              <span>TOTAL:</span>
              <span>${formatCurrency(order.total)}</span>
            </div>
            <div class="payment-badge">✓ PAID</div>
          </div>

          <div class="footer">
            <p>Thank you for your order!</p>
            <p>ChawChaw Restaurant</p>
          </div>

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(voucherContent);
    printWindow.document.close();
  };

  // View order details
  const viewOrder = (order: DeliveryOrder) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  if (!businessUnit) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500 dark:text-slate-400">Please select a business unit</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header with System Status Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6 text-orange-500" />
            Delivery Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Manage online delivery orders</p>
        </div>

        {/* System Status & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Live Map Button */}
          {/* Live Map Button */}
          <Dialog open={showMap} onOpenChange={setShowMap}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
                size="sm"
              >
                <Map className="h-4 w-4 mr-2 text-blue-600" />
                Live Map
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[700px] flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  Live Delivery Map
                </DialogTitle>
                <DialogDescription>
                  Real-time locations of active riders.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 min-h-0 bg-slate-50 rounded-md border text-slate-400 flex items-center justify-center">
                {/* Load map only when open to ensure correct sizing */}
                {showMap && <DeliveryMap />}
              </div>
            </DialogContent>
          </Dialog>

          {/* Date Selector */}
          <div className="flex items-center gap-2">
            <Label htmlFor="date" className="sr-only">Date</Label>
            <Calendar className="h-4 w-4 text-slate-400" />
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchOrders()}
            disabled={ordersLoading}
            title="Refresh Orders"
          >
            <RefreshCw className={`h-4 w-4 ${ordersLoading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Standby Mode Toggle */}
          {!notificationManager.isInStandbyMode() ? (
            <Button
              variant="default"
              size="sm"
              onClick={async () => {
                try {
                  await notificationManager.startStandbyMode();
                  toast({
                    title: '🎧 Standby Mode Active',
                    description: 'Audio alerts ready. Screen will stay awake.',
                  });
                } catch (error) {
                  toast({
                    title: 'Failed to start standby mode',
                    description: 'Please interact with the page first.',
                    variant: 'destructive',
                  });
                }
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Volume2 className="h-4 w-4 mr-1" />
              Start Standby
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                notificationManager.stopStandbyMode();
                notificationManager.releaseWakeLock();
                toast({
                  title: 'Standby Mode Stopped',
                });
              }}
              className="border-orange-500 text-orange-600"
            >
              <VolumeX className="h-4 w-4 mr-1" />
              Stop Standby
            </Button>
          )}

          {/* Wake Lock Status Indicator */}
          {notificationManager.wakeLockActive && (
            <Badge variant="default" className="bg-green-600">
              <Zap className="h-3 w-3 mr-1" />
              Keep Awake
            </Badge>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Total Orders Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-8 w-8 text-orange-500" />
              <span className="text-3xl font-bold">
                {summaryLoading ? '-' : summaryData?.totalOrders || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-8 w-8 text-green-500" />
              <span className="text-3xl font-bold">
                {summaryLoading ? '-' : formatCurrency(summaryData?.totalRevenue || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Items to Prepare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-8 w-8 text-blue-500" />
              <span className="text-3xl font-bold">
                {summaryLoading
                  ? '-'
                  : summaryData?.summary.reduce((sum, s) => sum + s.totalQuantity, 0) || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div >

      {/* Kitchen Prep Summary */}
      < Card >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Kitchen Prep Summary
          </CardTitle>
          <CardDescription>
            Total quantities to prepare for today's deliveries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : summaryData?.summary.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No delivery orders for this date
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {summaryData?.summary.map((item, index) => (
                <div
                  key={index}
                  className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-center"
                >
                  <p className="font-medium text-slate-700 dark:text-slate-300 truncate">
                    {item.productName}
                  </p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                    {item.totalQuantity}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card >

      {/* Orders List */}
      < Card >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Delivery Orders
          </CardTitle>
          <CardDescription>
            {orders.length} order(s) for {selectedDate}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No delivery orders for this date
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Delivery Slot</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>View</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.filter(o => o.status !== 'delivered' && o.status !== 'completed' && o.status !== 'cancelled').map((order) => {
                    const urgent = isDueSoon(order.requestedDeliveryTime);
                    return (
                      <TableRow key={order.id} className={urgent ? "border-2 border-red-500 bg-red-50 dark:bg-red-900/10" : ""}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1 text-slate-500">
                            <Clock className="h-3 w-3" />
                            {formatTime(order.timestamp)}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-bold">
                          {order.requestedDeliveryTime ? (
                            <div className="flex items-center gap-1 text-blue-600">
                              <Clock className="h-4 w-4" />
                              {order.requestedDeliveryTime}
                              {urgent && <Badge variant="destructive" className="ml-2 animate-pulse">⚠️ Due Soon</Badge>}
                            </div>
                          ) : <span className="text-slate-400">ASAP</span>}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          #{order.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-400" />
                            {order.customerName || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {order.customerPhone || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {order.items.length} item(s)
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(order.total)}
                        </TableCell>
                        <TableCell>
                          {/* Mutually exclusive: Check button OR Verified badge */}
                          {order.paymentStatus === 'paid' ? (
                            /* Already verified - show green badge */
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            /* Not yet verified - show Check button with SMS logs dialog */
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 dark:border-blue-700"
                                  onClick={() => setCheckingOrderId(order.id)}
                                >
                                  <Search className="h-3 w-3 mr-1" />
                                  Check
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <MessageSquare className="h-5 w-5 text-blue-600" />
                                    SMS Logs - Verify Payment
                                  </DialogTitle>
                                  <DialogDescription>
                                    Check if payment of <strong>{formatCurrency(order.total)}</strong> was received via bank SMS.
                                  </DialogDescription>
                                </DialogHeader>

                                {/* SMS Log List */}
                                <div className="space-y-3 mt-4">
                                  <SmsLogsList orderId={order.id} orderTotal={order.total} onVerify={() => verifyPayment(order.id)} />
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                        {/* View Details Column */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-blue-50 dark:hover:bg-blue-900"
                              onClick={() => {
                                notificationManager.acknowledge(); // Stop ringing
                                viewOrder(order);
                              }}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-purple-50 dark:hover:bg-purple-900"
                              onClick={() => printVoucher(order)}
                              title="Print Voucher"
                            >
                              <Printer className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </Button>
                          </div>
                        </TableCell>
                        {/* Mark Delivered Actions */}
                        <TableCell className="text-right">
                          {/* DEBUG: Print status to console if needed, or just check simple condition */}
                          {order.status === 'delivered' ? (
                            // CASE 1: Already Delivered -> Show Green Badge
                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <Check className="w-3 h-3 mr-1" />
                              Delivered
                            </div>
                          ) : (
                            // CASE 2: Pending/Paid -> Show Truck Button (Clickable)
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-white hover:bg-orange-50 text-orange-600 border-orange-200"
                              onClick={() => markAsDelivered(order.id)}
                            >
                              <Truck className="w-4 h-4 mr-2" />
                              Mark Delivered
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card >

      {/* Order Details Dialog */}
      < Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails} >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Details
            </DialogTitle>
            <DialogDescription>
              Order #{selectedOrder?.id.slice(0, 8)}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm text-slate-500">Customer Information</h4>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400" />
                  <span className="font-medium">{selectedOrder.customerName || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>{selectedOrder.customerPhone || 'N/A'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                  <span className="text-sm">{selectedOrder.deliveryAddress || 'N/A'}</span>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h4 className="font-semibold text-sm text-slate-500 mb-2">Order Items</h4>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded"
                    >
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-sm text-slate-500">
                          {formatCurrency(item.unitPrice)} x {item.quantity}
                        </p>
                      </div>
                      <span className="font-semibold">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t">
                  <span className="font-bold">Total</span>
                  <span className="text-xl font-bold text-orange-600">
                    {formatCurrency(selectedOrder.total)}
                  </span>
                </div>
              </div>

              {/* Payment Proof */}
              {selectedOrder.paymentProofUrl && (
                <div>
                  <h4 className="font-semibold text-sm text-slate-500 mb-2 flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Payment Proof
                  </h4>
                  <img
                    src={selectedOrder.paymentProofUrl}
                    alt="Payment proof"
                    className="max-h-60 rounded-lg border mx-auto"
                  />
                </div>
              )}

              {/* Order Time */}
              <div className="text-center text-sm text-slate-500">
                <Clock className="h-3 w-3 inline mr-1" />
                Ordered at {new Date(selectedOrder.timestamp).toLocaleString()}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowOrderDetails(false)}
                >
                  Close
                </Button>
                <Button
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  onClick={() => {
                    printLabel(selectedOrder);
                    setShowOrderDetails(false);
                  }}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Label
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    markDeliveredMutation.mutate(selectedOrder.id);
                    setShowOrderDetails(false);
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark Delivered
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog >

    </div >
  );
}

// SMS Logs List Component for the Check dialog
interface SmsLog {
  id: string;
  sender: string;
  messageContent: string;
  extractedAmount: number | null;
  status: string;
  createdAt: string;
}

function SmsLogsList({ orderId, orderTotal, onVerify }: { orderId: string; orderTotal: number; onVerify: () => void }) {
  const { data: smsLogs = [], isLoading, refetch } = useQuery<SmsLog[]>({
    queryKey: ['/api/admin/sms-logs'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/sms-logs');
      if (!res.ok) throw new Error('Failed to fetch SMS logs');
      return res.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { formatCurrency } = useCurrency();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (smsLogs.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <MessageSquare className="h-12 w-12 mx-auto mb-3 text-slate-300" />
        <p>No SMS logs found.</p>
        <p className="text-sm mt-1">Wait for bank transfer SMS to arrive.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Looking for: <strong className="text-orange-600">{formatCurrency(orderTotal)}</strong>
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {smsLogs.map((log) => (
          <div
            key={log.id}
            className={`p-3 rounded-lg border ${log.extractedAmount && Math.abs(log.extractedAmount - orderTotal) < 1
              ? 'border-green-500 bg-green-50 dark:bg-green-950'
              : 'border-slate-200 bg-slate-50 dark:bg-slate-800'
              }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                    {log.sender}
                  </span>
                  {log.extractedAmount && (
                    <Badge
                      variant={Math.abs(log.extractedAmount - orderTotal) < 1 ? 'default' : 'secondary'}
                      className={Math.abs(log.extractedAmount - orderTotal) < 1 ? 'bg-green-500' : ''}
                    >
                      {formatCurrency(log.extractedAmount)}
                      {Math.abs(log.extractedAmount - orderTotal) < 1 && ' ✓ Match!'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 break-words">
                  {log.messageContent}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Verify Payment Button */}
      <div className="pt-4 border-t">
        <Button
          className="w-full bg-green-600 hover:bg-green-700"
          onClick={onVerify}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Confirm Payment Verified
        </Button>
        <p className="text-xs text-slate-500 text-center mt-2">
          Click above after confirming payment matches SMS log.
        </p>
      </div>
    </div>
  );
}

