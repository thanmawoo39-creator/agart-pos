import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/api-config";
import type { AppSettings } from "@shared/schema";

interface PaymentSettingsProps {
    formData: Partial<AppSettings>;
    setFormData: (data: Partial<AppSettings>) => void;
}

export function PaymentSettings({ formData, setFormData }: PaymentSettingsProps) {
    const { toast } = useToast();
    const [qrUploadSuccess, setQrUploadSuccess] = useState(false);
    const [isUploadingQR, setIsUploadingQR] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleQRUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast({
                title: "Invalid file type",
                description: "Please select an image file (PNG, JPG, etc.)",
                variant: "destructive",
            });
            return;
        }

        setIsUploadingQR(true);
        setQrUploadSuccess(false);

        try {
            const uploadData = new FormData();
            uploadData.append('file', file);

            const response = await fetch(`${API_BASE_URL}/api/settings/upload-qr`, {
                method: 'POST',
                body: uploadData,
                credentials: 'include',
            });

            const result = await response.json().catch(() => ({}));

            if (response.ok) {
                if (result?.url) {
                    setFormData({ ...formData, mobilePaymentQrUrl: result.url });
                }
                setQrUploadSuccess(true);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                setTimeout(() => setQrUploadSuccess(false), 3000);
                toast({
                    title: "QR Code Updated",
                    description: "Mobile payment QR code has been updated successfully.",
                });
            } else {
                throw new Error(result?.error || 'Failed to upload QR code');
            }
        } catch (error) {
            console.error('QR upload error:', error);
            toast({
                title: "Upload Failed",
                description: "Failed to upload QR code. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsUploadingQR(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Mobile Payment QR Code */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Smartphone className="w-5 h-5" />
                        <CardTitle>Mobile Payment QR Code</CardTitle>
                    </div>
                    <CardDescription>
                        Upload a QR code for mobile payments (KPay, Wave, PromptPay, etc.)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleQRUpload}
                            className="hidden"
                            id="qr-upload"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingQR}
                            className="flex-1"
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            {isUploadingQR ? 'Uploading...' : 'Upload QR Code'}
                        </Button>
                    </div>

                    {qrUploadSuccess && (
                        <div className="text-green-600 text-sm">
                            ✓ QR Code updated successfully
                        </div>
                    )}

                    {formData.mobilePaymentQrUrl && (
                        <div className="border rounded-lg p-4 bg-white">
                            <p className="text-sm text-muted-foreground mb-2">Current QR:</p>
                            <img
                                src={formData.mobilePaymentQrUrl}
                                alt="Payment QR"
                                className="max-w-[200px] mx-auto"
                            />
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                        Upload a PNG or JPG image containing your mobile payment QR code.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
