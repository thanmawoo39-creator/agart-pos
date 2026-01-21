import { useState } from "react";
import QRCode from "react-qr-code";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Copy, Smartphone, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AppSettings } from "@shared/schema";

interface DeliverySettingsProps {
    formData: Partial<AppSettings>;
    setFormData: (data: Partial<AppSettings>) => void;
}

export function DeliverySettings({ formData, setFormData }: DeliverySettingsProps) {
    const { toast } = useToast();
    const [deliveryBaseUrl, setDeliveryBaseUrl] = useState(
        localStorage.getItem('deliveryBaseUrl') || ''
    );

    const handleBaseUrlChange = (value: string) => {
        const trimmed = value.trim();
        setDeliveryBaseUrl(trimmed);
        localStorage.setItem('deliveryBaseUrl', trimmed);
    };

    // QR URLs - Both use the Cloudflare tunnel URL if set, fallback to localhost
    const cleanUrl = deliveryBaseUrl.trim().replace(/\/$/, "");
    const baseUrl = cleanUrl || window.location.origin;
    const cateringRiderUrl = baseUrl + "/delivery"; // New catering delivery system
    const restaurantRiderUrl = cleanUrl ? cleanUrl + "/delivery-app" : ""; // Legacy restaurant delivery

    return (
        <div className="space-y-6">
            {/* Rider PIN Configuration */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5" />
                        <CardTitle>Rider PIN</CardTitle>
                    </div>
                    <CardDescription>
                        PIN code for delivery riders to access the delivery app.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="riderPin">Delivery Rider PIN</Label>
                        <Input
                            id="riderPin"
                            type="text"
                            pattern="[0-9]*"
                            inputMode="numeric"
                            value={formData.riderPin || ""}
                            onChange={(e) => setFormData({ ...formData, riderPin: e.target.value })}
                            placeholder="e.g. 8888"
                        />
                        <p className="text-xs text-muted-foreground">
                            Riders will use this PIN to login to the delivery app. Default is 8888.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* ⭐ CATERING RIDER APP QR - NEW SYSTEM (TOP PRIORITY) */}
            <Card className="border-2 border-purple-300 shadow-md">
                <CardHeader className="bg-purple-50/50">
                    <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        <Truck className="w-5 h-5 text-purple-600" />
                        <CardTitle className="text-purple-700">Catering Rider App (NEW)</CardTitle>
                    </div>
                    <CardDescription>
                        ဒံပေါက် ပို့ဆောင်ရေး - QR for Biryani/Pre-order delivery riders.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                    <div className="flex flex-col items-center justify-center p-6 border rounded-lg bg-purple-50">
                        <div className="mb-4 bg-white p-4 rounded-lg shadow-sm">
                            <QRCode
                                value={cateringRiderUrl}
                                size={180}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                viewBox={`0 0 256 256`}
                            />
                        </div>
                        <p className="font-mono text-xs mb-2 text-center text-slate-600 break-all">
                            {cateringRiderUrl}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    navigator.clipboard.writeText(cateringRiderUrl);
                                    toast({ title: "Copied", description: "Catering URL copied" });
                                }}
                            >
                                <Copy className="w-4 h-4 mr-1" />
                                Copy
                            </Button>
                            <Button
                                type="button"
                                variant="default"
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700"
                                onClick={() => window.open(cateringRiderUrl, '_blank')}
                            >
                                <Smartphone className="w-4 h-4 mr-1" />
                                Open
                            </Button>
                        </div>
                        <p className="text-xs text-purple-700 mt-3 text-center font-medium">
                            ✓ Active System - Use this for Catering Deliveries
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* RESTAURANT RIDER APP QR - LEGACY SYSTEM */}
            <Card className="border-dashed opacity-75">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-gray-500" />
                        <CardTitle className="text-gray-600">Restaurant Rider App (Legacy)</CardTitle>
                    </div>
                    <CardDescription>
                        QR code for restaurant delivery riders (old system).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="deliveryBaseUrl">Base URL (Cloudflare Tunnel)</Label>
                        <Input
                            id="deliveryBaseUrl"
                            value={deliveryBaseUrl}
                            onChange={(e) => handleBaseUrlChange(e.target.value)}
                            onBlur={(e) => handleBaseUrlChange(e.target.value)}
                            placeholder="https://your-app-url.trycloudflare.com"
                        />
                        <p className="text-xs text-muted-foreground">
                            This URL is saved to your local browser only.
                        </p>
                    </div>

                    {restaurantRiderUrl && (
                        <div className="flex flex-col items-center justify-center p-6 border rounded-lg bg-gray-50">
                            <div className="mb-4">
                                <QRCode
                                    value={restaurantRiderUrl}
                                    size={150}
                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    viewBox={`0 0 256 256`}
                                />
                            </div>
                            <p className="font-mono text-xs mb-2 text-center text-slate-500 break-all">
                                {restaurantRiderUrl}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(restaurantRiderUrl);
                                        toast({ title: "Copied", description: "URL copied to clipboard" });
                                    }}
                                >
                                    <Copy className="w-4 h-4 mr-1" />
                                    Copy
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(restaurantRiderUrl, '_blank')}
                                >
                                    <Smartphone className="w-4 h-4 mr-1" />
                                    Open
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
