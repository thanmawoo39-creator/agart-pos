import React from 'react';
import { motion } from 'framer-motion';
import { TableGrid } from '@/components/sales/TableGrid';
import type { CartItem } from '@shared/schema';

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

interface TableGridSelectionProps {
    tables: TableWithOrder[];
    onTableSelect: (table: TableWithOrder, autoNavigate?: boolean) => void;
    selectedTable: TableWithOrder | null;
    addToTableOrder: (tableId: string, item: CartItem) => void;
    businessUnitId?: string | null;
    showSearch?: boolean;
}

const fadeVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
};

export function TableGridSelection({
    tables,
    onTableSelect,
    selectedTable,
    addToTableOrder,
    businessUnitId,
    showSearch = false,
}: TableGridSelectionProps) {
    return (
        <motion.div
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="space-y-4"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-slate-100">Select a Table</h2>
                    <p className="text-sm text-slate-400">Tap an available table to start an order</p>
                </div>
            </div>

            {/* Table Grid */}
            <TableGrid
                tables={[...tables].sort((a, b) => {
                    const numA = parseInt(a.number.replace(/\D/g, '')) || 0;
                    const numB = parseInt(b.number.replace(/\D/g, '')) || 0;
                    return numA - numB;
                }) as any}
                onTableSelect={onTableSelect as any}
                selectedTable={selectedTable as any}
                addToTableOrder={addToTableOrder}
                showSearch={showSearch}
                businessUnitId={businessUnitId || undefined}
            />

            {/* Empty state hint */}
            {tables.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <p>No tables found. Add tables in Settings → Restaurant Tables.</p>
                </div>
            )}
        </motion.div>
    );
}
