import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, ChefHat, Utensils } from "lucide-react";
import { io } from "socket.io-client";
import { API_BASE_URL } from "@/lib/api-config";
import { cn } from "@/lib/utils";

interface OrderStatusTrackerProps {
    tableNumber: string;
}

type OrderStage = "received" | "cooking" | "served";

export function OrderStatusTracker({ tableNumber }: OrderStatusTrackerProps) {
    const [activeStage, setActiveStage] = useState<OrderStage | null>(null);
    const [lastActivity, setLastActivity] = useState<Date | null>(null);

    useEffect(() => {
        // Determine initial state (mock for now, or fetch from API)
        // For now, listen to socket
        const socket = io(API_BASE_URL);

        socket.on("connect", () => {
            console.log("[TRACKER] Connected to socket");
        });

        // Listen for updates specific to this table
        // Assuming backend emits 'kitchen:ticket_updated' or similar
        socket.on("kitchen:ticket_updated", (data: any) => {
            // Logic to filter by table and update stage
            // This is a simplification. Ideally, we need to know WHICH order.
            // For "Table Status", we track the *latest* active order.

            console.log("[TRACKER] Update:", data);

            // Simple heuristic for demo:
            if (data?.tableNumber === tableNumber) {
                if (data.status === 'ready') setActiveStage('served'); // In kitchen terms, 'ready' means ready to serve
                else if (data.status === 'cooking') setActiveStage('cooking');
                else if (data.status === 'pending') setActiveStage('received');
                setLastActivity(new Date());
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [tableNumber]);

    if (!activeStage) return null;

    const stages = [
        { id: "received", label: "Received", icon: Clock },
        { id: "cooking", label: "Cooking", icon: ChefHat },
        { id: "served", label: "Served", icon: Utensils },
    ];

    const currentIndex = stages.findIndex(s => s.id === activeStage);

    return (
        <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 sticky top-0 z-40"
        >
            <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">
                        Order Status (Table {tableNumber})
                    </h3>
                    {lastActivity && <span className="text-xs text-slate-400">Updated just now</span>}
                </div>

                <div className="relative flex justify-between items-center">
                    {/* Progress Bar Background */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 dark:bg-slate-700 rounded-full z-0" />

                    {/* Active Progress Bar */}
                    <motion.div
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-green-500 rounded-full z-0 transition-all duration-500"
                        style={{ width: `${(currentIndex / (stages.length - 1)) * 100}%` }}
                    />

                    {stages.map((stage, index) => {
                        const isActive = index <= currentIndex;
                        const isCurrent = index === currentIndex;
                        const Icon = stage.icon;

                        return (
                            <div key={stage.id} className="relative z-10 flex flex-col items-center gap-1">
                                <div
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2",
                                        isActive
                                            ? "bg-green-500 border-green-500 text-white shadow-lg scale-110"
                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-300"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                </div>
                                <span className={cn(
                                    "text-[10px] font-bold transition-colors",
                                    isActive ? "text-green-600 dark:text-green-400" : "text-slate-400"
                                )}>
                                    {stage.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </motion.div>
    );
}
