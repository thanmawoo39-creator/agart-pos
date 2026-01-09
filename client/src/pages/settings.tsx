import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Settings, Store, Image as ImageIcon, Smartphone, MapPin, Save, Upload, Camera, Download, Database, DollarSign } from "lucide-react";
import type { AppSettings } from "@shared/schema";
import { API_BASE_URL } from "@/lib/api-config";
import { CURRENCIES, formatCurrency } from "@/lib/utils";

export default function SettingsPage() {
  const { toast } = useToast();
  const { isOwner } = useAuth();
  const [formData, setFormData] = useState<Partial<AppSettings>>({});
  const [qrUploadSuccess, setQrUploadSuccess] = useState(false);
  const [isUploadingQR, setIsUploadingQR] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
    enabled: isOwner,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        storeName: settings.storeName || "",
        storeAddress: settings.storeAddress || "",
        storePhone: settings.storePhone || "",
        storeLogoUrl: settings.storeLogoUrl || "",
        aiImageRecognitionEnabled: settings.aiImageRecognitionEnabled || false,
        enableTax: settings.enableTax || false,
        taxPercentage: settings.taxPercentage || 0,
        enableLocalAi: settings.enableLocalAi || false,
        localAiUrl: settings.localAiUrl || "",
        geminiApiKey: settings.geminiApiKey || "",
        groqApiKey: settings.groqApiKey || "",
        enableMobileScanner: settings.enableMobileScanner ?? true,
        enablePhotoCapture: settings.enablePhotoCapture ?? true,
        currencyCode: settings.currencyCode || "MMK",
        currencySymbol: settings.currencySymbol || "K",
        currencyPosition: settings.currencyPosition || "after",
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<AppSettings>) =>
      apiRequest("PATCH", "/api/settings", data).then((res) => res.json()),
    onSuccess: (updated: AppSettings) => {
      // Update cache and invalidate to force refetch
      queryClient.setQueryData(["/api/settings"], updated);
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Settings save error:", error);
      
      let errorMessage = "Failed to save settings";
      
      if (error?.details && Array.isArray(error.details)) {
        // Handle Zod validation errors
        const validationErrors = error.details.map((detail: any) => 
          `${detail.path?.join('.') || 'Field'}: ${detail.message}`
        ).join(', ');
        errorMessage = `Validation errors: ${validationErrors}`;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Failed to save settings",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleQRUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
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
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/settings/upload-qr`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setQrUploadSuccess(true);
        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        // Hide success message after 3 seconds
        setTimeout(() => setQrUploadSuccess(false), 3000);
        toast({
          title: "QR Code Updated",
          description: "Mobile payment QR code has been updated successfully.",
        });
      } else {
        throw new Error('Failed to upload QR code');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert empty string URL to null for proper validation
    const submitData = {
      ...formData,
      storeLogoUrl: formData.storeLogoUrl?.trim() || null,
    };
    
    updateMutation.mutate(submitData);
  };

  if (!isOwner) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to access settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Loading settings...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="w-6 h-6" />
        <h1 className="text-2xl font-semibold">App Settings</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Store Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              <CardTitle>Store Information</CardTitle>
            </div>
            <CardDescription>
              Manage your store's basic information displayed throughout the system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">
                Store Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="storeName"
                value={formData.storeName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, storeName: e.target.value })
                }
                placeholder="My Store"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeAddress">
                <MapPin className="w-4 h-4 inline mr-1" />
                Address
              </Label>
              <Input
                id="storeAddress"
                value={formData.storeAddress || ""}
                onChange={(e) =>
                  setFormData({ ...formData, storeAddress: e.target.value })
                }
                placeholder="123 Main Street, City, State ZIP"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storePhone">
                <Smartphone className="w-4 h-4 inline mr-1" />
                Phone
              </Label>
              <Input
                id="storePhone"
                type="tel"
                value={formData.storePhone || ""}
                onChange={(e) =>
                  setFormData({ ...formData, storePhone: e.target.value })
                }
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeLogoUrl">
                <ImageIcon className="w-4 h-4 inline mr-1" />
                Logo URL
              </Label>
              <Input
                id="storeLogoUrl"
                type="url"
                value={formData.storeLogoUrl || ""}
                onChange={(e) =>
                  setFormData({ ...formData, storeLogoUrl: e.target.value || null })
                }
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-muted-foreground">
                Enter a URL to your store logo image. This will be displayed in receipts and reports.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Currency Settings */}
        <Card>
          <CardHeader>
            <CardTitle>
              <DollarSign className="w-5 h-5 inline mr-2" />
              Currency Settings
            </CardTitle>
            <CardDescription>
              Configure how prices are displayed throughout the system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currencyCode">Currency</Label>
              <Select
                value={formData.currencyCode}
                onValueChange={(value) => {
                  const selectedCurrency = CURRENCIES.find(c => c.code === value);
                  if (selectedCurrency) {
                    setFormData({
                      ...formData,
                      currencyCode: selectedCurrency.code,
                      currencySymbol: selectedCurrency.symbol,
                      currencyPosition: selectedCurrency.position,
                    });
                  }
                }}
              >
                <SelectTrigger id="currencyCode">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose your preferred currency for price display
              </p>
            </div>

            {/* Preview */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <Label className="text-sm font-medium">Preview</Label>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Small amount:</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(150, {
                      currencyCode: formData.currencyCode || "MMK",
                      currencySymbol: formData.currencySymbol || "K",
                      currencyPosition: formData.currencyPosition || "after",
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Medium amount:</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(1500, {
                      currencyCode: formData.currencyCode || "MMK",
                      currencySymbol: formData.currencySymbol || "K",
                      currencyPosition: formData.currencyPosition || "after",
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Large amount:</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(150000, {
                      currencyCode: formData.currencyCode || "MMK",
                      currencySymbol: formData.currencySymbol || "K",
                      currencyPosition: formData.currencyPosition || "after",
                    })}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                This is how prices will appear in sales, reports, and throughout the system.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* AI Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>AI Configuration</CardTitle>
            <CardDescription>
              Control AI-powered features in your POS system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="aiImageRecognition" className="text-base">
                  AI Image Recognition
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable AI-powered product identification from images. When enabled, the system can
                  identify products like bananas from photos. Disable this if you're experiencing
                  incorrect identifications.
                </p>
              </div>
              <Switch
                id="aiImageRecognition"
                checked={formData.aiImageRecognitionEnabled || false}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, aiImageRecognitionEnabled: checked })
                }
              />
            </div>
            {formData.aiImageRecognitionEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="geminiApiKey">
                    Gemini API Key (Primary)
                  </Label>
                  <Input
                    id="geminiApiKey"
                    type="password"
                    value={formData.geminiApiKey || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, geminiApiKey: e.target.value })
                    }
                    placeholder="Enter your Gemini API Key (starts with AIza...)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Primary AI service for image recognition and business insights.
                  </p>
                </div>

                <div className="border-t my-4" />

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="enableLocalAi" className="text-base">
                        Enable Local AI Fallback
                        </Label>
                        <p className="text-sm text-muted-foreground">
                        Use a local AI model (Ollama) for cost-effective recognition, with Gemini as a backup.
                        </p>
                    </div>
                    <Switch
                        id="enableLocalAi"
                        checked={formData.enableLocalAi || false}
                        onCheckedChange={(checked) =>
                        setFormData({ ...formData, enableLocalAi: checked })
                        }
                    />
                </div>

                {formData.enableLocalAi && (
                    <div className="space-y-2">
                        <Label htmlFor="localAiUrl">
                        Local AI Endpoint URL
                        </Label>
                        <Input
                        id="localAiUrl"
                        type="url"
                        value={formData.localAiUrl || ""}
                        onChange={(e) =>
                            setFormData({ ...formData, localAiUrl: e.target.value })
                        }
                        placeholder="http://localhost:11434"
                        />
                        <p className="text-xs text-muted-foreground">
                        The endpoint for your locally running Ollama service.
                        </p>
                    </div>
                )}

                <div className="border-t my-4" />

                <div className="space-y-2">
                  <Label htmlFor="groqApiKey">
                    Groq API Key (Failover)
                  </Label>
                  <Input
                    id="groqApiKey"
                    type="password"
                    value={formData.groqApiKey || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, groqApiKey: e.target.value })
                    }
                    placeholder="Enter your Groq API Key (starts with gsk_...)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Backup AI service used when Gemini is unavailable or rate-limited.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tax Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Configuration</CardTitle>
            <CardDescription>
              Configure tax settings for your sales transactions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enableTax" className="text-base">
                  Enable Tax
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable tax calculation on sales transactions. When enabled, tax will be
                  calculated and displayed in the cart.
                </p>
              </div>
              <Switch
                id="enableTax"
                checked={formData.enableTax || false}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enableTax: checked })
                }
              />
            </div>
            {formData.enableTax && (
              <div className="space-y-2">
                <Label htmlFor="taxPercentage">
                  Tax Percentage (%)
                </Label>
                <Input
                  id="taxPercentage"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.taxPercentage || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, taxPercentage: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="10.0"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the tax percentage to apply to sales. For example, enter 10 for 10% tax.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hardware & Camera Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              <CardTitle>Hardware & Camera</CardTitle>
            </div>
            <CardDescription>
              Control mobile camera features and hardware integrations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enableMobileScanner" className="text-base">
                  Enable Mobile Camera Scanner
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allows scanning product barcodes using the mobile device camera.
                  Disable if you don't need barcode scanning or want to save battery.
                </p>
              </div>
              <Switch
                id="enableMobileScanner"
                checked={formData.enableMobileScanner ?? true}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enableMobileScanner: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enablePhotoCapture" className="text-base">
                  Enable Photo Capture
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allows taking photos for products, customers, and payment verification.
                  Disable to prevent camera access for privacy or security reasons.
                </p>
              </div>
              <Switch
                id="enablePhotoCapture"
                checked={formData.enablePhotoCapture ?? true}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enablePhotoCapture: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* QR Code Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              <CardTitle>Mobile Payment QR Code</CardTitle>
            </div>
            <CardDescription>
              Upload a new QR code for mobile payments. This QR code will be displayed to customers when they select mobile payment.
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
                {isUploadingQR ? 'Uploading...' : 'Update QR Code'}
              </Button>
            </div>
            
            {qrUploadSuccess && (
              <div className="text-green-600 text-sm">
                ✓ QR Code updated successfully
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Upload a PNG or JPG image containing your mobile payment QR code. The image will be saved as kpay_qr.png and overwrite any existing QR code.
            </p>
          </CardContent>
        </Card>

        {/* System Maintenance */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              <CardTitle>System Maintenance</CardTitle>
            </div>
            <CardDescription>
              Backup and restore your database. Only administrators can access these features.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    const response = await fetch('/api/admin/backup');
                    if (response.ok) {
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `POS_Backup_${new Date().toISOString().split('T')[0]}.db`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                      toast({
                        title: "Backup Downloaded",
                        description: "Database backup has been downloaded successfully",
                      });
                    } else {
                      throw new Error('Failed to download backup');
                    }
                  } catch (error) {
                    toast({
                      title: "Backup Failed",
                      description: "Failed to download database backup",
                      variant: "destructive",
                    });
                  }
                }}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Database Backup
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="min-w-[120px]"
          >
            {updateMutation.isPending ? (
              "Saving..."
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

