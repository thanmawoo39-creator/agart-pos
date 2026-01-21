import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { notificationManager } from '@/lib/notification-manager';
import { formatCurrency, type CurrencySettings } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Phone,
  MapPin,
  User,
  Truck,
  CheckCircle,
  RefreshCw,
  Loader2,
  Navigation,
  Package,
  Volume2,
  VolumeX,
  Power,
  DollarSign,
  BellRing,
  QrCode,
  Camera,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeliveryOrder {
  id: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  orderType?: string;
  items: Array<{
    productName: string;
    quantity: number;
  }>;
  total: number;
  timestamp: string;
  status: string;
  paymentStatus: string;
  requestedDeliveryTime?: string;
  deliveryFee?: number;
}

export default function DeliveryApp() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [isLoadingPin, setIsLoadingPin] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Rider State
  const [isOnline, setIsOnline] = useState(false);
  const [incomingOrder, setIncomingOrder] = useState<DeliveryOrder | null>(null);
  const [selectedQrOrder, setSelectedQrOrder] = useState<any | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alertIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);

  // GPS Tracking State
  const [isTracking, setIsTracking] = useState(false);
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
  const [lastLocationUpdate, setLastLocationUpdate] = useState<Date | null>(null);
  const geoWatchRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Complete Delivery Modal State
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [orderToComplete, setOrderToComplete] = useState<DeliveryOrder | null>(null);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [paymentSlipImage, setPaymentSlipImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch rider PIN from PUBLIC settings (no auth required)
  const { data: riderSettings, isLoading: isLoadingSettings, error: settingsError } = useQuery({
    queryKey: ['/api/settings/public'],
    queryFn: async () => {
      console.log("🚚 DeliveryApp: Fetching public settings for riderPin...");
      const res = await fetch('/api/settings/public');
      if (!res.ok) {
        console.warn("⚠️ DeliveryApp: Settings fetch failed, using defaults");
        return null;
      }
      const data = await res.json();
      console.log("✅ DeliveryApp: Settings loaded, riderPin:", data?.riderPin ? "SET" : "DEFAULT");
      return data;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 mins
    retry: 1,
  });

  // Debug log on error
  if (settingsError) {
    console.error("❌ DeliveryApp: Settings error:", settingsError);
  }

  // Check storage on mount
  useEffect(() => {
    const storedAuth = localStorage.getItem('rider_auth_token');
    const storedOnline = localStorage.getItem('rider_is_online');
    if (storedAuth) setIsAuthenticated(true);
    if (storedOnline === 'true') setIsOnline(true);

    // Initialize audio element (Loud Ringtone)
    audioRef.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
    audioRef.current.loop = true;
  }, []);

  // Check for new orders
  const { data: orders = [], isLoading, refetch } = useQuery<DeliveryOrder[]>({
    queryKey: ['/api/public/delivery-orders'],
    queryFn: async () => {
      const res = await fetch('/api/public/delivery-orders');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && isOnline,
    refetchInterval: isOnline ? 5000 : false, // Poll faster when online
  });

  // Track previous order count to detect new orders
  const previousOrderCountRef = useRef<number>(0);

  // Wake Up System Logic - Detect NEW orders and trigger alarm
  useEffect(() => {
    if (!isAuthenticated || !isOnline) return;

    // Count orders that need action (pending + out_for_delivery excluding already delivered)
    const activeOrders = orders.filter(o =>
      o.status !== 'delivered' && o.status !== 'completed' && o.status !== 'cancelled'
    );

    const currentCount = activeOrders.length;
    const previousCount = previousOrderCountRef.current;

    // Detect NEW orders - if count increased, we have new orders!
    if (previousCount > 0 && currentCount > previousCount) {
      const newOrdersCount = currentCount - previousCount;
      console.log(`🔔 NEW ORDER DETECTED! (${newOrdersCount} new orders)`);

      // Trigger the alarm!
      startAlert();

      // Also use notification manager for browser notification + speech
      notificationManager.triggerAlert(
        '🚚 NEW DELIVERY ORDER!',
        `New order received - ${activeOrders[0]?.customerName || 'Customer'}`,
        `Total: ฿${activeOrders[0]?.total || 0}`
      );

      // Show toast
      toast({
        title: '🔔 NEW ORDER RECEIVED!',
        description: `Order from ${activeOrders[0]?.customerName || 'Customer'}`,
      });
    }

    // Update ref for next comparison
    previousOrderCountRef.current = currentCount;
  }, [orders, isOnline, isAuthenticated]);

  // Tab State - REMOVED: Now always shows scheduled jobs

  const toggleOnline = () => {
    const newState = !isOnline;
    setIsOnline(newState);
    localStorage.setItem('rider_is_online', String(newState));

    if (newState) {
      toast({ title: '🟢 You are ONLINE', description: 'Waiting for orders...' });
      notificationManager.startStandbyMode();
    } else {
      toast({ title: '🔴 You are OFFLINE', description: 'Standby mode disabled.' });
      notificationManager.stopStandbyMode();
      stopAlert();
    }
  };



  const updateDeliveryStatus = useMutation({
    mutationFn: async ({ id, status, proofImageUrl, paymentSlipUrl }: {
      id: string;
      status: string;
      proofImageUrl?: string;
      paymentSlipUrl?: string;
    }) => {
      const res = await fetch(`/api/public/delivery-orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, proofImageUrl, paymentSlipUrl })
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/public/delivery-orders'] });
      toast({ title: 'Status Updated' });
    }
  });



  const startAlert = () => {
    setIsAlarmRinging(true);
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.error("Audio play failed", e));
    }
    if ('vibrate' in navigator) {
      navigator.vibrate([500, 200, 500, 200, 500]); // Aggressive vibration
      alertIntervalRef.current = setInterval(() => {
        navigator.vibrate([500, 200, 500, 200, 500]);
      }, 2000);
    }
  };

  const stopAlert = () => {
    setIsAlarmRinging(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (alertIntervalRef.current) {
      clearInterval(alertIntervalRef.current);
      alertIntervalRef.current = null;
    }
    navigator.vibrate(0);
    notificationManager.acknowledge();
  };

  // Mock Incoming Order Trigger
  const simulateIncomingOrder = () => {
    const mockOrder: DeliveryOrder = {
      id: `ORD-${Math.floor(Math.random() * 1000)}`,
      customerName: "Alice Wonderland",
      customerPhone: "081-234-5678",
      deliveryAddress: "123 Rabbit Hole, Wonderland District",
      total: 450,
      deliveryFee: 45,
      timestamp: new Date().toISOString(),
      status: 'pending',
      paymentStatus: 'paid',
      items: [
        { productName: "Magic Potion", quantity: 2 },
        { productName: "Eat Me Cake", quantity: 1 }
      ]
    };
    setIncomingOrder(mockOrder);
    startAlert();
  };

  const acceptOrder = () => {
    stopAlert();
    toast({ title: "Order Accepted!", description: "Navigate to pickup location." });
    // In real app: mutations.acceptOrder(incomingOrder.id)
    setIncomingOrder(null);
  };

  const declineOrder = () => {
    stopAlert();
    setIncomingOrder(null);
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingPin(true);

    try {
      // SERVER-SIDE PIN verification - ensures we always use the DB value
      console.log("🔐 Verifying PIN via server...");
      const res = await fetch('/api/public/verify-rider-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      if (res.ok) {
        console.log("✅ PIN verified successfully");
        setIsAuthenticated(true);
        localStorage.setItem('rider_auth_token', 'true');
        toast({ title: 'Welcome', description: 'Access granted' });
      } else {
        console.log("❌ PIN rejected by server");
        toast({ title: 'Access Denied', description: 'Invalid PIN', variant: 'destructive' });
      }
    } catch (error) {
      console.error("⚠️ PIN verification error:", error);
      toast({ title: 'Error', description: 'Failed to verify PIN', variant: 'destructive' });
    }

    setIsLoadingPin(false);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsOnline(false);
    localStorage.removeItem('rider_auth_token');
    localStorage.removeItem('rider_is_online');
    stopAlert();
    stopTracking(); // Stop GPS when logging out
  };

  // GPS Tracking Functions
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('✅ Wake Lock active');
      }
    } catch (err) {
      console.error('Wake Lock error:', err);
    }
  };

  const startTracking = async (orderId: string) => {
    if (!navigator.geolocation) {
      toast({ title: 'GPS Not Available', variant: 'destructive' });
      return;
    }

    console.log('📍 Starting GPS tracking for order:', orderId);
    setActiveDeliveryId(orderId);
    setIsTracking(true);

    // Request Wake Lock to keep screen on
    await requestWakeLock();

    geoWatchRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // console.log(`📍 GPS Update: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`); // Reduce noise
        setLastLocationUpdate(new Date());

        try {
          await fetch(`/api/public/delivery-orders/${orderId}/location`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          });
        } catch (err) {
          console.error('Failed to send GPS update:', err);
        }
      },
      (error) => {
        console.error('GPS Error:', error);
        toast({ title: 'GPS Error', description: error.message, variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  };

  const stopTracking = () => {
    if (geoWatchRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
      console.log('📍 GPS tracking stopped');
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        wakeLockRef.current = null;
        console.log('🛑 Wake Lock released');
      });
    }
    setIsTracking(false);
    setActiveDeliveryId(null);
    setLastLocationUpdate(null);
  };

  // Fetch currency settings
  const { data: settings } = useQuery({
    queryKey: ['/api/settings/public'],
    queryFn: async () => {
      const res = await fetch('/api/settings/public');
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Fetch app settings for payment QR
  const { data: appSettings } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) return null;
      return res.json();
    },
  });

  // LOADING STATE: Show spinner while settings load (prevents white screen)
  // This MUST come after all hooks are declared!
  if (isLoadingSettings) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <Loader2 className="h-12 w-12 text-orange-500 animate-spin mb-4" />
        <p className="text-slate-400">Loading Rider App...</p>
      </div>
    );
  }

  // --- Login Screen ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700 text-white">
          <CardContent className="pt-10 space-y-8">
            <div className="text-center">
              <div className="bg-orange-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/20">
                <Truck className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold">Rider Login</h1>
              <p className="text-slate-400 mt-2">Enter PIN to start your shift</p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-6">
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-full text-center text-5xl tracking-[1rem] py-6 rounded-xl bg-slate-900 border border-slate-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-white placeholder-slate-600 transition-all font-mono"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                autoFocus
              />
              <Button
                type="submit"
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg"
                disabled={isLoadingPin || pin.length < 4}
              >
                {isLoadingPin ? <Loader2 className="animate-spin" /> : 'Start Shift'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Main Dashboard ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      {/* 1. Header & Status Toggle */}
      <header className={`sticky top-0 z-40 transition-colors duration-300 ${isOnline ? 'bg-white dark:bg-slate-900 border-b border-green-200' : 'bg-slate-100 dark:bg-slate-900 border-b border-slate-200'} px-4 py-4 shadow-sm`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <User className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 dark:text-slate-200">Rider #88</h2>
              <p className="text-xs text-slate-500">Honda Wave 125i</p>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-red-500">
            <Power className="h-4 w-4" />
          </Button>
        </div>

        {/* Big Online Toggle */}
        <div
          onClick={toggleOnline}
          className={`w-full p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 flex items-center justify-between shadow-sm ${isOnline
            ? 'bg-green-50 border-green-500 dark:bg-green-900/20'
            : 'bg-slate-50 border-slate-300 dark:bg-slate-800 dark:border-slate-700'
            }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
            <div>
              <h3 className={`font-bold text-lg ${isOnline ? 'text-green-700 dark:text-green-400' : 'text-slate-500'}`}>
                {isOnline ? 'YOU ARE ONLINE' : 'YOU ARE OFFLINE'}
              </h3>
              <p className="text-sm text-slate-500">
                {isOnline ? 'Finding orders near you...' : 'Go online to receive orders'}
              </p>
            </div>
          </div>
          <Switch checked={isOnline} onCheckedChange={toggleOnline} className="scale-125 data-[state=checked]:bg-green-500" />
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Restaurant Deliveries Header */}
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300">🍽️ Restaurant Orders</h3>
          <div className="flex items-center gap-2">
            {/* Stop Alarm Button - Only visible when ringing */}
            {isAlarmRinging && (
              <Button
                variant="destructive"
                size="sm"
                onClick={stopAlert}
                className="animate-pulse bg-red-600 hover:bg-red-700"
              >
                <VolumeX className="h-4 w-4 mr-1" />
                Stop Alarm
              </Button>
            )}
            {isTracking && (
              <div className="flex flex-col items-end">
                <span className="flex items-center gap-1 text-xs text-white bg-red-600 px-3 py-1 rounded-full animate-pulse shadow-sm">
                  <span className="w-2 h-2 bg-white rounded-full" />
                  Live Tracking
                </span>
                {lastLocationUpdate && (
                  <span className="text-[10px] text-slate-500 mt-1">
                    📡 Sent: {format(lastLocationUpdate, 'HH:mm:ss')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Order List */}
        {!isOnline ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <Truck className="h-20 w-20 text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg">You are offline</p>
            <p className="text-slate-400 text-sm mt-2">Go online to receive orders</p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-500 mb-4" />
            <p className="text-slate-500">Loading delivery orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <Package className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No active deliveries</p>
            <p className="text-slate-400 text-sm mt-1">New orders will appear here automatically</p>
          </div>
        ) : (
          orders.map((order: any) => {
            const isStarted = order.status === 'out_for_delivery';
            const isCompleted = order.status === 'delivered';
            const isBeingTracked = activeDeliveryId === order.id;

            // Address Map Link
            const encodedAddress = encodeURIComponent(order.deliveryAddress || '');

            return (
              <div
                key={order.id}
                className={`bg-white rounded-xl shadow-md overflow-hidden border-l-4 ${isStarted
                  ? 'border-l-green-500 ring-2 ring-green-500/20'
                  : 'border-l-orange-500'
                  } ${isCompleted ? 'opacity-60 grayscale' : ''}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Order #{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-400">
                      {order.timestamp ? format(new Date(order.timestamp), 'hh:mm a') : 'Now'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <p className="text-xl font-bold text-gray-900">฿{order.total.toLocaleString()}</p>
                    <Badge variant={order.paymentStatus === 'paid' ? "default" : "destructive"}>
                      {order.paymentStatus === 'paid' ? 'PAID' : 'COLLECT CASH'}
                    </Badge>
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 space-y-4">
                  {/* Customer */}
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-gray-400 mt-1" />
                    <div>
                      <p className="font-bold text-gray-900">{order.customerName || 'Guest'}</p>
                      <a href={`tel:${order.customerPhone}`} className="text-blue-600 hover:underline flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {order.customerPhone}
                      </a>
                    </div>
                  </div>

                  {/* Address */}
                  {order.deliveryAddress && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-gray-400 mt-1" />
                      <div>
                        <p className="text-gray-700 text-sm leading-relaxed">{order.deliveryAddress}</p>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-orange-600 text-xs font-bold mt-1 inline-flex items-center hover:underline"
                        >
                          OPEN MAP <Navigation className="h-3 w-3 ml-1" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Items Summary */}
                  <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-600">
                    <p className="font-bold mb-1">{order.items.length} Items:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      {order.items.map((item: any, idx: number) => (
                        <li key={idx}><span className="font-bold">{item.quantity}x</span> {item.productName}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 pt-0">
                  {!isCompleted ? (
                    <div className="space-y-3">
                      {!isStarted ? (
                        <Button
                          className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold"
                          onClick={() => {
                            startTracking(order.id);
                            updateDeliveryStatus.mutate({ id: order.id, status: 'out_for_delivery' });
                          }}
                          disabled={updateDeliveryStatus.isPending}
                        >
                          <Truck className="h-5 w-5 mr-2" />
                          Start Delivery
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          {isTracking && isBeingTracked ? (
                            <div className="flex justify-center py-2">
                              <span className="flex items-center text-green-600 animate-pulse font-bold text-sm">
                                <span className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                                Sharing Live Location
                              </span>
                            </div>
                          ) : (
                            <Button
                              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold mb-2"
                              onClick={() => startTracking(order.id)}
                            >
                              <Navigation className="h-4 w-4 mr-2" />
                              Resume Tracking
                            </Button>
                          )}
                          <Button
                            className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold"
                            onClick={() => {
                              // Open Complete Delivery Modal
                              setOrderToComplete(order);
                              setProofImage(null);
                              setPaymentSlipImage(null);
                              setShowCompleteModal(true);
                            }}
                          >
                            <CheckCircle className="h-5 w-5 mr-2" />
                            Mark Delivered
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-2 bg-gray-100 rounded text-gray-500 font-bold text-sm">
                      COMPLETED
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* 💳 PAYMENT QR CODE MODAL */}
      <Dialog open={!!selectedQrOrder} onOpenChange={(open) => !open && setSelectedQrOrder(null)}>
        <DialogContent className="w-[90vw] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold">
              <div>Scan to Pay</div>
              <div className="text-sm text-gray-500 font-normal mt-1">ငွေချေရန် စကင်ဖတ်ပါ</div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center space-y-6 py-4">
            {/* QR Code */}
            {appSettings?.mobilePaymentQrUrl ? (
              <div className="bg-white p-4 rounded-xl border-2 border-gray-200 shadow-lg">
                <img
                  src={appSettings.mobilePaymentQrUrl}
                  alt="Payment QR Code"
                  className="w-64 h-64 object-contain"
                />
              </div>
            ) : (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 text-center">
                <div className="text-6xl mb-3">⚠️</div>
                <p className="font-bold text-gray-900 mb-2">No Payment QR Configured</p>
                <p className="text-sm text-gray-600 mb-3">
                  Please upload the shop's payment QR code in Settings
                </p>
                <p className="text-xs text-gray-500">
                  📱 Settings → Mobile Payment QR
                </p>
              </div>
            )}

            {/* Balance Due Amount */}
            {selectedQrOrder && (
              <div className="w-full bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
                <p className="text-sm text-gray-600 mb-2">Amount to Collect / ကောက်ခံရမည့်ပမာဏ</p>
                <p className="text-4xl font-black text-red-600">
                  ฿{(selectedQrOrder.totalAmount - (selectedQrOrder.depositPaid || 0)).toLocaleString()}
                </p>
              </div>
            )}

            {/* Close Button */}
            <Button
              onClick={() => setSelectedQrOrder(null)}
              className="w-full h-14 text-lg font-bold bg-gray-900 hover:bg-gray-800"
            >
              Done / ပြီးပါပြီ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🚨 INCOMING ORDER MODAL (Wake Up Alert) 🚨 */}
      <AnimatePresence>
        {incomingOrder && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="fixed inset-0 z-[60] bg-slate-900 flex flex-col"
          >
            {/* Flashing Background Overlay */}
            <div className="absolute inset-0 bg-orange-500/10 animate-pulse z-0 pointer-events-none" />

            <div className="relative z-10 flex-1 flex flex-col p-6 text-white pb-safe">
              {/* Header */}
              <div className="text-center mt-8 mb-6">
                <div className="inline-block p-4 rounded-full bg-orange-500 animate-bounce mb-4 shadow-[0_0_30px_rgba(249,115,22,0.6)]">
                  <BellRing className="h-10 w-10 text-white" />
                </div>
                <h1 className="text-3xl font-black uppercase tracking-wider">New Order!</h1>
                <p className="text-orange-300 font-mono mt-1 text-xl">EARNINGS: ฿{incomingOrder.deliveryFee || 45}</p>
              </div>

              {/* Order Details Card */}
              <div className="bg-slate-800 rounded-2xl p-6 flex-1 shadow-2xl border border-slate-700 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="bg-slate-700 p-3 rounded-lg">
                    <Store className="h-6 w-6 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wide">Pickup From</p>
                    <h3 className="text-xl font-bold">ChawChaw Restaurant</h3>
                    <p className="text-sm text-slate-400 mt-1">1.2 km away</p>
                  </div>
                </div>

                <div className="h-px bg-slate-700" />

                <div className="flex items-start gap-4">
                  <div className="bg-slate-700 p-3 rounded-lg">
                    <MapPin className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wide">Deliver To</p>
                    <h3 className="text-xl font-bold">{incomingOrder.deliveryAddress}</h3>
                    <p className="text-sm text-slate-400 mt-1">{incomingOrder.customerName}</p>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-xl mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400">Items ({incomingOrder.items.length})</span>
                    <span className="font-bold">Total: ฿{incomingOrder.total}</span>
                  </div>
                  <div className="space-y-1">
                    {incomingOrder.items.map((item, i) => (
                      <p key={i} className="text-sm text-slate-300">• {item.quantity}x {item.productName}</p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-16 text-lg border-slate-600 bg-slate-800 hover:bg-slate-700 text-white"
                  onClick={declineOrder}
                >
                  Decline
                </Button>
                <Button
                  className="h-16 text-xl font-bold bg-green-500 hover:bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] animate-pulse"
                  onClick={acceptOrder}
                >
                  ACCEPT ORDER
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Complete Delivery Modal */}
      <Dialog open={showCompleteModal} onOpenChange={(open) => {
        if (!open) {
          setShowCompleteModal(false);
          setOrderToComplete(null);
        }
      }}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Complete Delivery
            </DialogTitle>
          </DialogHeader>

          {orderToComplete && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 p-3 rounded-lg text-sm">
                <p className="font-bold text-gray-900">{orderToComplete.customerName || 'Guest'}</p>
                <p className="text-slate-500">{orderToComplete.customerPhone}</p>
                <p className="font-bold text-lg text-green-600 mt-2">Total: ฿{orderToComplete.total?.toLocaleString()}</p>
                {orderToComplete.paymentStatus !== 'paid' && (
                  <Badge variant="destructive" className="mt-2">COLLECT CASH</Badge>
                )}
              </div>

              {/* Proof of Delivery Photo */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-gray-700">
                  <Camera className="h-4 w-4 text-blue-600" />
                  Food Photo (Proof of Delivery)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setProofImage(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {proofImage && (
                  <img src={proofImage} alt="Proof" className="w-full h-32 object-cover rounded-lg border" />
                )}
              </div>

              {/* Payment Slip Photo */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-gray-700">
                  <ImageIcon className="h-4 w-4 text-green-600" />
                  Payment Slip (KPay / Bank Transfer)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setPaymentSlipImage(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {paymentSlipImage && (
                  <img src={paymentSlipImage} alt="Slip" className="w-full h-32 object-cover rounded-lg border" />
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCompleteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={isSubmitting}
                  onClick={async () => {
                    setIsSubmitting(true);
                    try {
                      stopTracking();
                      await updateDeliveryStatus.mutateAsync({
                        id: orderToComplete.id,
                        status: 'delivered',
                        proofImageUrl: proofImage || undefined,
                        paymentSlipUrl: paymentSlipImage || undefined,
                      });
                      setShowCompleteModal(false);
                      setOrderToComplete(null);
                      toast({ title: '✅ Delivery Complete!' });
                    } catch (err) {
                      toast({ title: 'Error', description: 'Failed to complete delivery', variant: 'destructive' });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  Confirm & Finish
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Store({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
      <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" />
    </svg>
  )
}
