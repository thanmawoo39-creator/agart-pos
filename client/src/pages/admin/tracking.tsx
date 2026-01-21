import DeliveryMap from '@/components/admin/delivery-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Truck } from 'lucide-react';

export default function AdminTracking() {
    return (
        <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Truck className="h-6 w-6 text-blue-600" />
                    Delivery Tracking
                </h1>
                <p className="text-slate-500">Real-time GPS tracking of all active riders</p>
            </div>

            <Card className="flex-1 flex flex-col min-h-0 border-slate-200 shadow-sm">
                <CardHeader className="py-3 border-b">
                    <CardTitle className="text-base font-medium">Live Map</CardTitle>
                    <CardDescription>Updates automatically every 10 seconds</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 p-0 relative">
                    <div className="absolute inset-0">
                        <DeliveryMap />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
