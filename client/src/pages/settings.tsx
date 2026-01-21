import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Link } from "wouter";
import { Settings, Store, CreditCard, Truck, Cpu, DollarSign, Save, ShoppingCart } from "lucide-react";
import type { AppSettings } from "@shared/schema";
import { GeneralSettings, PaymentSettings, OrderingSettings, DeliverySettings, SystemSettings } from "@/components/admin/settings";

export default function SettingsPage() {
  const { toast } = useToast();
  const { isOwner } = useAuth();
  const [formData, setFormData] = useState<Partial<AppSettings>>({});

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
        currencyCode: settings.currencyCode || "THB",
        currencySymbol: settings.currencySymbol || "฿",
        currencyPosition: settings.currencyPosition || "before",
        riderPin: settings.riderPin || "8888",
        mobilePaymentQrUrl: settings.mobilePaymentQrUrl || "",
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<AppSettings>) =>
      apiRequest("PATCH", "/api/settings", data).then((res) => res.json()),
    onSuccess: (updated: AppSettings) => {
      queryClient.setQueryData(["/api/settings"], updated);
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/public"] });
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Settings save error:", error);
      toast({
        title: "Failed to save settings",
        description: error?.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="w-6 h-6" />
        <h1 className="text-2xl font-semibold">App Settings</h1>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/settings/catering-pricing">
          <Card className="cursor-pointer hover:bg-slate-50 transition-colors border-orange-200 shadow-sm hover:shadow-md h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-700">
                Catering Pricing
              </CardTitle>
              <DollarSign className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Manage Prices</div>
              <p className="text-xs text-muted-foreground mt-1">
                Set base prices for catering sets and addons
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Settings Form with Tabs */}
      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Payment</span>
            </TabsTrigger>
            <TabsTrigger value="ordering" className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Ordering</span>
            </TabsTrigger>
            <TabsTrigger value="delivery" className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              <span className="hidden sm:inline">Delivery</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              <span className="hidden sm:inline">System</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <GeneralSettings formData={formData} setFormData={setFormData} />
          </TabsContent>

          <TabsContent value="payment">
            <PaymentSettings formData={formData} setFormData={setFormData} />
          </TabsContent>

          <TabsContent value="ordering">
            <OrderingSettings />
          </TabsContent>

          <TabsContent value="delivery">
            <DeliverySettings formData={formData} setFormData={setFormData} />
          </TabsContent>

          <TabsContent value="system">
            <SystemSettings formData={formData} setFormData={setFormData} />
          </TabsContent>
        </Tabs>

        {/* Save Button - Always visible */}
        <div className="flex justify-end mt-6 sticky bottom-4">
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="min-w-[140px] shadow-lg"
            size="lg"
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
