import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, Save, ArrowLeft, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/lib/api-config';
import { Link } from 'wouter';

interface CateringProduct {
    id: number;
    key: string;
    label: string;
    price: number;
    isActive: boolean;
}

export default function CateringPricingSettings() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: products, isLoading } = useQuery<CateringProduct[]>({
        queryKey: ['catering-products'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/catering/products`);
            if (!res.ok) throw new Error('Failed to fetch products');
            return res.json();
        }
    });

    const updatePriceMutation = useMutation({
        mutationFn: async ({ key, price }: { key: string; price: number }) => {
            const res = await fetch(`${API_BASE_URL}/api/catering/products/${key}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ price })
            });
            if (!res.ok) throw new Error('Failed to update price');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['catering-products'] });
            toast({ title: 'Price Updated', description: 'The new price has been saved.' });
        },
        onError: () => {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save price.' });
        }
    });

    if (isLoading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-orange-500" /></div>;
    }

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/settings">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold text-slate-800">Catering Pricing Settings</h1>
            </div>

            <Card className="border-orange-100 shadow-md">
                <CardHeader className="bg-orange-50/50 border-b border-orange-100">
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-orange-600" />
                        Base Prices
                    </CardTitle>
                    <CardDescription>
                        {t('catering.managePricing')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                        {(!products || products.length === 0) && (
                            <div className="p-8 text-center">
                                <p className="text-slate-500 mb-4">No pricing configuration found.</p>
                                <Button
                                    onClick={() => queryClient.invalidateQueries({ queryKey: ['catering-products'] })}
                                    variant="outline"
                                    className="border-orange-200 text-orange-700 hover:bg-orange-50"
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Initialize / Refresh
                                </Button>
                            </div>
                        )}

                        {products?.map((product) => (
                            <div key={product.key} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-slate-800">{product.label}</h3>
                                    <p className="text-sm text-slate-500 font-mono">{product.key}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="relative w-32">
                                        <div className="absolute left-2.5 top-2.5 text-slate-400 font-bold">฿</div>
                                        <Input
                                            type="number"
                                            className="pl-7 font-bold text-right"
                                            defaultValue={product.price}
                                            onBlur={(e) => {
                                                const newPrice = parseFloat(e.target.value);
                                                if (newPrice !== product.price && !isNaN(newPrice)) {
                                                    updatePriceMutation.mutate({ key: product.key, price: newPrice });
                                                }
                                            }}
                                            onFocus={(e) => e.target.select()}
                                        />
                                    </div>
                                    <Button
                                        size="sm"
                                        className="bg-orange-600 hover:bg-orange-700 text-white"
                                        disabled={updatePriceMutation.isPending}
                                    >
                                        Update
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
