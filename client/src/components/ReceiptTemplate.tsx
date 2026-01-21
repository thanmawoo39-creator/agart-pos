import React, { forwardRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessMode } from '@/contexts/BusinessModeContext';
import { API_BASE_URL } from '@/lib/api-config';
import { useCurrency } from '@/hooks/use-currency';

// STRICT BUSINESS UNIT ISOLATION: Restaurant = Myanmar translations, Grocery = English
const RESTAURANT_BUSINESS_UNIT_ID = '2';

interface StoreSettings {
  location?: string;
  phone?: string;
  taxId?: string;
  logoUrl?: string;
}

interface ReceiptTemplateProps {
  cartItems: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  total: number;
  discount: number;
  paymentMethod: string;
  date: string;
  orderId: string;
  amountGiven?: number;
  change?: number;
}

export const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptTemplateProps>(({
  cartItems,
  total,
  discount,
  paymentMethod,
  date,
  orderId,
  amountGiven,
  change
}, ref) => {
  const { t } = useTranslation();
  const { businessUnit } = useBusinessMode();
  const { formatCurrency } = useCurrency();
  const [storeInfo, setStoreInfo] = useState<{ name: string; settings?: StoreSettings } | null>(null);

  // STRICT BUSINESS UNIT ISOLATION: Use Myanmar translations for Restaurant, English for Grocery
  const isRestaurant = businessUnit === RESTAURANT_BUSINESS_UNIT_ID;

  useEffect(() => {
    const fetchStoreInfo = async () => {
      if (!businessUnit) return;

      try {
        // Fetch all business units and find the current one
        const response = await fetch(`${API_BASE_URL}/api/business-units`);
        if (response.ok) {
          const businessUnits = await response.json();
          const currentStore = businessUnits.find((unit: any) => unit.id === businessUnit);

          if (currentStore) {
            const settings = currentStore.settings ? JSON.parse(currentStore.settings) : {};
            setStoreInfo({
              name: currentStore.name,
              settings: settings
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch store info:', error);
      }
    };

    fetchStoreInfo();
  }, [businessUnit]);

  const storeName = storeInfo?.name || 'Agart POS';
  const storeLocation = storeInfo?.settings?.location || 'Yangon, Myanmar';
  const storePhone = storeInfo?.settings?.phone || '';
  const storeTaxId = storeInfo?.settings?.taxId || '';
  const storeLogoUrl = storeInfo?.settings?.logoUrl || '';

  return (
    <div ref={ref} className="receipt-print p-4 bg-white text-black" style={{ width: '58mm', fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="text-center mb-4">
        {storeLogoUrl ? (
          <img
            src={storeLogoUrl}
            alt={`${storeName} Logo`}
            className="h-12 mx-auto mb-2 object-contain"
            onError={(e) => {
              // Fallback to text if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const titleElement = target.parentElement?.querySelector('h1');
              if (titleElement) {
                (titleElement as HTMLElement).style.display = 'block';
              }
            }}
          />
        ) : null}
        <h1 className="text-lg font-bold" style={{ display: storeLogoUrl ? 'none' : 'block' }}>
          {storeName}
        </h1>
        <p className="text-xs">{storeLocation}</p>
        {storePhone && <p className="text-xs">Tel: {storePhone}</p>}
        {storeTaxId && <p className="text-xs">Tax ID: {storeTaxId}</p>}
      </div>

      {/* Order Info */}
      <div className="mb-4 text-xs">
        <div className="flex justify-between mb-1">
          <span>Date: {new Date(date).toLocaleDateString()}</span>
          <span>Time: {new Date(date).toLocaleTimeString()}</span>
        </div>
        <div className="text-center">
          Order ID: #{orderId}
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-b border-dashed border-gray-400 my-2"></div>

      {/* Items List */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold mb-2">{isRestaurant ? t('receipt.items') : 'Items'}</h2>
        {cartItems.map((item, index) => (
          <div key={index} className="flex justify-between text-xs mb-1">
            <span>{item.name}</span>
            <span>{item.quantity} x {formatCurrency(Number(item.price) || 0)}</span>
          </div>
        ))}
      </div>

      {/* Separator */}
      <div className="border-t border-b border-dashed border-gray-400 my-2"></div>

      {/* Total */}
      <div className="text-right mb-4">
        <div className="text-sm">
          <div className="flex justify-between mb-1">
            <span>{isRestaurant ? t('receipt.subtotal') : 'Subtotal'}:</span>
            <span>{formatCurrency((Number(total) || 0) + (Number(discount) || 0))}</span>
          </div>
          {(discount || 0) > 0 && (
            <div className="flex justify-between mb-1">
              <span>{isRestaurant ? 'လျှော့စျေး' : 'Discount'}:</span>
              <span>-{formatCurrency(Number(discount) || 0)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>{isRestaurant ? t('receipt.grandTotal') : 'Total'}:</span>
            <span>{formatCurrency(Number(total) || 0)}</span>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="mb-4 text-xs">
        <div className="flex justify-between">
          <span>{isRestaurant ? t('receipt.payment') : 'Payment'}:</span>
          <span>{isRestaurant ? t(`receipt.${paymentMethod}`) : paymentMethod}</span>
        </div>
        {paymentMethod === 'cash' && amountGiven !== undefined && amountGiven > 0 && (
          <>
            <div className="flex justify-between mt-1">
              <span>{isRestaurant ? t('receipt.amountGiven') : 'Amount Given'}:</span>
              <span>{formatCurrency(Number(amountGiven) || 0)}</span>
            </div>
            {change !== undefined && change > 0 && (
              <div className="flex justify-between mt-1 font-bold">
                <span>{isRestaurant ? t('receipt.change') : 'Change'}:</span>
                <span>{formatCurrency(Number(change) || 0)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-b border-dashed border-gray-400 my-2"></div>

      {/* Footer */}
      <div className="text-center text-xs mt-4">
        <p>{isRestaurant ? t('receipt.thankYou') : 'Thank you for your purchase!'}</p>
        <p className="mt-1">{isRestaurant ? t('receipt.comeAgain') : 'Please come again'}</p>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .receipt-print,
          .receipt-print * {
            visibility: visible;
          }
          .receipt-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
});

ReceiptTemplate.displayName = 'ReceiptTemplate';

export default ReceiptTemplate;
