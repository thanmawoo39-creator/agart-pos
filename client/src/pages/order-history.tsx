import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShoppingBag, MapPin, Star, Clock } from "lucide-react";
import { FeedbackModal } from "@/components/feedback-modal";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

export default function OrderHistoryPage() {
    const [, setLocation] = useLocation();
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [feedbackOpen, setFeedbackOpen] = useState(false);

    // Fetch Orders
    const { data: orders, isLoading, error } = useQuery({
        queryKey: ['/api/customer/orders'],
        queryFn: async () => {
            const res = await fetch('/api/customer/orders', { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch orders');
            // Assume API returns array of orders. 
            // If we want to check if feedback exists, we might need to fetch feedbacks separately or join in backend.
            // For MVP, we render the button for all completed orders.
            return res.json();
        }
    });

    const handleRateOrder = (orderId: string) => {
        setSelectedOrderId(orderId);
        setFeedbackOpen(true);
    };

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-orange-600" /></div>;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <p className="text-red-500 mb-4">Error loading orders.</p>
                <Button onClick={() => window.location.reload()}>Try Again</Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-3xl animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">My Orders</h1>
                    <p className="text-slate-500 dark:text-slate-400">View past orders and receipts</p>
                </div>
                <Button variant="outline" onClick={() => setLocation('/lunch-menu')}>
                    New Order
                </Button>
            </div>

            {orders?.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed">
                    <ShoppingBag className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-xl font-medium text-slate-700 dark:text-slate-300">No orders found</h3>
                    <p className="text-slate-500 mb-6">You haven't placed any orders yet.</p>
                    <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => setLocation('/lunch-menu')}>
                        Order Now
                    </Button>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders?.map((order: any) => (
                        <Card key={order.id} className="overflow-hidden border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                            <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-b flex flex-wrap gap-4 items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">#{order.id.slice(0, 8)}</span>
                                        <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}
                                            className={order.status === 'completed' ? 'bg-green-600 hover:bg-green-600' : ''}>
                                            {order.status}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center text-xs text-slate-500 mt-1">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {new Date(order.timestamp).toLocaleDateString()} at {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-bold text-orange-600">
                                        {order.total.toLocaleString()} ฿
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {order.items?.length || 0} items
                                    </div>
                                </div>
                            </div>
                            <CardContent className="p-6">
                                <div className="flex flex-col sm:flex-row justify-between gap-4">
                                    <div className="space-y-1">
                                        {order.items?.map((item: any, idx: number) => (
                                            <div key={idx} className="text-sm text-slate-700 dark:text-slate-300">
                                                <span className="font-medium text-slate-900 dark:text-slate-100">{item.quantity}x</span> {item.productName}
                                            </div>
                                        ))}
                                        {order.deliveryAddress && (
                                            <div className="flex items-start text-sm text-slate-500 mt-3 pt-3 border-t">
                                                <MapPin className="h-4 w-4 mr-1 shrink-0 mt-0.5" />
                                                <span>{order.deliveryAddress}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col justify-end gap-2 shrink-0">
                                        {order.status === 'completed' && (
                                            <Button variant="outline" size="sm" className="gap-2" onClick={() => handleRateOrder(order.id)}>
                                                <Star className="h-4 w-4" />
                                                Rate Order
                                            </Button>
                                        )}
                                        {/* Add Re-order button if needed later */}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <FeedbackModal
                open={feedbackOpen}
                onOpenChange={setFeedbackOpen}
                orderId={selectedOrderId}
            />
        </div>
    );
}
