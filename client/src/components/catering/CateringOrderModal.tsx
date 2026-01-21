import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { X, Save, Printer } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/api-config';
import { format } from 'date-fns';

// Schema - Using separate date_part and time_part fields
const cateringOrderSchema = z.object({
    customerName: z.string().min(1, 'Name is required'),
    customerPhone: z.string().min(1, 'Phone is required'),
    date_part: z.string().min(1, 'Date is required'),
    time_part: z.string().min(1, 'Time is required'),
    deliveryAddress: z.string().optional(),
    depositPaid: z.preprocess((val) => (isNaN(Number(val)) ? 0 : Number(val)), z.number().min(0).default(0)),
    items: z.array(z.object({
        itemName: z.string().min(1),
        quantity: z.preprocess((val) => (val === '' || isNaN(Number(val)) ? 0 : Number(val)), z.number().min(0).default(0)),
        unitPrice: z.number().min(0),
        isAddon: z.boolean().default(false)
    })).min(1, 'At least one item is required')
});

type CateringOrderFormValues = z.infer<typeof cateringOrderSchema>;

interface CateringOrderModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: {
        id: number;
        customerName: string;
        customerPhone: string;
        deliveryDate: string;
        deliveryAddress: string | null;
        depositPaid: number;
        items: Array<{
            itemName: string;
            quantity: number;
            unitPrice: number;
            isAddon: boolean;
        }>;
    } | null;
}

