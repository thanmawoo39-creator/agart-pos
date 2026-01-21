import { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io as socketIO } from "socket.io-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useBusinessMode } from "@/contexts/BusinessModeContext";
import { API_BASE_URL } from "@/lib/api-config";
import { notificationManager } from "@/lib/notification-manager";
import type { CartItem, KitchenTicket } from "@shared/schema";
import { ChefHat, Clock, CheckCircle, History, Undo2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type TicketItemsPayload = {
    newItems: CartItem[];
    alreadyOrdered: CartItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isCartItem(value: unknown): value is CartItem {
    if (!isRecord(value)) return false;
    return (
        typeof value.id === "string" &&
        typeof value.productId === "string" &&
        typeof value.productName === "string" &&
        typeof value.quantity === "number" &&
        typeof value.unitPrice === "number" &&
        typeof value.total === "number"
    );
}

function parseTicketItems(items: string | null | undefined): TicketItemsPayload {
    if (!items) return { newItems: [], alreadyOrdered: [] };
    try {
        const parsed: unknown = JSON.parse(items);
        if (Array.isArray(parsed)) {
            return { newItems: parsed.filter(isCartItem), alreadyOrdered: [] };
        }
        if (isRecord(parsed)) {
            const niRaw = Array.isArray(parsed.newItems) ? parsed.newItems : [];
            const aoRaw = Array.isArray(parsed.alreadyOrdered) ? parsed.alreadyOrdered : [];
            return { newItems: niRaw.filter(isCartItem), alreadyOrdered: aoRaw.filter(isCartItem) };
        }
        return { newItems: [], alreadyOrdered: [] };
    } catch {
        return { newItems: [], alreadyOrdered: [] };
    }
}

// Timer component for cooking orders
function ElapsedTimer({ startTime }: { startTime: string }) {
    const [elapsed, setElapsed] = useState("");

    useEffect(() => {
        const updateElapsed = () => {
            const start = new Date(startTime).getTime();
            const now = Date.now();
            const diff = now - start;
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setElapsed(`${minutes}:${seconds.toString().padStart(2, "0")}`);
        };

        updateElapsed();
        const interval = setInterval(updateElapsed, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    return <span className="font-mono">{elapsed}</span>;
}

// Order Card Component
function OrderCard({
    ticket,
    stage,
    onAcceptCook,
    onMarkReady,
    onMarkServed,
}: {
    ticket: KitchenTicket;
    stage: "incoming" | "cooking" | "ready";
    onAcceptCook?: (id: string) => void;
    onMarkReady?: (id: string) => void;
    onMarkServed?: (id: string) => void;
}) {
    const parsed = parseTicketItems(ticket.items);
    const items = parsed.newItems;

    const borderColor = {
        incoming: "border-l-blue-500",
        cooking: "border-l-orange-500",
        ready: "border-l-green-500",
    }[stage];

    const bgColor = {
        incoming: "",
        cooking: "",
        ready: "bg-green-50/50 dark:bg-green-950/20",
    }[stage];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
        >
            <Card
                className={cn(
                    "border-l-4 select-none",
                    borderColor,
                    bgColor,
                    stage === "incoming" && "animate-pulse-border",
                    stage === "ready" && "shadow-lg shadow-green-500/20"
                )}
            >
                <CardContent className="p-3 sm:p-4 space-y-3">
                    {/* Table Number - HUGE (responsive) */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-3xl sm:text-4xl font-black text-foreground leading-none truncate flex-1" title={ticket.tableNumber || "?"}>
                            {ticket.tableNumber || "?"}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            {ticket.id.startsWith('sale-') && (
                                <Badge className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs whitespace-nowrap">
                                    ONLINE
                                </Badge>
                            )}
                            {stage === "incoming" && (
                                <Badge className="bg-blue-500 text-white text-xs animate-pulse">NEW</Badge>
                            )}
                        </div>
                        {stage === "cooking" && ticket.startedAt && (
                            <div className="flex items-center gap-1 text-orange-500 font-semibold">
                                <Clock className="w-5 h-5" />
                                <ElapsedTimer startTime={ticket.startedAt} />
                            </div>
                        )}
                        {stage === "ready" && (
                            <Badge className="bg-green-500 text-white text-sm">READY!</Badge>
                        )}
                    </div>

                    {/* Items List */}
                    <div className="space-y-1">
                        {items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <span className="text-xl sm:text-2xl font-bold text-foreground/70">
                                    {item.quantity}x
                                </span>
                                <span className="text-base sm:text-lg font-semibold truncate">
                                    {item.productName || item.name}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Action Button - Full width on mobile */}
                    <div className="pt-2">
                        {stage === "incoming" && onAcceptCook && (
                            <Button
                                onClick={() => onAcceptCook(ticket.id)}
                                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold text-base sm:text-lg h-12 sm:h-12"
                            >
                                <ChefHat className="w-5 h-5 mr-2" />
                                Accept & Cook
                            </Button>
                        )}
                        {stage === "cooking" && onMarkReady && (
                            <Button
                                onClick={() => onMarkReady(ticket.id)}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-base sm:text-lg h-12 sm:h-12"
                            >
                                <CheckCircle className="w-5 h-5 mr-2" />
                                Mark Ready
                            </Button>
                        )}
                        {stage === "ready" && onMarkServed && (
                            <Button
                                onClick={() => onMarkServed(ticket.id)}
                                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold text-base sm:text-lg h-12 sm:h-12 animate-pulse"
                            >
                                <CheckCircle className="w-5 h-5 mr-2" />
                                Mark Served
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

// Kanban Column Component
function KanbanColumn({
    title,
    count,
    color,
    children,
}: {
    title: string;
    count: number;
    color: string;
    children: React.ReactNode;
}) {
    const colorClasses = {
        blue: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
        orange: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800",
        green: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
    };

    return (
        <div className="flex flex-col h-full">
            <div className={cn("p-3 sm:p-4 border-b-4 rounded-t-lg", colorClasses[color as keyof typeof colorClasses])}>
                <h2 className="text-lg sm:text-xl font-bold flex items-center justify-between">
                    <span>{title}</span>
                    <Badge variant="secondary" className="text-base sm:text-lg px-2 sm:px-3 py-1">
                        {count}
                    </Badge>
                </h2>
            </div>
            <div className="flex-1 p-2 sm:p-4 space-y-3 sm:space-y-4 overflow-y-auto bg-muted/30">
                <AnimatePresence mode="popLayout">{children}</AnimatePresence>
            </div>
        </div>
    );
}

// History Sidebar (Desktop) / Slide-over Drawer (Mobile)
function HistorySidebar({
    show,
    orders,
    onClose,
    onUndo,
}: {
    show: boolean;
    orders: KitchenTicket[];
    onClose: () => void;
    onUndo: (id: string) => void;
}) {
    if (!show) return null;

    return (
        <>
            {/* Backdrop for mobile */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            />

            {/* Drawer/Sidebar */}
            <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className={cn(
                    "fixed right-0 top-0 bottom-0 bg-background border-l shadow-2xl flex flex-col",
                    "w-full sm:w-96 lg:w-80", // Full width on mobile, fixed width on larger screens
                    "z-50"
                )}
            >
                <div className="p-4 border-b flex items-center justify-between bg-muted">
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5" />
                        <h3 className="font-bold text-lg">Order History</h3>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {orders.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No served orders yet</p>
                    ) : (
                        orders.map((order) => {
                            const parsed = parseTicketItems(order.items);
                            return (
                                <Card key={order.id} className="bg-card">
                                    <CardContent className="p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-2xl font-bold">Table {order.tableNumber}</span>
                                            <Badge variant="outline" className="text-xs">
                                                {order.servedAt ? new Date(order.servedAt).toLocaleTimeString() : ""}
                                            </Badge>
                                        </div>
                                        <div className="text-sm space-y-1">
                                            {parsed.newItems.map((item, idx) => (
                                                <div key={idx} className="text-muted-foreground">
                                                    {item.quantity}x {item.productName}
                                                </div>
                                            ))}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onUndo(order.id)}
                                            className="w-full"
                                        >
                                            <Undo2 className="w-4 h-4 mr-2" />
                                            Undo (Move to Ready)
                                        </Button>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>
            </motion.div>
        </>
    );
}

export default function Kitchen() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { businessUnit } = useBusinessMode();
    // 🚨 STABILIZATION: Default to '2' (Restaurant) if context is missing
    const businessUnitId = businessUnit || '2';
    const [showHistory, setShowHistory] = useState(false);
    const [orderHistory, setOrderHistory] = useState<KitchenTicket[]>([]);
    const [mobileTab, setMobileTab] = useState<"incoming" | "cooking" | "ready">("incoming");

    // Sound effect for new orders - Using Web Audio API for reliable beep without external file
    const audioContextRef = useRef<AudioContext | null>(null);
    const oscillatorRef = useRef<OscillatorNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
    const [lastIncomingCount, setLastIncomingCount] = useState(0);
    const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize Web Audio API context (must be triggered by user interaction first time)
    const initAudioContext = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    };

    // Play a beep sound
    const playBeep = (frequency = 800, duration = 200, volume = 0.5) => {
        if (!audioContextRef.current) return;

        const ctx = audioContextRef.current;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'square';
        gainNode.gain.value = volume;

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration / 1000);
    };

    // Start looping alarm pattern
    const startAlarm = () => {
        if (isAlarmPlaying) return;

        initAudioContext();
        setIsAlarmPlaying(true);

        // Play initial beeps
        playBeep(800, 150, 0.6);
        setTimeout(() => playBeep(1000, 150, 0.6), 200);
        setTimeout(() => playBeep(1200, 150, 0.6), 400);

        // Set up looping alarm pattern
        alarmIntervalRef.current = setInterval(() => {
            playBeep(800, 150, 0.6);
            setTimeout(() => playBeep(1000, 150, 0.6), 200);
            setTimeout(() => playBeep(1200, 150, 0.6), 400);
        }, 2000);
    };

    // Stop alarm
    const stopAlarm = () => {
        if (alarmIntervalRef.current) {
            clearInterval(alarmIntervalRef.current);
            alarmIntervalRef.current = null;
        }
        setIsAlarmPlaying(false);
    };

    // Initialize notification manager & Wake Lock
    useEffect(() => {
        notificationManager.requestNotificationPermission();
        notificationManager.requestWakeLock();

        // Initialize audio on first user interaction
        const handleInteraction = () => {
            initAudioContext();
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('touchstart', handleInteraction);
        };
        document.addEventListener('click', handleInteraction);
        document.addEventListener('touchstart', handleInteraction);

        return () => {
            notificationManager.acknowledge();
            stopAlarm();
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('touchstart', handleInteraction);
        };
    }, []);

    // Socket.IO for real-time updates
    useEffect(() => {
        const socket = socketIO(API_BASE_URL, { transports: ["websocket", "polling"] });

        socket.on("connect", () => console.log("🔌 Kitchen View connected"));

        socket.on("newOrder", (data: any) => {
            queryClient.invalidateQueries({ queryKey: [`/api/kitchen-tickets?businessUnitId=${businessUnitId}`] });
            notificationManager.triggerAlert(
                "🔔 NEW ORDER!",
                `Table ${data.tableNumber || "?"}`,
                `${data.items?.length || 0} items`
            );
            toast({ title: "🔔 New Order!", description: `Table ${data.tableNumber}`, duration: 5000 });
        });

        // Listen for new delivery orders too
        socket.on("newDeliveryOrder", (data: any) => {
            console.log("New Delivery Order received!");
            queryClient.invalidateQueries({ queryKey: [`/api/kitchen-tickets?businessUnitId=${businessUnitId}`] });
            notificationManager.triggerAlert(
                "🛵 NEW ONLINE ORDER!",
                `Customer: ${data.customerName || "Online"}`,
                "New delivery order received"
            );
            toast({ title: "🛵 New Online Order!", description: `Customer: ${data.customerName}`, duration: 5000 });
        });

        return () => socket.disconnect();
    }, [businessUnitId, queryClient, toast]);

    const { data: tickets = [], isLoading } = useQuery<KitchenTicket[]>({
        queryKey: [`/api/kitchen-tickets?businessUnitId=${businessUnitId}`],
        enabled: !!businessUnitId,
        queryFn: async () => {
            if (!businessUnitId) return [];
            const res = await fetch(`${API_BASE_URL}/api/kitchen-tickets?businessUnitId=${businessUnitId}`, {
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed to fetch kitchen tickets");
            return res.json();
        },
        refetchInterval: 5000,
    });

    // Update ticket status mutation
    const updateTicketMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<KitchenTicket> }) => {
            if (!businessUnitId) throw new Error("Business unit not set");

            // Handle virtual sales tickets (online orders) - update the SALE status
            if (id.startsWith('sale-')) {
                const saleId = id.replace('sale-', '');

                // Map kitchen status to sale status
                // Kitchen workflow: in_preparation -> ready -> served
                // Sale workflow: pending -> preparing -> ready_for_pickup -> completed
                let saleStatus = 'pending';
                if (updates.startedAt) saleStatus = 'preparing';
                if (updates.status === 'ready') saleStatus = 'ready_for_pickup';
                if (updates.status === 'served') saleStatus = 'completed';

                const res = await fetch(`${API_BASE_URL}/api/delivery/orders/${saleId}/status`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ status: saleStatus }),
                });

                if (!res.ok) {
                    console.error("Failed to update sale status");
                    throw new Error("Failed to update delivery order status");
                }

                return res.json();
            }

            // Standard kitchen ticket update
            const res = await fetch(`${API_BASE_URL}/api/kitchen-tickets/${id}?businessUnitId=${businessUnitId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(updates),
            });
            if (!res.ok) throw new Error("Failed to update ticket");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/kitchen-tickets?businessUnitId=${businessUnitId}`] });
        },
    });

    // Group tickets by stage
    const { incoming, cooking, ready, served } = useMemo(() => {
        const incoming = tickets.filter((t) => t.status === "in_preparation" && !t.startedAt);
        const cooking = tickets.filter((t) => t.status === "in_preparation" && t.startedAt && !t.readyAt);
        const ready = tickets.filter((t) => t.status === "ready");
        const served = tickets.filter((t) => t.status === "served").sort((a, b) => {
            const aTime = a.servedAt ? new Date(a.servedAt).getTime() : 0;
            const bTime = b.servedAt ? new Date(b.servedAt).getTime() : 0;
            return bTime - aTime;
        });

        return { incoming, cooking, ready, served };
    }, [tickets]);

    // Alarm Logic - Trigger alarm when new orders arrive
    useEffect(() => {
        if (incoming.length > lastIncomingCount) {
            // New order arrived - start the alarm!
            startAlarm();
        }
        setLastIncomingCount(incoming.length);
    }, [incoming.length, lastIncomingCount]);


    // Update order history when served orders change
    useEffect(() => {
        setOrderHistory(served);
    }, [served]);

    // Stage transition handlers
    const handleAcceptCook = (id: string) => {
        stopAlarm(); // Stop alarm on interaction
        notificationManager.acknowledge();

        // Call mutation for both table and online orders
        updateTicketMutation.mutate({
            id,
            updates: { startedAt: new Date().toISOString() },
        });

        toast({
            title: "🍳 Cooking Started!",
            description: id.startsWith('sale-') ? "Delivery order is being prepared" : "Table order is being prepared",
            duration: 3000
        });
    };

    const handleMarkReady = (id: string) => {
        updateTicketMutation.mutate({
            id,
            updates: {
                status: "ready",
                readyAt: new Date().toISOString(),
            },
        });

        toast({
            title: "✅ Order Ready!",
            description: "Order is ready for pickup/serving",
            duration: 3000
        });
    };

    const handleMarkServed = (id: string) => {
        updateTicketMutation.mutate({
            id,
            updates: {
                status: "served",
                servedAt: new Date().toISOString(),
            },
        });

        toast({
            title: "🎉 Order Completed!",
            description: "Order has been served/delivered",
            duration: 3000
        });
    };

    const handleUndoServed = (id: string) => {
        updateTicketMutation.mutate({
            id,
            updates: {
                status: "ready",
                servedAt: null,
            },
        });
    };

    if (isLoading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-full" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col">
            {/* Header - Responsive */}
            <div className="p-3 sm:p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/50">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                        Kitchen View
                        {isAlarmPlaying && (
                            <Button variant="destructive" size="sm" onClick={stopAlarm} className="animate-pulse">
                                🔔 STOP ALARM
                            </Button>
                        )}
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">Business Unit: {businessUnitId || "-"}</p>
                </div>
                <Button variant="outline" onClick={() => setShowHistory(!showHistory)} className="w-full sm:w-auto">
                    <History className="w-5 h-5 mr-2" />
                    History ({served.length})
                </Button>
            </div>

            {/* Mobile Tab Navigation - Only visible on small screens */}
            <div className="md:hidden flex border-b bg-background sticky top-0 z-10">
                <button
                    onClick={() => setMobileTab("incoming")}
                    className={cn(
                        "flex-1 py-4 px-2 text-center font-bold text-sm transition-all relative",
                        mobileTab === "incoming"
                            ? "text-blue-600 border-b-4 border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                            : "text-muted-foreground hover:bg-muted"
                    )}
                >
                    <span>Incoming</span>
                    {incoming.length > 0 && (
                        <span className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                            {incoming.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setMobileTab("cooking")}
                    className={cn(
                        "flex-1 py-4 px-2 text-center font-bold text-sm transition-all relative",
                        mobileTab === "cooking"
                            ? "text-orange-600 border-b-4 border-orange-500 bg-orange-50 dark:bg-orange-950/30"
                            : "text-muted-foreground hover:bg-muted"
                    )}
                >
                    <span>Cooking</span>
                    {cooking.length > 0 && (
                        <span className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                            {cooking.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setMobileTab("ready")}
                    className={cn(
                        "flex-1 py-4 px-2 text-center font-bold text-sm transition-all relative",
                        mobileTab === "ready"
                            ? "text-green-600 border-b-4 border-green-500 bg-green-50 dark:bg-green-950/30"
                            : "text-muted-foreground hover:bg-muted"
                    )}
                >
                    <span>Ready</span>
                    {ready.length > 0 && (
                        <span className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                            {ready.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Mobile Content - Single tab view */}
            <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-3 bg-muted/30">
                <AnimatePresence mode="wait">
                    {mobileTab === "incoming" && (
                        <motion.div key="incoming" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-3">
                            {incoming.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <ChefHat className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>No incoming orders</p>
                                </div>
                            ) : (
                                incoming.map((ticket) => (
                                    <OrderCard key={ticket.id} ticket={ticket} stage="incoming" onAcceptCook={handleAcceptCook} />
                                ))
                            )}
                        </motion.div>
                    )}
                    {mobileTab === "cooking" && (
                        <motion.div key="cooking" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-3">
                            {cooking.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>No orders cooking</p>
                                </div>
                            ) : (
                                cooking.map((ticket) => (
                                    <OrderCard key={ticket.id} ticket={ticket} stage="cooking" onMarkReady={handleMarkReady} />
                                ))
                            )}
                        </motion.div>
                    )}
                    {mobileTab === "ready" && (
                        <motion.div key="ready" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-3">
                            {ready.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>No orders ready</p>
                                </div>
                            ) : (
                                ready.map((ticket) => (
                                    <OrderCard key={ticket.id} ticket={ticket} stage="ready" onMarkServed={handleMarkServed} />
                                ))
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Desktop Kanban Board - Hidden on mobile */}
            <div className="hidden md:grid flex-1 grid-cols-2 xl:grid-cols-3 gap-0 border-t overflow-hidden">
                <KanbanColumn title="Incoming" count={incoming.length} color="blue">
                    {incoming.map((ticket) => (
                        <OrderCard key={ticket.id} ticket={ticket} stage="incoming" onAcceptCook={handleAcceptCook} />
                    ))}
                </KanbanColumn>

                <KanbanColumn title="Cooking" count={cooking.length} color="orange">
                    {cooking.map((ticket) => (
                        <OrderCard key={ticket.id} ticket={ticket} stage="cooking" onMarkReady={handleMarkReady} />
                    ))}
                </KanbanColumn>

                <KanbanColumn title="Ready to Serve" count={ready.length} color="green">
                    {ready.map((ticket) => (
                        <OrderCard key={ticket.id} ticket={ticket} stage="ready" onMarkServed={handleMarkServed} />
                    ))}
                </KanbanColumn>
            </div>

            {/* History Sidebar/Drawer - Slides over on mobile, sidebar on desktop */}
            <AnimatePresence>
                <HistorySidebar
                    show={showHistory}
                    orders={orderHistory}
                    onClose={() => setShowHistory(false)}
                    onUndo={handleUndoServed}
                />
            </AnimatePresence>
        </div>
    );
}
