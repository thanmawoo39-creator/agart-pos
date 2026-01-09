import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Clean Architecture: Image URL Utility
 * Constructs full image URLs with proper backend URL prepending
 */

import { API_BASE_URL } from '@/lib/api-config';

/**
 * Constructs a full image URL from a relative or absolute path
 * @param url - The image URL (can be null, undefined, relative, or absolute)
 * @returns Full URL or null if input is invalid
 */
export function getImageUrl(url: string | null | undefined): string | null {
  if (!url) {
    console.log('🖼️ No URL provided, returning null');
    return null;
  }
  
  if (url.startsWith('http')) {
    console.log('🖼️ URL is already full HTTP URL:', url);
    return url;
  }
  
  const finalUrl = `${API_BASE_URL}${url.startsWith('/') ? url : '/' + url}`;
  console.log('🖼️ Constructed full URL:', finalUrl);
  return finalUrl;
}

/**
 * Gets image props for React img elements with CORS compliance
 * @param url - The image URL
 * @returns Props object with src, crossOrigin, and alt
 */
export function getImageProps(url: string | null | undefined) {
  const imageUrl = getImageUrl(url);
  return {
    src: imageUrl || '',
    crossOrigin: 'anonymous' as const,
    alt: 'Product image'
  };
}

/**
 * Currency Formatting Utilities
 * Formats numbers as currency based on app settings
 */

export interface CurrencySettings {
  currencyCode: string;
  currencySymbol: string;
  currencyPosition: 'before' | 'after';
}

// Default currency settings (Myanmar Kyat)
export const DEFAULT_CURRENCY: CurrencySettings = {
  currencyCode: 'MMK',
  currencySymbol: 'K',
  currencyPosition: 'after'
};

// Common currencies with their configurations
export const CURRENCIES = [
  { code: 'MMK', symbol: 'K', name: 'Myanmar Kyat (K)', position: 'after' as const, example: '1,000 K' },
  { code: 'USD', symbol: '$', name: 'US Dollar ($)', position: 'before' as const, example: '$1,000' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht (฿)', position: 'before' as const, example: '฿1,000' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar (S$)', position: 'before' as const, example: 'S$1,000' },
  { code: 'EUR', symbol: '€', name: 'Euro (€)', position: 'before' as const, example: '€1,000' },
  { code: 'GBP', symbol: '£', name: 'British Pound (£)', position: 'before' as const, example: '£1,000' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)', position: 'before' as const, example: '¥1,000' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan (¥)', position: 'before' as const, example: '¥1,000' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)', position: 'before' as const, example: '₹1,000' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong (₫)', position: 'after' as const, example: '1,000 ₫' },
] as const;

/**
 * Format a number as currency based on settings
 * @param amount - The number to format
 * @param settings - Currency settings (optional, uses defaults if not provided)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, settings?: CurrencySettings): string {
  const config = settings || DEFAULT_CURRENCY;

  // Format number with thousand separators
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  // Add currency symbol based on position
  const formattedCurrency = config.currencyPosition === 'before'
    ? `${config.currencySymbol}${formattedNumber}`
    : `${formattedNumber} ${config.currencySymbol}`;

  // Add negative sign if needed
  return amount < 0 ? `-${formattedCurrency}` : formattedCurrency;
}

/**
 * Get currency configuration by code
 * @param code - Currency code (e.g., 'MMK', 'USD')
 * @returns Currency configuration or default
 */
export function getCurrencyByCode(code: string) {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}
