import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import { Truck, Navigation, Package, Map as MapIcon, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon missing assets
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

// Custom Icons using Emojis (More reliable than external images)
const createRiderIcon = (type: 'restaurant' | 'catering') => new L.DivIcon({
    className: 'bg-transparent',
    html: `<div style="font-size: 30px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); text-align: center; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">${type === 'catering' ? '🚚' : '🛵'}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

const restaurantIcon = createRiderIcon('restaurant');
const cateringIcon = createRiderIcon('catering');

interface ActiveDelivery {
    id: string;
    type: 'restaurant' | 'catering';
    riderName?: string;
    customerName: string;
    lat: number;
    lng: number;
    status: string;
    updatedAt: string;
}

// Sub-component to handle map effects (Auto-Fit)
function MapEffect({ deliveries }: { deliveries: ActiveDelivery[] }) {
    const map = useMap();
    const [hasFit, setHasFit] = useState(false);
    const prevCountRef = useRef(0);

    useEffect(() => {
        // Only fit bounds if we have riders and either haven't fit yet OR the number of riders changed (new rider appearing)
        if (deliveries.length > 0 && (!hasFit || deliveries.length !== prevCountRef.current)) {
            console.log("📍 [Map] Auto-fitting bounds for", deliveries.length, "riders");

            // Collect all points
            const points = deliveries.map(d => [d.lat, d.lng] as [number, number]);

            // Create bounds
            const bounds = L.latLngBounds(points);

            // Pad the bounds slightly so markers aren't on the edge
            map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
            setHasFit(true);
            prevCountRef.current = deliveries.length;
        }
    }, [deliveries, map, hasFit]);

    return null;
}

export default function DeliveryMap() {
    // Default center (Yangon)
    const [center] = useState<[number, number]>([16.8409, 96.1735]);

    const { data: deliveries = [], refetch, isRefetching } = useQuery<ActiveDelivery[]>({
        queryKey: ['/api/admin/active-deliveries'],
        queryFn: async () => {
            const res = await fetch('/api/admin/active-deliveries');
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            return data;
        },
        refetchInterval: 5000,
    });

    return (
        <div className="h-full w-full rounded-lg overflow-hidden border border-slate-200 shadow-inner relative flex flex-col">
            <div className="flex-1 relative min-h-0 bg-slate-100">
                <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Auto-Fit Logic */}
                    <MapEffect deliveries={deliveries} />

                    {deliveries.map((delivery) => {
                        // Check for stale data (> 5 minutes old)
                        const fiveMinutes = 5 * 60 * 1000;
                        const lastUpdate = new Date(delivery.updatedAt || new Date()).getTime();
                        const isStale = (Date.now() - lastUpdate) > fiveMinutes;

                        return (
                            <Marker
                                key={`${delivery.type}-${delivery.id}`}
                                position={[delivery.lat, delivery.lng]}
                                icon={delivery.type === 'catering' ? cateringIcon : restaurantIcon}
                                opacity={isStale ? 0.5 : 1.0}
                            >
                                <Popup>
                                    <div className="p-2 min-w-[200px]">
                                        <div className="flex items-center gap-2 mb-2 font-bold text-base border-b pb-2">
                                            {delivery.type === 'catering' ? (
                                                <Truck className="h-4 w-4 text-purple-600" />
                                            ) : (
                                                <Navigation className="h-4 w-4 text-orange-600" />
                                            )}
                                            {delivery.customerName}
                                            {isStale && (
                                                <span className="ml-auto text-xs font-normal text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                                                    Offline
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-slate-600 space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-xs text-slate-400">Type</span>
                                                <span className={`capitalize font-bold text-xs px-2 py-0.5 rounded-full ${delivery.type === 'catering' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                                                    }`}>{delivery.type}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-xs text-slate-400">Status</span>
                                                <span className="capitalize text-green-600 font-bold">{delivery.status.replace(/_/g, ' ')}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-2 text-right">
                                                Updated: {format(new Date(delivery.updatedAt || new Date()), 'hh:mm:ss a')}
                                            </div>
                                            {isStale && (
                                                <div className="text-[10px] text-red-500 text-center bg-red-50 p-1 rounded mt-1">
                                                    Signal lost {Math.floor((Date.now() - lastUpdate) / 60000)}m ago
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                </MapContainer>
            </div>

            {/* Legend / Overlay */}
            <div className="absolute top-4 right-4 bg-white/95 p-3 rounded-lg shadow-md text-xs z-[1000] border border-slate-200">
                <div className="font-bold mb-2 flex items-center justify-between gap-4">
                    <span>Live Fleet ({deliveries.length})</span>
                    {isRefetching && <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />}
                </div>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <span className="text-xl leading-none">🚚</span>
                        <span>Catering ({deliveries.filter(d => d.type === 'catering').length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xl leading-none">🛵</span>
                        <span>Restaurant ({deliveries.filter(d => d.type === 'restaurant').length})</span>
                    </div>
                </div>
                <div className="mt-2 pt-2 border-t text-[10px] text-slate-400">
                    Auto-refreshing every 5s
                </div>
            </div>
        </div>
    );
}
