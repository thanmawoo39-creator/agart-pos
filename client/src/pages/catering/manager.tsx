import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { List, Edit, Trash2, Phone, MapPin, Plus, Camera, Image as ImageIcon, X } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-config';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

// STRICT BUSINESS UNIT ISOLATION: Catering is exclusively for Restaurant (businessUnitId='2')
const RESTAURANT_BUSINESS_UNIT_ID = '2';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CateringOrderModal } from '@/components/catering/CateringOrderModal';

interface CateringOrder {
    id: number;
    customerName: string;
    customerPhone: string;
    deliveryDate: string;
    deliveryAddress: string | null;
    totalAmount: number;
    depositPaid: number;
    status: string;
    proofImageUrl?: string | null;
    paymentSlipUrl?: string | null;
    items: Array<{
        id: number;
        itemName: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        isAddon: boolean;
    }>;
}

export default function CateringManager() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState<number | null>(null);
    const [editingOrder, setEditingOrder] = useState<CateringOrder | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    // Fetch all orders - STRICT: Only Restaurant orders (businessUnitId='2')
    const { data: orders = [], isLoading } = useQuery<CateringOrder[]>({
        queryKey: ['catering-orders', RESTAURANT_BUSINESS_UNIT_ID],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/catering/orders?businessUnitId=${RESTAURANT_BUSINESS_UNIT_ID}`);
            if (!res.ok) throw new Error('Failed to fetch orders');
            return res.json();
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (orderId: number) => {
            const res = await fetch(`${API_BASE_URL}/api/catering/orders/${orderId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete order');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['catering-orders'] });
            toast({ title: 'Success', description: 'Order deleted successfully' });
            setDeleteDialogOpen(false);
            setOrderToDelete(null);
        },
        onError: (error: Error) => {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        },
    });

    const handleDelete = (orderId: number) => {
        setOrderToDelete(orderId);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (orderToDelete) {
            deleteMutation.mutate(orderToDelete);
        }
    };

    const handleEdit = (order: CateringOrder) => {
        setEditingOrder(order);
        setModalOpen(true);
    };

    const handleNewOrder = () => {
        setEditingOrder(null);
        setModalOpen(true);
    };

    const formatOrderSummary = (items: CateringOrder['items']) => {
        const mainItems = items.filter(item => !item.isAddon && item.quantity > 0);
        if (mainItems.length === 0) return 'No items';

        return mainItems
            .map(item => `${item.quantity}x ${item.itemName}`)
            .join(', ')
            .substring(0, 50) + (mainItems.length > 1 ? '...' : '');
    };

    const encodeAddressForMaps = (address: string | null) => {
        if (!address) return '';
        return encodeURIComponent(address);
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
                        <List className="h-6 w-6 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100">Catering Order Manager</h1>
                        <p className="text-sm text-slate-400">View, edit, and manage all catering orders</p>
                    </div>
                </div>
                <Button onClick={handleNewOrder} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25">
                    <Plus className="mr-2 h-4 w-4" />
                    New Order
                </Button>
            </div>

            {/* Table */}
            <div className="border border-slate-800 rounded-xl bg-slate-900 shadow-2xl overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-400">Loading orders...</div>
                ) : orders.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        No orders yet. Click "New Order" to create one.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-800 border-b border-slate-700">
                                <TableRow className="hover:bg-slate-800">
                                    <TableHead className="min-w-[100px] text-amber-400 font-semibold">Date</TableHead>
                                    <TableHead className="min-w-[180px] text-amber-400 font-semibold">Customer</TableHead>
                                    <TableHead className="min-w-[200px] text-amber-400 font-semibold">Location</TableHead>
                                    <TableHead className="min-w-[180px] text-amber-400 font-semibold">Details</TableHead>
                                    <TableHead className="min-w-[100px] text-right text-amber-400 font-semibold">Total</TableHead>
                                    <TableHead className="min-w-[100px] text-center text-amber-400 font-semibold">Proof</TableHead>
                                    <TableHead className="min-w-[150px] text-center text-amber-400 font-semibold">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((order) => (
                                    <TableRow key={order.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                                        <TableCell className="font-medium text-slate-200">
                                            {format(new Date(order.deliveryDate), 'dd/MM/yyyy')}
                                            <div className="text-xs text-slate-400">
                                                {format(new Date(order.deliveryDate), 'hh:mm a')}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-lg text-amber-400">
                                                    {order.customerName}
                                                </span>
                                                {order.customerPhone && (
                                                    <a
                                                        href={`tel:${order.customerPhone}`}
                                                        className="text-sm text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 mt-1"
                                                    >
                                                        <Phone className="h-3 w-3" />
                                                        {order.customerPhone}
                                                    </a>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {order.deliveryAddress ? (
                                                <>
                                                    <div className="text-sm mb-1 text-slate-300">{order.deliveryAddress}</div>
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeAddressForMaps(order.deliveryAddress)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                                                    >
                                                        <MapPin className="h-3 w-3" />
                                                        Open Map
                                                    </a>
                                                </>
                                            ) : (
                                                <span className="text-sm text-slate-500">No address</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-300">
                                            {formatOrderSummary(order.items)}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold text-green-400">
                                            ฿{order.totalAmount?.toFixed(2) || '0.00'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-center gap-2">
                                                {order.proofImageUrl && (
                                                    <button
                                                        onClick={() => setViewingImage(order.proofImageUrl!)}
                                                        className="w-10 h-10 rounded-lg border-2 border-slate-600 overflow-hidden hover:ring-2 ring-blue-400 transition-all"
                                                        title="Proof of Delivery"
                                                    >
                                                        <img src={order.proofImageUrl} alt="Proof" className="w-full h-full object-cover" />
                                                    </button>
                                                )}
                                                {order.paymentSlipUrl && (
                                                    <button
                                                        onClick={() => setViewingImage(order.paymentSlipUrl!)}
                                                        className="w-10 h-10 rounded-lg border-2 border-slate-600 overflow-hidden hover:ring-2 ring-green-400 transition-all"
                                                        title="Payment Slip"
                                                    >
                                                        <img src={order.paymentSlipUrl} alt="Slip" className="w-full h-full object-cover" />
                                                    </button>
                                                )}
                                                {!order.proofImageUrl && !order.paymentSlipUrl && (
                                                    <span className="text-xs text-slate-500">-</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleEdit(order)}
                                                    className="h-8 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                                                >
                                                    <Edit className="h-3 w-3 mr-1" />
                                                    Edit
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleDelete(order.id)}
                                                    className="h-8 border-red-600/50 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                                                >
                                                    <Trash2 className="h-3 w-3 mr-1" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent className="bg-slate-900 border border-slate-700 text-slate-100">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-100">Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                            This will permanently delete this catering order and all its items.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-800">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Order Modal (for both create and edit) */}
            <CateringOrderModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                initialData={editingOrder}
            />

            {/* Image Viewer Modal */}
            {viewingImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setViewingImage(null)}
                >
                    <div className="relative max-w-3xl max-h-[90vh]">
                        <button
                            onClick={() => setViewingImage(null)}
                            className="absolute -top-10 right-0 text-white hover:text-gray-300"
                        >
                            <X className="h-8 w-8" />
                        </button>
                        <img
                            src={viewingImage}
                            alt="Proof Image"
                            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
