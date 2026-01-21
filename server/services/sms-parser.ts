/**
 * SMS Transaction Parser
 * Extracts payment information from SMS messages
 */

export interface SMSTransaction {
    amount: number;
    transactionId?: string;
    reference?: string;
    senderName?: string;
    timestamp?: string;
}

/**
 * Parse SMS content to extract transaction details
 * Supports multiple SMS formats from different banks/payment providers
 */
export function parseSMSTransaction(smsContent: string): SMSTransaction | null {
    if (!smsContent) return null;

    const content = smsContent.toLowerCase();
    let amount: number | null = null;
    let transactionId: string | undefined;
    let reference: string | undefined;
    let senderName: string | undefined;

    // Extract amount - try multiple patterns
    const amountPatterns = [
        /amount[:\s]+฿?\s*([0-9,]+\.?[0-9]*)/i,
        /฿\s*([0-9,]+\.?[0-9]*)/,
        /thb\s*([0-9,]+\.?[0-9]*)/i,
        /received\s+฿?\s*([0-9,]+\.?[0-9]*)/i,
        /paid\s+฿?\s*([0-9,]+\.?[0-9]*)/i,
        /([0-9,]+\.?[0-9]*)\s*฿/,
        /([0-9,]+\.?[0-9]*)\s*baht/i,
    ];

    for (const pattern of amountPatterns) {
        const match = smsContent.match(pattern);
        if (match && match[1]) {
            const amountStr = match[1].replace(/,/g, '');
            const parsed = parseFloat(amountStr);
            if (!isNaN(parsed) && parsed > 0) {
                amount = parsed;
                break;
            }
        }
    }

    // Extract transaction ID
    const transactionPatterns = [
        /trans(?:action)?[\s#:]+([a-z0-9]{6,})/i,
        /ref(?:erence)?[\s#:]+([a-z0-9]{6,})/i,
        /id[\s#:]+([a-z0-9]{6,})/i,
        /txn[\s#:]+([a-z0-9]{6,})/i,
    ];

    for (const pattern of transactionPatterns) {
        const match = smsContent.match(pattern);
        if (match && match[1]) {
            transactionId = match[1].toUpperCase();
            break;
        }
    }

    // Extract reference number (alternative to transaction ID)
    if (!transactionId) {
        const refMatch = smsContent.match(/\b([A-Z0-9]{8,})\b/);
        if (refMatch) {
            reference = refMatch[1];
        }
    }

    // Extract sender name (from/sender)
    const senderPatterns = [
        /from[\s:]+([a-z\s]+?)(?:\n|$|to|amount)/i,
        /sender[\s:]+([a-z\s]+?)(?:\n|$|to|amount)/i,
    ];

    for (const pattern of senderPatterns) {
        const match = smsContent.match(pattern);
        if (match && match[1]) {
            senderName = match[1].trim();
            break;
        }
    }

    if (amount === null) {
        return null; // No amount found
    }

    return {
        amount,
        transactionId,
        reference: reference || transactionId,
        senderName,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Match transaction to pending order
 * Tries to find exact amount match first, then allows small variance
 */
export function matchTransactionToOrder(
    transaction: SMSTransaction,
    pendingOrders: any[]
): any | null {
    if (!transaction || !pendingOrders || pendingOrders.length === 0) {
        return null;
    }

    // Try exact match first
    const exactMatch = pendingOrders.find(
        (order) => Math.abs(order.totalAmount - transaction.amount) < 0.01
    );

    if (exactMatch) {
        return exactMatch;
    }

    // Allow small variance (e.g., rounding differences, fees)
    const VARIANCE_THRESHOLD = 2; // Allow up to 2 baht difference
    const closeMatch = pendingOrders.find(
        (order) => Math.abs(order.totalAmount - transaction.amount) <= VARIANCE_THRESHOLD
    );

    return closeMatch || null;
}
