import { useQuery } from "@tanstack/react-query";
import { formatCurrency as formatCurrencyUtil, type CurrencySettings, DEFAULT_CURRENCY } from "@/lib/utils";
import type { AppSettings } from "@shared/schema";

/**
 * Hook to fetch and use currency settings from app settings
 * Provides currency formatting function and current settings
 */
export function useCurrency() {
  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const currencySettings: CurrencySettings = settings
    ? {
        currencyCode: settings.currencyCode,
        currencySymbol: settings.currencySymbol,
        currencyPosition: settings.currencyPosition,
      }
    : DEFAULT_CURRENCY;

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, currencySettings);
  };

  return {
    formatCurrency,
    currencySettings,
    isLoading: !settings,
  };
}