export function CateringOrderModal({ open, onOpenChange, initialData }: CateringOrderModalProps) {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const isEditMode = !!initialData;

    // List of keys to map defaults
    // Note: We keep the structure here but prices will be overwritten by API data
    const itemConfig = [
        { key: 'standard_set', name: "ထမင်း+ဟင်း (Standard)", isAddon: false },
        { key: 'royal_set', name: "အစုံ (Royal)", isAddon: false },
        { key: 'std_balachaung', name: "ထမင်း+ဟင်း + ငပိကြော်", isAddon: false },
        { key: 'std_soup', name: "ထမင်း+ဟင်း + ဟင်းရည်", isAddon: false },
        { key: 'extra_chicken', name: "ကြက်သားသီးသန့်", isAddon: true },
        { key: 'extra_rice', name: "ထမင်းသီးသန့်", isAddon: true },
        { key: 'extra_balachaung', name: "ဗာလချောင်ကြော်သီးသန့်", isAddon: true },
    ];

    // Fetch Prices
    const { data: pricingData } = useQuery({
        queryKey: ['catering-products'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/catering/products`);
            if (!res.ok) return [];
            return res.json();
        },
        staleTime: 1000 * 60 * 5, // Cache for 5 mins
    });

    const form = useForm<CateringOrderFormValues>({
        resolver: zodResolver(cateringOrderSchema),
        defaultValues: {
            customerName: '',
            customerPhone: '',
            date_part: '',
            time_part: '12:00',
            deliveryAddress: '',
            depositPaid: 0,
            items: [] // Will be populated by useEffect
        }
    });

    // Populate Form Items when Data is Ready
    useEffect(() => {
        if (pricingData && pricingData.length > 0) {
            const newItems = itemConfig.map(config => {
                const product = pricingData.find((p: any) => p.key === config.key);
                return {
                    itemName: config.name,
                    unitPrice: product ? product.price : 0,
                    isAddon: config.isAddon,
                    quantity: 0
                };
            });
            form.reset({ ...form.getValues(), items: newItems });
        } else {
            // Fallback if no data yet
            const fallbackItems = [
                { itemName: "Standard Set (Rice+Curry)", unitPrice: 60, isAddon: false, quantity: 0 },
                { itemName: "Royal Set (All Included)", unitPrice: 75, isAddon: false, quantity: 0 },
                { itemName: "Standard + Balachaung", unitPrice: 65, isAddon: false, quantity: 0 },
                { itemName: "Standard + Soup", unitPrice: 70, isAddon: false, quantity: 0 },
                { itemName: "Extra Chicken", unitPrice: 25, isAddon: true, quantity: 0 },
                { itemName: "Extra Rice", unitPrice: 10, isAddon: true, quantity: 0 },
                { itemName: "Extra Balachaung", unitPrice: 10, isAddon: true, quantity: 0 },
            ];
            form.reset({ ...form.getValues(), items: fallbackItems });
        }
    }, [pricingData, open]);

    // Populate Form with Edit Data
    useEffect(() => {
        if (open && initialData) {
            // Parse delivery date into date_part and time_part
            const deliveryDateTime = new Date(initialData.deliveryDate);
            const datePart = deliveryDateTime.toISOString().split('T')[0]; // YYYY-MM-DD
            const timePart = deliveryDateTime.toTimeString().substring(0, 5); // HH:MM

            // Map existing items to form structure
            const mappedItems = itemConfig.map(config => {
                const existingItem = initialData.items.find(
                    item => item.itemName === config.name
                );
                return {
                    itemName: config.name,
                    unitPrice: existingItem?.unitPrice || 0,
                    isAddon: config.isAddon,
                    quantity: existingItem?.quantity || 0
                };
            });

            form.reset({
                customerName: initialData.customerName,
                customerPhone: initialData.customerPhone,
                date_part: datePart,
                time_part: timePart,
                deliveryAddress: initialData.deliveryAddress || '',
                depositPaid: initialData.depositPaid,
                items: mappedItems
            });
        } else if (!open) {
            // Reset form when closed
            const resetItems = form.getValues('items').map(item => ({
                ...item,
                quantity: 0
            }));
            form.reset({
                customerName: '',
                customerPhone: '',
                date_part: '',
                time_part: '12:00',
                deliveryAddress: '',
                depositPaid: 0,
                items: resetItems
            });
        }
    }, [open, initialData]);


    const { fields, update } = useFieldArray({
        control: form.control,
        name: "items"
    });

    // Calculate Totals
    const items = form.watch('items');
    const depositPaid = Number(form.watch('depositPaid')) || 0;

    const totalAmount = items.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unitPrice) || 0;
        return sum + (qty * price);
    }, 0);
    const balanceDue = totalAmount - depositPaid;

    // Mutation
    const createOrder = useMutation({
        mutationFn: async (data: CateringOrderFormValues) => {
            // Filter out 0 quantity items before sending
            const validItems = data.items.filter(i => i.quantity > 0);

            if (validItems.length === 0) {
                throw new Error("Please add at least one item");
            }

            // Combine date_part and time_part into ISO deliveryDate
            const deliveryDate = new Date(`${data.date_part}T${data.time_part}`).toISOString();

            const payload = {
                customerName: data.customerName,
                customerPhone: data.customerPhone,
                deliveryDate,
                deliveryAddress: data.deliveryAddress,
                depositPaid: data.depositPaid,
                items: validItems
            };

            const url = isEditMode
                ? `${API_BASE_URL}/api/catering/orders/${initialData.id}`
                : `${API_BASE_URL}/api/catering/orders`;

            const method = isEditMode ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Failed to ${isEditMode ? 'update' : 'create'} order`);
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['catering-orders'] });
            toast({
                title: "Success",
                description: `Catering order ${isEditMode ? 'updated' : 'created'} successfully`
            });
            onOpenChange(false);

            // Reset form with fresh zero quantities
            const resetItems = form.getValues('items').map(item => ({
                ...item,
                quantity: 0
            }));

            form.reset({
                customerName: '',
                customerPhone: '',
                date_part: '',
                time_part: '12:00',
                deliveryAddress: '',
                depositPaid: 0,
                items: resetItems
            });
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    });

    const onSubmit = (data: CateringOrderFormValues) => {
        createOrder.mutate(data);
    };



    // Sections
    // Refactored to unified row layout


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl text-slate-100">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-amber-400">
                        📦 {isEditMode ? t('catering.editBiryaniOrder') : t('catering.biryaniPreorderForm')}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* LEFT COLUMN: Customer & Logistics */}
                        <div className="space-y-4 border-r border-slate-700 pr-6">
                            <h3 className="font-semibold text-amber-400 border-b border-slate-700 pb-2">Customer Details</h3>

                            <div className="grid gap-2">
                                <Label className="text-slate-300">Customer Name <span className="text-red-400">*</span></Label>
                                <Input {...form.register('customerName')} placeholder="e.g. John Doe" className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 focus:ring-amber-500 focus:border-amber-500" />
                                {form.formState.errors.customerName && <p className="text-red-400 text-sm">{form.formState.errors.customerName.message}</p>}
                            </div>

                            <div className="grid gap-2">
                                <Label className="text-slate-300">Phone Number <span className="text-red-400">*</span></Label>
                                <Input type="tel" {...form.register('customerPhone')} placeholder="081-..." className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 focus:ring-amber-500 focus:border-amber-500" />
                                {form.formState.errors.customerPhone && <p className="text-red-400 text-sm">{form.formState.errors.customerPhone.message}</p>}
                            </div>

                            <div className="grid gap-2">
                                <Label className="text-slate-300">Delivery Date & Time <span className="text-red-400">*</span></Label>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <Label className="text-xs text-slate-400 mb-1 block">Date (DD/MM/YYYY)</Label>
                                        <Input
                                            type="date"
                                            {...form.register('date_part')}
                                            className="bg-slate-950 border-slate-700 text-white focus:ring-amber-500 focus:border-amber-500"
                                        />
                                        {form.formState.errors.date_part && <p className="text-red-400 text-xs mt-1">{form.formState.errors.date_part.message}</p>}
                                    </div>
                                    <div className="w-36">
                                        <Label className="text-xs text-slate-400 mb-1 block">Time (AM/PM)</Label>
                                        <Input
                                            type="time"
                                            {...form.register('time_part')}
                                            className="bg-slate-950 border-slate-700 text-white focus:ring-amber-500 focus:border-amber-500"
                                        />
                                        {form.formState.errors.time_part && <p className="text-red-400 text-xs mt-1">{form.formState.errors.time_part.message}</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label className="text-slate-300">Delivery Address</Label>
                                <Textarea {...form.register('deliveryAddress')} placeholder="Enter full address..." rows={3} className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 focus:ring-amber-500 focus:border-amber-500" />
                            </div>

                            {/* Glass Effect Payment Summary */}
                            <div className="bg-gradient-to-r from-slate-800 to-slate-700/80 backdrop-blur-sm p-4 rounded-xl mt-4 border border-slate-600 shadow-lg">
                                <h4 className="font-semibold text-amber-400 mb-3 text-sm uppercase tracking-wide">Payment Summary</h4>
                                <div className="flex justify-between text-sm mb-2 text-slate-300">
                                    <span>Subtotal:</span>
                                    <span className="font-bold text-white">฿{totalAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between mb-3">
                                    <Label className="text-sm text-slate-300">Deposit Received:</Label>
                                    <Input
                                        type="number"
                                        className="w-28 h-9 text-right bg-slate-950 border-slate-600 text-white font-mono focus:ring-amber-500 focus:border-amber-500"
                                        {...form.register('depositPaid', { valueAsNumber: true })}
                                    />
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-600 pt-3 mt-2">
                                    <span className="text-lg font-bold text-slate-200">Balance Due:</span>
                                    <span className={`text-3xl font-bold ${balanceDue > 0 ? "text-amber-400" : "text-green-400"}`}>
                                        ฿{balanceDue.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Dark Styled Menu Items */}
                        <div className="space-y-0 border border-slate-700 rounded-xl overflow-hidden bg-slate-800/30">
                            {/* Header */}
                            <div className="flex justify-between items-center bg-slate-800 p-3 border-b border-slate-700">
                                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Item Name</span>
                                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Qty</span>
                            </div>

                            <div className="max-h-[500px] overflow-y-auto">
                                {fields.map((field, idx) => {
                                    const isEven = (idx + 1) % 2 === 0;
                                    const isRoyalSet = field.itemName.toLowerCase().includes('royal') || field.itemName.includes('အစုံ');

                                    // Dark theme styling
                                    const rowBackground = isRoyalSet
                                        ? 'bg-amber-900/30 border-amber-700/50'
                                        : isEven ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-900/50 border-slate-700';

                                    // Add Header for Extras (After first 4 main items)
                                    const isFirstAddon = idx === 4;

                                    return (
                                        <React.Fragment key={field.id}>
                                            {isFirstAddon && (
                                                <div className="bg-slate-800 px-3 py-1.5 text-xs font-bold text-amber-400 uppercase tracking-widest text-center border-y border-slate-700">
                                                    Add-ons & Extras
                                                </div>
                                            )}

                                            <div className={`flex items-center justify-between p-4 ${rowBackground} border-b last:border-0 rounded-lg m-1`}>
                                                <div className="flex flex-col">
                                                    <span className={`text-lg font-bold ${isRoyalSet ? 'text-amber-400' : 'text-slate-100'} flex items-center gap-2`}>
                                                        {field.itemName}
                                                        {isRoyalSet && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">⭐ RECOMMENDED</span>}
                                                    </span>
                                                    <span className="text-sm text-slate-400">
                                                        ฿{field.unitPrice}
                                                    </span>
                                                </div>

                                                <div className="w-24">
                                                    <Input
                                                        type="number"
                                                        {...form.register(`items.${idx}.quantity` as const, { valueAsNumber: true })}
                                                        className="text-center text-xl font-bold h-12 bg-slate-950 border-slate-600 text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 transition-all"
                                                        onFocus={(e) => e.target.select()}
                                                        min={0}
                                                    />
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 sticky bottom-0 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent pt-4 pb-2 border-t border-slate-700 mt-4 -mx-6 px-6">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white">Cancel</Button>
                        <Button type="submit" className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white min-w-[150px] shadow-lg shadow-orange-500/25 font-semibold" disabled={createOrder.isPending}>
                            {createOrder.isPending ? 'Saving...' : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    {isEditMode ? 'Update Order' : 'Confirm Order'}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
