/**
 * Centralized Order Service
 * Unified order creation logic for all order sources (QR, POS, Delivery)
 */

import type { InsertSale } from '@shared/schema';
import type { CartItem } from '@shared/schema';

export interface CreateOrderParams {
    // Order source and payment
    orderSource: 'qr' | 'pos' | 'delivery';
    paymentStatus?: 'unpaid' | 'pending_verification' | 'paid';
    paymentMethod: string; // 'cash', 'card', 'credit', 'mobile'

    // Order details
    items: CartItem[];
    totalAmount: number;
    businessUnitId: string;

    // Optional customer/staff info
    customerId?: string;
    staffId?: string;
    customerName?: string;
    customerPhone?: string;

    // Delivery-specific
    orderType?: 'dine-in' | 'delivery';
    tableNumber?: string;
    deliveryAddress?: string;
    requestedDeliveryTime?: string;

    // Payment proof
    paymentSlipUrl?: string;
    paymentProofUrl?: string;
}

export interface CreateOrderResult {
    sale: any; // Sale record from database
    receiptNumber: string;
    kitchenTickets: any[]; // Kitchen tickets created
}

/**
 * Create a new order with unified logic
 * Handles validation, database insertion, and kitchen ticket creation
 */
export async function createOrder(
    params: CreateOrderParams,
    storage: any
): Promise<CreateOrderResult> {
    const {
        orderSource,
        paymentStatus = 'paid',
        paymentMethod,
        items,
        totalAmount,
        businessUnitId,
        customerId,
        staffId,
        customerName,
        customerPhone,
        orderType,
        tableNumber,
        deliveryAddress,
        requestedDeliveryTime,
        paymentSlipUrl,
        paymentProofUrl,
    } = params;

    // Validate required fields
    if (!items || items.length === 0) {
        throw new Error('Order must contain at least one item');
    }

    if (!businessUnitId) {
        throw new Error('Business unit ID is required');
    }

    // Generate unique receipt number
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const receiptNumber = `ORD-${timestamp}-${random}`;

    // Prepare sale data
    const saleData: any = {
        receiptNumber,
        totalAmount,
        paymentMethod,
        customerId: customerId || undefined,
        staffId: staffId || undefined,
        businessUnitId,

        // New standardized fields
        paymentStatus,
        orderSource,

        // Delivery/table fields
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        deliveryAddress: deliveryAddress || undefined,
        orderType: orderType || undefined,
        tableNumber: tableNumber || undefined,
        requestedDeliveryTime: requestedDeliveryTime || undefined,
        paymentProofUrl: paymentProofUrl || undefined,
        paymentSlipUrl: paymentSlipUrl || undefined,

        status: 'pending',
    };

    // Create sale in database
    const sale = await storage.createSale(saleData);

    // Create sale items
    for (const item of items) {
        await storage.createSaleItem({
            saleId: sale.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            categoryId: item.categoryId,
        });
    }

    // Create kitchen tickets for dine-in and QR orders
    const kitchenTickets: any[] = [];
    if (orderSource === 'qr' || orderSource === 'pos') {
        // Group items by category for kitchen tickets
        const itemsByCategory = items.reduce((acc, item) => {
            const categoryId = item.categoryId || 'uncategorized';
            if (!acc[categoryId]) {
                acc[categoryId] = [];
            }
            acc[categoryId].push(item);
            return acc;
        }, {} as Record<string, CartItem[]>);

        // Create a ticket for each category
        for (const [categoryId, categoryItems] of Object.entries(itemsByCategory)) {
            const ticket = await storage.createKitchenTicket({
                saleId: sale.id,
                tableNumber: tableNumber || 'Takeaway',
                items: categoryItems.map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.quantity,
                    notes: item.notes || '',
                })),
                status: 'pending',
                businessUnitId,
            });
            kitchenTickets.push(ticket);
        }
    }

    return {
        sale,
        receiptNumber,
        kitchenTickets,
    };
}

/**
 * Validate order items before creation
 */
export function validateOrderItems(items: CartItem[]): { valid: boolean; error?: string } {
    if (!items || items.length === 0) {
        return { valid: false, error: 'Order must contain at least one item' };
    }

    for (const item of items) {
        if (!item.productId || !item.productName) {
            return { valid: false, error: 'Invalid item: missing product ID or name' };
        }

        if (item.quantity <= 0) {
            return { valid: false, error: `Invalid quantity for ${item.productName}` };
        }

        if (item.unitPrice < 0) {
            return { valid: false, error: `Invalid price for ${item.productName}` };
        }
    }

    return { valid: true };
}
