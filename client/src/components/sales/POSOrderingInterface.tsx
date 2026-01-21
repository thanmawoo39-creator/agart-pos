import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GroceryGrid } from '@/components/sales/GroceryGrid';
import { CartSection } from '@/components/sales/CartSection';
import type { CartItem, Customer, Product, Sale } from '@shared/schema';
import { UseMutationResult } from '@tanstack/react-query';

// Standalone type to avoid conflicts with shared schema
interface TableWithOrder {
    id: string;
    number: string;
    capacity: number;
    status: 'available' | 'occupied' | 'reserved';
    serviceStatus?: 'ordered' | 'served' | 'billing' | null;
    orderCart?: CartItem[];
    currentOrder?: { items: CartItem[]; total: number } | null;
    customerId?: string;
    customer_id?: string;
    activeSaleId?: string | null;
    businessUnitId?: string;
}

interface POSOrderingInterfaceProps {
    // Products
    products: Product[];
    productsLoading: boolean;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onScanSuccess: (result: string) => void;
    addToCart: (product: Product) => void;
    searchInputRef: React.RefObject<HTMLInputElement>;

    // Cart
    cart: CartItem[];
    updateQuantity: (id: string, newQuantity: number) => void;
    removeFromCart: (id: string) => void;
    getTotal: () => number;

    // Customer & Payment
    customers: Customer[];
    selectedCustomer: string;
    setSelectedCustomer: (id: string) => void;
    paymentMethod: Sale['paymentMethod'] | '';
    setPaymentMethod: (method: Sale['paymentMethod']) => void;
    amountReceived: number;
    setAmountReceived: (amount: number) => void;

    // Sale
    completeSale: () => void;
    completeSaleMutation: UseMutationResult<Sale, Error, void>;

    // Camera/Payment
    showCameraModal: boolean;
    setShowCameraModal: (show: boolean) => void;
    paymentSlipUrl: string;

    // Table
    selectedTable: TableWithOrder | null;
    onSendToKitchen: () => void;
    isRestaurantMode: boolean;

    // Navigation
    onBackToTables: () => void;

    // Optional refs
    customerSelectTriggerRef?: React.RefObject<HTMLButtonElement>;
    businessUnitId?: string | null;
    onKitchenOrderSent?: () => void;
    lastSaleId?: string;
    lastSaleTotal?: number;
}

const fadeVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
};

export function POSOrderingInterface({
    // Products
    products,
    productsLoading,
    searchTerm,
    setSearchTerm,
    onScanSuccess,
    addToCart,
    searchInputRef,

    // Cart
    cart,
    updateQuantity,
    removeFromCart,
    getTotal,

    // Customer & Payment
    customers,
    selectedCustomer,
    setSelectedCustomer,
    paymentMethod,
    setPaymentMethod,
    amountReceived,
    setAmountReceived,

    // Sale
    completeSale,
    completeSaleMutation,

    // Camera/Payment
    showCameraModal,
    setShowCameraModal,
    paymentSlipUrl,

    // Table
    selectedTable,
    onSendToKitchen,
    isRestaurantMode,

    // Navigation
    onBackToTables,

    // Optional
    customerSelectTriggerRef,
    businessUnitId,
    onKitchenOrderSent,
    lastSaleId,
    lastSaleTotal,
}: POSOrderingInterfaceProps) {
    return (
        <motion.div
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="space-y-4"
        >
            {/* Header with Back Button */}
            <div className="flex items-center gap-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onBackToTables}
                    className="gap-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Tables
                </Button>

                {selectedTable && (
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-primary">
                            Table {selectedTable.number || selectedTable.id}
                        </span>
                        {selectedTable.serviceStatus && (
                            <span className={`text-xs px-2 py-1 rounded-full ${selectedTable.serviceStatus === 'billing'
                                ? 'bg-amber-100 text-amber-700'
                                : selectedTable.serviceStatus === 'ordered'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                {selectedTable.serviceStatus}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Main Layout: Products + Cart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Product Grid */}
                <div className="lg:col-span-2">
                    <GroceryGrid
                        products={products}
                        productsLoading={productsLoading}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        onScanSuccess={onScanSuccess}
                        addToCart={addToCart}
                        searchInputRef={searchInputRef}
                        cart={cart}
                        updateQuantity={updateQuantity}
                    />
                </div>

                {/* Cart Sidebar (Desktop Only) */}
                <div className="hidden lg:block">
                    <CartSection
                        cart={cart}
                        customers={customers}
                        selectedCustomer={selectedCustomer}
                        setSelectedCustomer={setSelectedCustomer}
                        paymentMethod={paymentMethod}
                        setPaymentMethod={setPaymentMethod as any}
                        updateQuantity={updateQuantity}
                        removeFromCart={removeFromCart}
                        getTotal={getTotal}
                        completeSale={completeSale}
                        completeSaleMutation={completeSaleMutation}
                        showCameraModal={showCameraModal}
                        setShowCameraModal={setShowCameraModal}
                        paymentSlipUrl={paymentSlipUrl}
                        amountReceived={amountReceived}
                        setAmountReceived={setAmountReceived}
                        selectedTable={selectedTable as any}
                        onSendToKitchen={onSendToKitchen}
                        isRestaurantMode={isRestaurantMode}
                        customerSelectTriggerRef={customerSelectTriggerRef}
                        businessUnitId={businessUnitId || undefined}
                        onKitchenOrderSent={onKitchenOrderSent}
                        lastSaleId={lastSaleId}
                        lastSaleTotal={lastSaleTotal}
                    />
                </div>
            </div>
        </motion.div>
    );
}
