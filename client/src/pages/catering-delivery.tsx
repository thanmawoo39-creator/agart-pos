import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Phone,
    MapPin,
    Truck,
    CheckCircle,
    RefreshCw,
    Loader2,
    Navigation,
    Package,
    Power,
    Clock,
    User,
    Banknote,
    QrCode,
    X,
    Camera,
    Image as ImageIcon,
} from 'lucide-react';

interface CateringOrder {
    id: number;
    customerName: string;
    customerPhone: string;
    deliveryAddress?: string;
    deliveryDate: string;
    totalAmount: number;
    depositPaid: number;
    status: string;
    createdAt: string;
}

export default function CateringDeliveryApp() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pin, setPin] = useState('');
    const [isLoadingPin, setIsLoadingPin] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);

    const [selectedOrderAmount, setSelectedOrderAmount] = useState(0);

    // Complete Delivery Modal State
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [orderToComplete, setOrderToComplete] = useState<CateringOrder | null>(null);
    const [proofImage, setProofImage] = useState<string | null>(null);
    const [paymentSlipImage, setPaymentSlipImage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // GPS Tracking State
    const [isTracking, setIsTracking] = useState(false);
    const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
    const [lastLocationUpdate, setLastLocationUpdate] = useState<Date | null>(null);
    const geoWatchRef = useRef<number | null>(null);
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    // Check localStorage on mount
    useEffect(() => {
        const storedAuth = localStorage.getItem('catering_rider_auth');
        if (storedAuth) setIsAuthenticated(true);
    }, []);

    // Fetch catering orders (only when authenticated)
    const { data: orders = [], isLoading, refetch } = useQuery<CateringOrder[]>({
        queryKey: ['/api/catering/orders'],
        queryFn: async () => {
            console.log("📦 Fetching catering orders...");
            const res = await fetch('/api/catering/orders');
            if (!res.ok) {
                console.error("❌ Failed to fetch orders:", res.status);
                return [];
            }
            const data = await res.json();
            console.log("📦 Raw orders from API:", data.length, "total");

            // Show ALL orders that are not delivered/cancelled
            // Riders need to see confirmed, cooking, ready, and out_for_delivery orders
            const activeOrders = data
                .filter((order: any) => {
                    const isActive = order.status !== 'delivered' && order.status !== 'cancelled';
                    console.log(`  - Order ${order.id}: status=${order.status}, active=${isActive}`);
                    return isActive;
                })
                .sort((a: any, b: any) => {
                    // Sort by delivery date, soonest first
                    if (!a.deliveryDate) return 1;
                    if (!b.deliveryDate) return -1;
                    return new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
                });

            console.log("✅ Active orders for rider:", activeOrders.length);
            return activeOrders;
        },
        enabled: isAuthenticated,
        refetchInterval: 15000, // Auto refresh every 15 sec
    });

    // Update order status (with optional proof images)
    const updateStatus = useMutation({
        mutationFn: async ({ id, status, proofImageUrl, paymentSlipUrl }: {
            id: number;
            status: string;
            proofImageUrl?: string;
            paymentSlipUrl?: string;
        }) => {
            const res = await fetch(`/api/catering/orders/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, proofImageUrl, paymentSlipUrl }),
            });
            if (!res.ok) throw new Error('Failed to update');
            return res.json();
        },
        onSuccess: () => {
            refetch();
            toast({ title: '✅ Status Updated' });
        },
        onError: () => {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update status' });
        },
    });

    // Fetch settings for Payment QR
    const { data: appSettings } = useQuery({
        queryKey: ['/api/public/settings'],
        queryFn: async () => {
            const res = await fetch('/api/public/settings');
            if (!res.ok) return null;
            return res.json();
        },
        enabled: isAuthenticated,
    });

    const paymentQrUrl = appSettings?.mobilePaymentQrUrl || null;

    // PIN Submit Handler - Uses server-side verification
    const handlePinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoadingPin(true);

        try {
            const res = await fetch('/api/public/verify-rider-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin }),
            });

            if (res.ok) {
                setIsAuthenticated(true);
                localStorage.setItem('catering_rider_auth', 'true');
                toast({ title: 'Welcome!', description: 'Access granted' });
            } else {
                toast({ title: 'Access Denied', description: 'Invalid PIN', variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to verify', variant: 'destructive' });
        }
        setIsLoadingPin(false);
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        localStorage.removeItem('catering_rider_auth');
        stopTracking();
    };

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

    const startTracking = async (orderId: number) => {
        if (!navigator.geolocation) {
            toast({ title: 'GPS Not Available', variant: 'destructive' });
            return;
        }

        console.log('📍 Starting GPS for catering order:', orderId);
        setActiveOrderId(orderId);
        setIsTracking(true);

        // Keep screen on
        await requestWakeLock();

        geoWatchRef.current = navigator.geolocation.watchPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                // console.log(`📍 Catering GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
                setLastLocationUpdate(new Date());
                try {
                    await fetch(`/api/catering/orders/${orderId}/location`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lat: latitude, lng: longitude }),
                    });
                } catch (e) { console.error(e); }
            },
            (err) => console.error(err),
            { enableHighAccuracy: true }
        );
    };

    const stopTracking = () => {
        if (geoWatchRef.current) {
            navigator.geolocation.clearWatch(geoWatchRef.current);
            geoWatchRef.current = null;
        }
        if (wakeLockRef.current) {
            wakeLockRef.current.release().then(() => wakeLockRef.current = null);
        }
        setIsTracking(false);
        setActiveOrderId(null);
        setLastLocationUpdate(null);
    };

    const openMaps = (address: string) => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    };

    const callPhone = (phone: string) => {
        window.open(`tel:${phone}`, '_self');
    };

    const showPaymentQr = (amount: number) => {
        setSelectedOrderAmount(amount);
        setShowQrModal(true);
    };

    // --- LOGIN SCREEN ---
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-purple-900 to-purple-950 flex items-center justify-center p-4">
                <Card className="w-full max-w-md bg-white/10 backdrop-blur border-purple-500/30 text-white">
                    <CardContent className="pt-8 space-y-6">
                        <div className="text-center">
                            <div className="bg-purple-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <Truck className="h-10 w-10 text-white" />
                            </div>
                            <h1 className="text-2xl font-bold">ဒံပေါက် Delivery</h1>
                            <p className="text-purple-300 text-sm mt-1">Catering Rider App</p>
                        </div>

                        <form onSubmit={handlePinSubmit} className="space-y-4">
                            <input
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="w-full text-center text-4xl tracking-[1rem] py-4 rounded-xl bg-white/10 border border-purple-400/50 focus:border-purple-300 text-white placeholder-purple-400"
                                maxLength={4}
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                placeholder="••••"
                                autoFocus
                            />
                            <Button
                                type="submit"
                                className="w-full h-12 text-lg font-bold bg-purple-500 hover:bg-purple-600"
                                disabled={isLoadingPin || pin.length < 4}
                            >
                                {isLoadingPin ? <Loader2 className="animate-spin" /> : 'Enter'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // --- MAIN DASHBOARD ---
    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-purple-600 text-white px-4 py-3 sticky top-0 z-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Truck className="h-6 w-6" />
                        <span className="font-bold">ဒံပေါက် Delivery</span>
                        {isTracking && (
                            <div className="flex flex-col items-end">
                                <span className="ml-2 flex items-center gap-1 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                                    <span className="w-1.5 h-1.5 bg-white rounded-full" />
                                    Live
                                </span>
                                {lastLocationUpdate && (
                                    <span className="text-[9px] text-white/80 mr-1 mt-0.5 font-mono">
                                        📡 {format(lastLocationUpdate, 'HH:mm:ss')}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => refetch()}
                            className="text-white hover:bg-purple-700"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLogout}
                            className="text-white hover:bg-red-600"
                        >
                            <Power className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </header>

            {/* Order List */}
            <main className="p-4 space-y-4">
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No deliveries scheduled</p>
                    </div>
                ) : (
                    orders.map((order) => {
                        const deliveryTime = order.deliveryDate ? format(new Date(order.deliveryDate), 'dd/MM • HH:mm') : 'N/A';
                        const balanceDue = (order.totalAmount || 0) - (order.depositPaid || 0);
                        const isPaid = balanceDue <= 0;

                        return (
                            <Card key={order.id} className="border-l-4 border-l-purple-500 shadow-md">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                <User className="h-4 w-4" />
                                                {order.customerName}
                                            </CardTitle>
                                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                                <Clock className="h-3 w-3" />
                                                {deliveryTime}
                                            </div>
                                        </div>
                                        <Badge variant={isPaid ? 'default' : 'destructive'} className="text-xs">
                                            {isPaid ? '✓ PAID' : `฿${balanceDue.toLocaleString()}`}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {/* Phone */}
                                    <button
                                        onClick={() => callPhone(order.customerPhone)}
                                        className="flex items-center gap-2 text-blue-600 hover:underline w-full"
                                    >
                                        <Phone className="h-4 w-4" />
                                        {order.customerPhone}
                                    </button>

                                    {/* Address */}
                                    {order.deliveryAddress && (
                                        <button
                                            onClick={() => openMaps(order.deliveryAddress!)}
                                            className="flex items-start gap-2 text-green-600 hover:underline w-full text-left"
                                        >
                                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                            <span className="text-sm">{order.deliveryAddress}</span>
                                        </button>
                                    )}

                                    {/* Status */}
                                    <div className="flex items-center gap-2 text-sm">
                                        <Badge variant="outline">{order.status}</Badge>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 pt-2">
                                        {/* Start Delivery */}
                                        {(order.status === 'ready' || order.status === 'confirmed' || order.status === 'pending') && (
                                            <Button
                                                size="sm"
                                                className="flex-1 bg-orange-500 hover:bg-orange-600"
                                                onClick={() => {
                                                    startTracking(order.id);
                                                    updateStatus.mutate({ id: order.id, status: 'out_for_delivery' });
                                                }}
                                                disabled={updateStatus.isPending}
                                            >
                                                <Navigation className="h-4 w-4 mr-1" />
                                                Start Delivery
                                            </Button>
                                        )}
                                        {/* Resume Tracking if just refreshed? or already out_for_delivery but not tracking?
                                            Ideally we'd auto-resume based on status, but button is safe for now.
                                            We can show a "Resume Tracking" or just imply it starts if they start delivery.
                                            If status is 'out_for_delivery', show 'Mark Delivered' but also maybe 'Resume Tracking' if needed?
                                            For simplicity, assume sticky tracking or re-click if needed.
                                            Actually, if they refresh page, tracking stops.
                                            Let's add a "Resume Tracking" button if status is out_for_delivery AND !isTracking.
                                        */}
                                        {order.status === 'out_for_delivery' && (
                                            <div className="flex-1 flex gap-2">
                                                {!isTracking && (
                                                    <Button
                                                        size="sm" variant="secondary"
                                                        onClick={() => startTracking(order.id)}
                                                    >
                                                        <Navigation className="h-3 w-3" />
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                                    onClick={() => {
                                                        // Open Complete Delivery Modal
                                                        setOrderToComplete(order);
                                                        setProofImage(null);
                                                        setPaymentSlipImage(null);
                                                        setShowCompleteModal(true);
                                                    }}
                                                >
                                                    <CheckCircle className="h-4 w-4 mr-1" />
                                                    Mark Delivered
                                                </Button>
                                            </div>
                                        )}
                                        {order.deliveryAddress && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openMaps(order.deliveryAddress!)}
                                            >
                                                <MapPin className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {/* Payment QR Button - Show when balance is due */}
                                    {paymentQrUrl && balanceDue > 0 && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-purple-400 text-purple-600 hover:bg-purple-50"
                                            onClick={() => showPaymentQr(balanceDue)}
                                        >
                                            <QrCode className="h-4 w-4" />
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </main>

            {/* Payment QR Modal */}
            <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
                <DialogContent className="max-w-sm mx-auto">
                    <DialogHeader>
                        <DialogTitle className="text-center flex items-center justify-center gap-2">
                            <Banknote className="h-5 w-5 text-green-600" />
                            Collect Payment
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center p-4 space-y-4">
                        <div className="text-2xl font-bold text-green-600">
                            ฿{selectedOrderAmount.toLocaleString()}
                        </div>
                        {paymentQrUrl ? (
                            <div className="bg-white p-4 rounded-lg shadow-inner">
                                <img
                                    src={paymentQrUrl}
                                    alt="Payment QR Code"
                                    className="w-64 h-64 object-contain"
                                />
                            </div>
                        ) : (
                            <div className="text-gray-500 text-sm">
                                No payment QR configured
                            </div>
                        )}
                        <p className="text-sm text-gray-500 text-center">
                            Customer scans to pay via Bank Transfer
                        </p>
                        <Button
                            onClick={() => setShowQrModal(false)}
                            className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Complete Delivery Modal (Proof of Delivery) */}
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
                                <p className="font-bold">{orderToComplete.customerName}</p>
                                <p className="text-slate-500">{orderToComplete.customerPhone}</p>
                            </div>

                            {/* Proof of Delivery Photo */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
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
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4 text-green-600" />
                                    Payment Slip (KPay / Cash Receipt)
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
                                            await updateStatus.mutateAsync({
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
        </div >
    );
}
