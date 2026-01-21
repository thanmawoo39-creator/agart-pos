import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, MapPin, Smartphone, Image as ImageIcon, DollarSign, Globe } from "lucide-react";
import { CURRENCIES, formatCurrency } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { AppSettings } from "@shared/schema";

interface GeneralSettingsProps {
    formData: Partial<AppSettings>;
    setFormData: (data: Partial<AppSettings>) => void;
}

export function GeneralSettings({ formData, setFormData }: GeneralSettingsProps) {
    const { t, i18n } = useTranslation();

    const handleLanguageChange = (language: string) => {
        i18n.changeLanguage(language);
        localStorage.setItem('i18nextLng', language);
    };

    return (
        <div className="space-y-6">
            {/* Language Settings */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        <CardTitle>{t('settings.languageSettings')}</CardTitle>
                    </div>
                    <CardDescription>
                        {t('settings.languageDescription')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="language">{t('settings.selectLanguage')}</Label>
                        <Select
                            value={i18n.language}
                            onValueChange={handleLanguageChange}
                        >
                            <SelectTrigger id="language">
                                <SelectValue placeholder={t('settings.selectLanguage')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="en">
                                    <span className="flex items-center gap-2">
                                        🇺🇸 {t('settings.english')}
                                    </span>
                                </SelectItem>
                                <SelectItem value="my">
                                    <span className="flex items-center gap-2">
                                        🇲🇲 {t('settings.burmese')}
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

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
                            onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
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
                            onChange={(e) => setFormData({ ...formData, storeAddress: e.target.value })}
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
                            onChange={(e) => setFormData({ ...formData, storePhone: e.target.value })}
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
                            onChange={(e) => setFormData({ ...formData, storeLogoUrl: e.target.value || null })}
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
                                        currencyCode: formData.currencyCode || "THB",
                                        currencySymbol: formData.currencySymbol || "฿",
                                        currencyPosition: formData.currencyPosition || "before",
                                    })}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Large amount:</span>
                                <span className="font-mono font-medium">
                                    {formatCurrency(15000, {
                                        currencyCode: formData.currencyCode || "THB",
                                        currencySymbol: formData.currencySymbol || "฿",
                                        currencyPosition: formData.currencyPosition || "before",
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>
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
                                Enable tax calculation on sales transactions.
                            </p>
                        </div>
                        <Switch
                            id="enableTax"
                            checked={formData.enableTax || false}
                            onCheckedChange={(checked) => setFormData({ ...formData, enableTax: checked })}
                        />
                    </div>
                    {formData.enableTax && (
                        <div className="space-y-2">
                            <Label htmlFor="taxPercentage">Tax Percentage (%)</Label>
                            <Input
                                id="taxPercentage"
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={formData.taxPercentage || 0}
                                onChange={(e) => setFormData({ ...formData, taxPercentage: parseFloat(e.target.value) || 0 })}
                                placeholder="10.0"
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
