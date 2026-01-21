import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Printer, Calendar as CalendarIcon, ChefHat, Drumstick, Utensils, Soup, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-config';
import { cn } from '@/lib/utils';

// STRICT BUSINESS UNIT ISOLATION: Catering Kitchen is exclusively for Restaurant (businessUnitId='2')
const RESTAURANT_BUSINESS_UNIT_ID = '2';

// Live timer hook for order age calculation
function useOrderTimer(createdAt: string | undefined) {
    const [elapsed, setElapsed] = useState({ minutes: 0, seconds: 0 });

    useEffect(() => {
        if (!createdAt) return;

        const updateTimer = () => {
            const created = new Date(createdAt);
            const now = new Date();
            const totalSeconds = Math.floor((now.getTime() - created.getTime()) / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            setElapsed({ minutes, seconds });
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [createdAt]);

    return elapsed;
}

// Order Timer Display Component
function OrderTimer({ createdAt }: { createdAt: string }) {
    const { minutes, seconds } = useOrderTimer(createdAt);
    const isOverdue = minutes >= 10;

    return (
        <div className={cn(
            "flex items-center gap-1 font-mono text-lg font-bold",
            isOverdue ? "text-red-600" : minutes >= 5 ? "text-yellow-600" : "text-green-600"
        )}>
            <Clock className="h-4 w-4" />
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
    );
}

// Order Card Component for KDS
function OrderCard({ order, onComplete }: { order: any; onComplete?: (id: string) => void }) {
    const { minutes } = useOrderTimer(order.createdAt || order.deliveryDate);
    const isOverdue = minutes >= 10;
    const hasNotes = order.notes || order.specialInstructions;

    return (
        <Card className={cn(
            "flex flex-col h-full transition-all duration-300",
            isOverdue
                ? "border-4 border-red-500 shadow-lg shadow-red-200"
                : minutes >= 5
                    ? "border-2 border-yellow-400"
                    : "border-2 border-slate-200"
        )}>
            <CardHeader className="pb-2 bg-slate-50 dark:bg-slate-800">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                            {order.customerName}
                        </CardTitle>
                        <p className="text-sm text-slate-500 mt-1">
                            {format(new Date(order.deliveryDate || order.createdAt), 'hh:mm a')}
                        </p>
                    </div>
                    <OrderTimer createdAt={order.createdAt || order.deliveryDate} />
                </div>
                {order.customerPhone && (
                    <a href={`tel:${order.customerPhone}`} className="text-blue-600 text-sm hover:underline">
                        📞 {order.customerPhone}
                    </a>
                )}
            </CardHeader>

            <CardContent className="flex-1 pt-4 space-y-3">
                {/* Order Items - Large Font */}
                <div className="space-y-2">
                    {order.items?.map((item: any, idx: number) => (
                        <div
                            key={idx}
                            className={cn(
                                "flex justify-between items-center py-2 px-3 rounded-lg",
                                item.quantity > 5 ? "bg-orange-100 dark:bg-orange-900/30" : "bg-slate-100 dark:bg-slate-700"
                            )}
                        >
                            <span className="text-[1.25rem] font-bold text-slate-900 dark:text-white">
                                {item.itemName || item.productName}
                            </span>
                            <Badge variant={item.quantity > 5 ? "destructive" : "secondary"} className="text-lg font-bold px-3 py-1">
                                x{item.quantity}
                            </Badge>
                        </div>
                    ))}
                </div>

                {/* Special Notes - High Visibility */}
                {hasNotes && (
                    <div className="bg-yellow-300 border-2 border-yellow-500 rounded-lg p-3 animate-pulse">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                            <span className="font-bold text-red-600 text-sm uppercase">Special Instructions</span>
                        </div>
                        <p className="text-red-700 font-bold text-lg">
                            {order.notes || order.specialInstructions}
                        </p>
                    </div>
                )}

                {/* Delivery Address */}
                {order.deliveryAddress && (
                    <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 p-2 rounded">
                        📍 {order.deliveryAddress}
                    </div>
                )}
            </CardContent>

            {/* Full-Width Action Button */}
            <div className="p-4 pt-0 mt-auto">
                <Button
                    onClick={() => onComplete?.(order.id)}
                    className={cn(
                        "w-full h-14 text-lg font-bold",
                        order.status === 'completed'
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                    )}
                >
                    <CheckCircle2 className="h-6 w-6 mr-2" />
                    {order.status === 'completed' ? 'Completed ✓' : 'Mark Complete / Serve'}
                </Button>
            </div>
        </Card>
    );
}

export default function CateringKitchen() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

    // STRICT BUSINESS UNIT ISOLATION: Only fetch Restaurant orders
    const { data: report, isLoading, refetch } = useQuery({
        queryKey: ['catering-production', format(selectedDate, 'yyyy-MM-dd'), RESTAURANT_BUSINESS_UNIT_ID],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/catering/production-report?date=${format(selectedDate, 'yyyy-MM-dd')}&businessUnitId=${RESTAURANT_BUSINESS_UNIT_ID}`);
            if (!res.ok) throw new Error('Failed to fetch report');
            return res.json();
        },
        refetchInterval: 30000 // Auto-refresh every 30 seconds
    });

    const handlePrint = () => {
        window.print();
    };

    const handleCompleteOrder = async (orderId: string) => {
        // TODO: Implement order completion API call
        console.log('Complete order:', orderId);
        refetch();
    };

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-6 print:p-0 print:space-y-4">

            {/* HEADER: Filter & Print */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                        <ChefHat className="h-7 w-7 md:h-8 md:w-8 text-orange-600" />
                        Kitchen Display System
                    </h1>
                    <p className="text-muted-foreground text-sm">Real-time catering order management</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                    {/* View Toggle */}
                    <div className="flex rounded-lg border overflow-hidden">
                        <Button
                            variant={viewMode === 'cards' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('cards')}
                            className="rounded-none"
                        >
                            Cards
                        </Button>
                        <Button
                            variant={viewMode === 'table' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('table')}
                            className="rounded-none"
                        >
                            Table
                        </Button>
                    </div>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className="w-[180px] md:w-[220px] justify-start text-left font-normal bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800 hover:text-white gap-2"
                            >
                                <CalendarIcon className="h-4 w-4" />
                                {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700" align="start">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(date) => date && setSelectedDate(date)}
                                initialFocus
                                className="text-white"
                                classNames={{
                                    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                                    month: "space-y-4",
                                    caption: "flex justify-center pt-1 relative items-center text-slate-100",
                                    caption_label: "text-sm font-medium text-slate-100",
                                    nav: "space-x-1 flex items-center",
                                    nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-slate-300 hover:bg-slate-800 rounded-md",
                                    nav_button_previous: "absolute left-1",
                                    nav_button_next: "absolute right-1",
                                    table: "w-full border-collapse space-y-1",
                                    head_row: "flex",
                                    head_cell: "text-slate-400 rounded-md w-9 font-normal text-[0.8rem]",
                                    row: "flex w-full mt-2",
                                    cell: "h-9 w-9 text-center text-sm p-0 relative text-slate-100",
                                    day: "h-9 w-9 p-0 font-normal hover:bg-slate-700 rounded-md text-slate-100",
                                    day_selected: "bg-orange-600 text-white hover:bg-orange-500 focus:bg-orange-600",
                                    day_today: "bg-slate-700 text-orange-400",
                                    day_outside: "text-slate-600 opacity-50",
                                    day_disabled: "text-slate-600 opacity-50",
                                    day_hidden: "invisible",
                                }}
                            />
                        </PopoverContent>
                    </Popover>

                    <Button onClick={handlePrint} className="bg-slate-900 border border-slate-700 text-slate-100 hover:bg-slate-800">
                        <Printer className="mr-2 h-4 w-4" />
                        <span className="hidden md:inline">Print</span>
                    </Button>
                </div>
            </div>

            {/* PRINT HEADER */}
            <div className="hidden print:block text-center mb-8">
                <h1 className="text-4xl font-bold">Kitchen Production Sheet</h1>
                <p className="text-xl mt-2">Date: {format(selectedDate, 'dd/MM/yyyy')}</p>
            </div>

            {/* Production Summary Cards */}
            {isLoading ? (
                <div className="h-32 flex items-center justify-center">Loading production data...</div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 print:grid-cols-4">
                    <Card className="bg-orange-50 border-orange-200">
                        <CardHeader className="pb-2 px-3 md:px-6">
                            <CardTitle className="text-xs md:text-sm font-medium text-orange-800 flex items-center gap-2">
                                <Drumstick className="h-4 w-4" /> Total Chicken
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 md:px-6">
                            <div className="text-3xl md:text-4xl font-bold text-orange-900">{report?.totals?.chicken || 0}</div>
                            <p className="text-xs text-orange-600 mt-1">Pieces needed</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-blue-50 border-blue-200">
                        <CardHeader className="pb-2 px-3 md:px-6">
                            <CardTitle className="text-xs md:text-sm font-medium text-blue-800 flex items-center gap-2">
                                <Utensils className="h-4 w-4" /> Total Rice
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 md:px-6">
                            <div className="text-3xl md:text-4xl font-bold text-blue-900">{report?.totals?.rice || 0}</div>
                            <p className="text-xs text-blue-600 mt-1">Portions needed</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-red-50 border-red-200">
                        <CardHeader className="pb-2 px-3 md:px-6">
                            <CardTitle className="text-xs md:text-sm font-medium text-red-800 flex items-center gap-2">
                                <span className="text-lg">🌶️</span> Total Balachaung
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 md:px-6">
                            <div className="text-3xl md:text-4xl font-bold text-red-900">{report?.totals?.balachaung || 0}</div>
                            <p className="text-xs text-red-600 mt-1">Cups needed</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-green-50 border-green-200">
                        <CardHeader className="pb-2 px-3 md:px-6">
                            <CardTitle className="text-xs md:text-sm font-medium text-green-800 flex items-center gap-2">
                                <Soup className="h-4 w-4" /> Total Soup
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 md:px-6">
                            <div className="text-3xl md:text-4xl font-bold text-green-900">{report?.totals?.soup || 0}</div>
                            <p className="text-xs text-green-600 mt-1">Bowls needed</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Orders Display */}
            {viewMode === 'cards' && !isLoading && (
                <div className="space-y-4 print:hidden">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-sm">
                            {report?.orders?.length || 0}
                        </span>
                        Active Orders
                    </h2>

                    {/* Responsive Grid: 2 cols on tablet, 3-4 on desktop */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {report?.orders?.length === 0 ? (
                            <Card className="col-span-full py-16 text-center text-slate-500">
                                <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-30" />
                                <p className="text-xl">No orders for this date</p>
                            </Card>
                        ) : (
                            report?.orders?.map((order: any) => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    onComplete={handleCompleteOrder}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Table View (for printing / alternative view) */}
            {(viewMode === 'table' || true) && (
                <div className={cn("space-y-4", viewMode !== 'table' && "hidden print:block")}>
                    <h2 className="text-xl font-bold hidden print:block">Distribution List</h2>
                    <Card className={viewMode !== 'table' ? "print:shadow-none" : ""}>
                        <CardHeader className="print:hidden">
                            <CardTitle>Distribution List</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px]">Time</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead className="hidden md:table-cell">Phone</TableHead>
                                        <TableHead className="w-[40%]">Order Details</TableHead>
                                        <TableHead className="text-right w-[80px] print:hidden">Status</TableHead>
                                        <TableHead className="hidden print:table-cell w-[80px] text-right">Check</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {report?.orders?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                No confirmed orders for this date.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        report?.orders?.map((order: any) => (
                                            <TableRow key={order.id}>
                                                <TableCell className="font-medium">
                                                    {format(new Date(order.deliveryDate || order.createdAt), 'hh:mm a')}
                                                </TableCell>
                                                <TableCell className="font-bold">{order.customerName}</TableCell>
                                                <TableCell className="hidden md:table-cell">{order.customerPhone}</TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        {order.items?.map((item: any, idx: number) => (
                                                            <div key={idx} className={item.quantity > 10 ? "font-bold text-primary" : ""}>
                                                                • {item.quantity} x {item.itemName || item.productName}
                                                            </div>
                                                        ))}
                                                        {order.deliveryAddress && (
                                                            <div className="text-xs text-gray-500 mt-1 italic">
                                                                📍 {order.deliveryAddress}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right print:hidden">
                                                    <Checkbox />
                                                </TableCell>
                                                <TableCell className="hidden print:table-cell border-b border-gray-300"></TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

