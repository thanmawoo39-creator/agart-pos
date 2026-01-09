import React, { forwardRef } from 'react';

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
  return (
    <div ref={ref} className="receipt-print p-4 bg-white text-black" style={{ width: '58mm', fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-lg font-bold">Agart POS</h1>
        <p className="text-xs">Yangon, Myanmar</p>
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
        <h2 className="text-sm font-semibold mb-2">Items</h2>
        {cartItems.map((item, index) => (
          <div key={index} className="flex justify-between text-xs mb-1">
            <span>{item.name}</span>
            <span>{item.quantity} x ${(item.price || 0).toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Separator */}
      <div className="border-t border-b border-dashed border-gray-400 my-2"></div>

      {/* Total */}
      <div className="text-right mb-4">
        <div className="text-sm">
          <div className="flex justify-between mb-1">
            <span>Subtotal:</span>
            <span>${((total || 0) + (discount || 0)).toFixed(2)}</span>
          </div>
          {(discount || 0) > 0 && (
            <div className="flex justify-between mb-1">
              <span>Discount:</span>
              <span>-${(discount || 0).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>Total:</span>
            <span>${(total || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="mb-4 text-xs">
        <div className="flex justify-between">
          <span>Payment:</span>
          <span>{paymentMethod}</span>
        </div>
        {paymentMethod === 'cash' && amountGiven !== undefined && amountGiven > 0 && (
          <>
            <div className="flex justify-between mt-1">
              <span>Amount Given:</span>
              <span>${amountGiven.toFixed(2)}</span>
            </div>
            {change !== undefined && change > 0 && (
              <div className="flex justify-between mt-1 font-bold">
                <span>Change:</span>
                <span>${change.toFixed(2)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-b border-dashed border-gray-400 my-2"></div>

      {/* Footer */}
      <div className="text-center text-xs mt-4">
        <p>Thank you for your purchase!</p>
        <p className="mt-1">Please come again</p>
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
