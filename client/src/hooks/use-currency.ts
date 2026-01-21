import { useQuery } from "@tanstack/react-query";
import { formatCurrency as formatCurrencyUtil, type CurrencySettings, DEFAULT_CURRENCY } from "@/lib/utils";

type PublicCurrencySettings = {
  currencyCode?: string;
  currencySymbol?: string;
  currencyPosition?: 'before' | 'after';
};

/**
 * Hook to fetch and use currency settings from app settings
 * Provides currency formatting function and current settings
 */
export function useCurrency() {
  const { data: settings } = useQuery<PublicCurrencySettings>({
    queryKey: ["/api/settings/public"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const currencySettings: CurrencySettings =
    settings?.currencyCode && settings?.currencySymbol && settings?.currencyPosition
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
    isLoading: settings === undefined,
  };
}
