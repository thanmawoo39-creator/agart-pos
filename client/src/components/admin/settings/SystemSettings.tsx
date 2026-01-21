import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Camera, Printer, AlertCircle, Database, HeartPulse, AlertTriangle, Loader2, Sparkles, Stethoscope, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/api-config";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { AppSettings } from "@shared/schema";

interface SystemSettingsProps {
    formData: Partial<AppSettings>;
    setFormData: (data: Partial<AppSettings>) => void;
}

interface AIDiagnosis {
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    fix: string;
}

export function SystemSettings({ formData, setFormData }: SystemSettingsProps) {
    const { toast } = useToast();
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiDiagnosis, setAiDiagnosis] = useState<AIDiagnosis | null>(null);

    // Factory Reset State
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetInput, setResetInput] = useState("");

    const factoryResetMutation = useMutation({
        mutationFn: () => apiRequest("POST", "/api/admin/factory-reset"),
        onSuccess: () => {
            toast({
                title: "🏭 System Reset Successful",
                description: "All data has been wiped. Reloading...",
                variant: "destructive"
            });
            setShowResetModal(false);
            // Force reload to clear all frontend state/cache
            setTimeout(() => {
                window.location.href = "/";
            }, 1000);
        },
        onError: (error: any) => {
            toast({
                title: "Reset Failed",
                description: error.message || "Could not reset system",
                variant: "destructive"
            });
        }
    });

    const handleFactoryReset = () => {
        if (resetInput !== "DELETE") return;
        factoryResetMutation.mutate();
    };

    const handleHealthCheck = async () => {
        setIsCheckingHealth(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/db/health`);
            const result = await res.json();

            if (result.healthy) {
                toast({
                    title: "✅ System Healthy",
                    description: `Database connected (Latency: ${result.latency})`,
                });
            } else {
                toast({
                    title: "❌ Database Connection Failed",
                    variant: "destructive",
                    description: result.issues?.join(', ') || result.error || "Unknown issues"
                });
            }
        } catch (error) {
            toast({
                title: "❌ Database Connection Failed",
                variant: "destructive",
                description: "Could not reach the server"
            });
        } finally {
            setIsCheckingHealth(false);
        }
    };

    const handleAIDiagnosis = async () => {
        setIsAnalyzing(true);
        setAiDiagnosis(null);

        try {
            // Collect system metrics
            const pageLoadTime = performance.timing
                ? performance.timing.loadEventEnd - performance.timing.navigationStart
                : 0;

            // Estimate localStorage usage
            let localStorageUsedMB = 0;
            let localStorageQuotaMB = 5; // Default 5MB quota
            try {
                let total = 0;
                for (const key in localStorage) {
                    if (localStorage.hasOwnProperty(key)) {
                        total += localStorage.getItem(key)?.length || 0;
                    }
                }
                localStorageUsedMB = parseFloat((total / (1024 * 1024)).toFixed(2));
            } catch (e) {
                // Storage access error
            }

            const systemLogs = {
                isOnline: navigator.onLine,
                localStorageUsedMB,
                localStorageQuotaMB,
                pageLoadTimeMs: pageLoadTime > 0 ? pageLoadTime : 500,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
                errors: [],
            };

            const res = await fetch(`${API_BASE_URL}/api/gemini/system-doctor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemLogs }),
            });

            const diagnosis = await res.json();
            setAiDiagnosis(diagnosis);

            // Also show toast based on status
            if (diagnosis.status === 'healthy') {
                toast({ title: "✅ AI Diagnosis Complete", description: "System is healthy!" });
            } else if (diagnosis.status === 'warning') {
                toast({ title: "⚠️ AI Diagnosis Complete", description: "Some issues detected." });
            } else {
                toast({ title: "❌ AI Diagnosis Complete", variant: "destructive", description: "Critical issues found!" });
            }
        } catch (error) {
            toast({
                title: "❌ AI Diagnosis Failed",
                variant: "destructive",
                description: "Could not analyze system. Check if AI API Key is configured."
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'bg-green-100 border-green-500 text-green-800';
            case 'warning': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
            case 'critical': return 'bg-red-100 border-red-500 text-red-800';
            default: return 'bg-gray-100 border-gray-500 text-gray-800';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'healthy': return '🟢 Healthy';
            case 'warning': return '🟡 Warning';
            case 'critical': return '🔴 Critical';
            default: return '⚪ Unknown';
        }
    };

    return (
        <div className="space-y-6">
            {/* Hardware & Camera */}
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
                            </p>
                        </div>
                        <Switch
                            id="enableMobileScanner"
                            checked={formData.enableMobileScanner ?? true}
                            onCheckedChange={(checked) => setFormData({ ...formData, enableMobileScanner: checked })}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="enablePhotoCapture" className="text-base">
                                Enable Photo Capture
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Allows taking photos for products and payment verification.
                            </p>
                        </div>
                        <Switch
                            id="enablePhotoCapture"
                            checked={formData.enablePhotoCapture ?? true}
                            onCheckedChange={(checked) => setFormData({ ...formData, enablePhotoCapture: checked })}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Printer Configuration */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Printer className="w-5 h-5" />
                        <CardTitle>Printer Configuration</CardTitle>
                    </div>
                    <CardDescription>
                        Configure thermal printers for Kitchen Orders and Receipts.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="kitchenPrinterIp">Kitchen Printer IP (KOT)</Label>
                        <div className="flex gap-2">
                            <Input
                                id="kitchenPrinterIp"
                                placeholder="192.168.1.100"
                                defaultValue={localStorage.getItem('kitchenPrinterIp') || '192.168.1.100'}
                                onChange={(e) => {
                                    localStorage.setItem('kitchenPrinterIp', e.target.value);
                                    toast({ title: "Saved", description: "Kitchen Printer IP updated." });
                                }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    toast({ title: "Test Sent", description: "Test print command sent." });
                                }}
                            >
                                Test
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="receiptPrinterIp">Receipt Printer IP</Label>
                        <div className="flex gap-2">
                            <Input
                                id="receiptPrinterIp"
                                placeholder="192.168.1.101"
                                defaultValue={localStorage.getItem('receiptPrinterIp') || '192.168.1.101'}
                                onChange={(e) => {
                                    localStorage.setItem('receiptPrinterIp', e.target.value);
                                    toast({ title: "Saved", description: "Receipt Printer IP updated." });
                                }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    toast({ title: "Test Sent", description: "Test print command sent." });
                                }}
                            >
                                Test
                            </Button>
                        </div>
                    </div>

                    <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
                        <p className="text-xs text-yellow-800 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Printers must be on the same local network as the server.
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
                                Enable AI-powered product identification from images.
                            </p>
                        </div>
                        <Switch
                            id="aiImageRecognition"
                            checked={formData.aiImageRecognitionEnabled || false}
                            onCheckedChange={(checked) => setFormData({ ...formData, aiImageRecognitionEnabled: checked })}
                        />
                    </div>

                    {formData.aiImageRecognitionEnabled && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="geminiApiKey">Gemini API Key</Label>
                                <Input
                                    id="geminiApiKey"
                                    type="password"
                                    value={formData.geminiApiKey || ""}
                                    onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
                                    placeholder="AIza..."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="groqApiKey">Groq API Key (Fallback)</Label>
                                <Input
                                    id="groqApiKey"
                                    type="password"
                                    value={formData.groqApiKey || ""}
                                    onChange={(e) => setFormData({ ...formData, groqApiKey: e.target.value })}
                                    placeholder="gsk_..."
                                />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Smart Diagnostics Panel */}
            <Card className="border-purple-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Stethoscope className="w-5 h-5 text-purple-600" />
                        <CardTitle className="text-purple-700">Smart Diagnostics</CardTitle>
                    </div>
                    <CardDescription>
                        AI-powered system health analysis with Burmese language support.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2 flex-wrap">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isCheckingHealth}
                            onClick={handleHealthCheck}
                        >
                            {isCheckingHealth ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <HeartPulse className="w-4 h-4 mr-2" />
                            )}
                            {isCheckingHealth ? "Checking..." : "Quick Check"}
                        </Button>

                        <Button
                            type="button"
                            disabled={isAnalyzing}
                            onClick={handleAIDiagnosis}
                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        >
                            {isAnalyzing ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4 mr-2" />
                            )}
                            {isAnalyzing ? "Analyzing..." : "Run AI Diagnosis"}
                        </Button>
                    </div>

                    {/* AI Diagnosis Result Card */}
                    {aiDiagnosis && (
                        <div className={`p-4 rounded-lg border-l-4 ${getStatusColor(aiDiagnosis.status)}`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-lg">{getStatusBadge(aiDiagnosis.status)}</span>
                                <span className="text-xs opacity-70">AI System Doctor</span>
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <p className="text-sm font-medium opacity-70">ရှင်းလင်းချက် (Message):</p>
                                    <p className="text-sm">{aiDiagnosis.message}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium opacity-70">ပြုပြင်နည်း (Fix):</p>
                                    <p className="text-sm font-mono bg-white/50 p-2 rounded">{aiDiagnosis.fix}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-purple-50 p-3 rounded-md border border-purple-200">
                        <p className="text-xs text-purple-800 flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            AI diagnosis requires a configured Gemini or Groq API key.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Database Tools (Legacy) */}
            <Card className="border-red-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-red-600" />
                        <CardTitle className="text-red-700">Database Tools</CardTitle>
                    </div>
                    <CardDescription>
                        Advanced database operations. Use with caution.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2 flex-wrap">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isCheckingHealth}
                            onClick={handleHealthCheck}
                        >
                            {isCheckingHealth ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Database className="w-4 h-4 mr-2" />
                            )}
                            {isCheckingHealth ? "Checking..." : "Check DB Connection"}
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            className="hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                            onClick={() => {
                                try {
                                    localStorage.clear();
                                    sessionStorage.clear();
                                    toast({
                                        title: "✅ Cache Cleared",
                                        description: "Local storage and session storage have been cleared."
                                    });
                                } catch (error) {
                                    toast({
                                        title: "❌ Failed to Clear Cache",
                                        variant: "destructive",
                                        description: "Could not clear browser cache."
                                    });
                                }
                            }}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Clear System Cache
                        </Button>
                    </div>

                    <div className="bg-red-50 p-3 rounded-md border border-red-200">
                        <p className="text-xs text-red-800 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Database operations cannot be undone. Use with caution.
                        </p>
                    </div>
                </CardContent>
            </Card>


            {/* Danger Zone - Factory Reset */}
            <Card className="border-red-500 bg-red-50/10">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <CardTitle className="text-red-700">Danger Zone</CardTitle>
                    </div>
                    <CardDescription className="text-red-600/80">
                        Irreversible system actions. Proceed with extreme caution.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-white">
                        <div className="space-y-1">
                            <h4 className="text-base font-medium text-red-900">Factory Reset</h4>
                            <p className="text-sm text-red-600/80">
                                Wipes ALL orders, customers, inventory history, and sales data. <br />
                                <strong>Does not delete the Admin account.</strong>
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                setResetInput("");
                                setShowResetModal(true);
                            }}
                        >
                            Reset System Data
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Factory Reset Confirmation Modal */}
            <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
                <DialogContent className="border-red-500 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-red-700 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Confirm Factory Reset
                        </DialogTitle>
                        <DialogDescription className="text-red-600/90 font-medium pt-2">
                            This action cannot be undone. This will permanently delete your database records.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="reset-confirm" className="text-sm font-semibold">
                                Type "DELETE" to confirm
                            </Label>
                            <Input
                                id="reset-confirm"
                                value={resetInput}
                                onChange={(e) => setResetInput(e.target.value)}
                                placeholder="DELETE"
                                className="border-red-300 focus-visible:ring-red-500"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowResetModal(false)}
                            disabled={factoryResetMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleFactoryReset}
                            disabled={resetInput !== "DELETE" || factoryResetMutation.isPending}
                        >
                            {factoryResetMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Wiping Data...
                                </>
                            ) : (
                                "Yes, Wipe Everything"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}


