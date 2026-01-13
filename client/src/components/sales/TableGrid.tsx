import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, Minus, Search, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CartItem, Table as SchemaTable } from '@shared/schema';

export type TableWithOrder = Omit<SchemaTable, 'currentOrder'> & {
  currentOrder?: { items: CartItem[]; total: number } | null;
  orderCart?: CartItem[];
  customerId?: string;
  customer_id?: string;
};

interface TableGridProps {
  tables: TableWithOrder[];
  onTableSelect: (table: TableWithOrder) => void;
  selectedTable: TableWithOrder | null;
  addToTableOrder: (tableId: string, item: CartItem) => void;
  searchTerm?: string;
  setSearchTerm?: (term: string) => void;
  showSearch?: boolean;
}

export function TableGrid({
  tables,
  onTableSelect,
  selectedTable,
  addToTableOrder,
  searchTerm,
  setSearchTerm,
  showSearch = true
}: TableGridProps) {
  const [showOrderDialog, setShowOrderDialog] = useState(false);

  const filteredTables = showSearch && typeof searchTerm === 'string'
    ? tables.filter(table => table.number.toLowerCase().includes(searchTerm.toLowerCase()))
    : tables;

  const getStatusColor = (status: TableWithOrder['status']) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'occupied':
        return 'bg-red-100 text-red-800';
      case 'reserved':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCardStatusClass = (status: TableWithOrder['status'], serviceStatus?: TableWithOrder['serviceStatus']) => {
    switch (status) {
      case 'available':
        return 'border-green-300 bg-gradient-to-br from-green-50 to-green-100/50 hover:from-green-100 hover:to-green-50 hover:shadow-lg';
      case 'occupied':
        // Premium glow effect for occupied tables with different service states
        const baseOccupied = 'border-orange-300 bg-gradient-to-br from-orange-50 to-amber-100/50 hover:shadow-lg';
        if (serviceStatus === 'ordered') {
          return `${baseOccupied} shadow-[0_0_15px_rgba(59,130,246,0.3)] ring-1 ring-blue-200/50`;
        }
        if (serviceStatus === 'served') {
          return `${baseOccupied} shadow-[0_0_15px_rgba(34,197,94,0.3)] ring-1 ring-green-200/50`;
        }
        if (serviceStatus === 'billing') {
          return `${baseOccupied} shadow-[0_0_15px_rgba(168,85,247,0.4)] ring-1 ring-purple-300/50 animate-pulse`;
        }
        return `${baseOccupied} shadow-[0_0_12px_rgba(249,115,22,0.25)]`;
      case 'reserved':
        return 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50/50 hover:from-yellow-100 hover:to-amber-50 hover:shadow-lg shadow-[0_0_10px_rgba(234,179,8,0.2)]';
      default:
        return '';
    }
  };

  const getStatusText = (status: TableWithOrder['status'], serviceStatus?: TableWithOrder['serviceStatus']) => {
    if (status !== 'available') {
      if (serviceStatus === 'billing') return 'Billing';
      if (serviceStatus === 'served') return 'Served';
      if (serviceStatus === 'ordered') return 'Ordered';
    }
    switch (status) {
      case 'available':
        return 'Available';
      case 'occupied':
        return 'Occupied';
      case 'reserved':
        return 'Reserved';
      default:
        return 'Unknown';
    }
  };

  const getWorkflowBadgeClass = (serviceStatus?: TableWithOrder['serviceStatus']) => {
    switch (serviceStatus) {
      case 'ordered':
        return 'bg-blue-100 text-blue-800';
      case 'served':
        return 'bg-green-100 text-green-800';
      case 'billing':
        return 'bg-purple-100 text-purple-800';
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      {showSearch ? (
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tables..."
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm?.(e.target.value)}
            className="pl-10"
          />
        </div>
      ) : null}

      {/* Tables Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {filteredTables.map((table) => (
          <Card
            key={table.id}
            className={`cursor-pointer transition-all duration-300 ease-in-out hover:scale-[1.02] ${selectedTable?.id === table.id
              ? 'ring-2 ring-primary shadow-[0_0_0_1px_hsl(var(--primary))_inset,0_0_24px_hsl(var(--primary)/0.4)] scale-[1.02]'
              : ''
              } ${getCardStatusClass(table.status, table.serviceStatus)}`}
            onClick={() => onTableSelect(table)}
          >
            <CardContent className="p-4 text-center">
              <div className="flex flex-col items-center space-y-2">
                <div className={`p-2 rounded-full ${table.status === 'occupied'
                    ? 'bg-orange-100 text-orange-600'
                    : table.status === 'reserved'
                      ? 'bg-yellow-100 text-yellow-600'
                      : 'bg-green-100 text-green-600'
                  }`}>
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-lg">Table {table.number}</h3>
                <Badge className={`${getWorkflowBadgeClass(table.serviceStatus) || getStatusColor(table.status)} font-medium`}>
                  {getStatusText(table.status, table.serviceStatus)}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {table.capacity} guests
                </p>
                {table.currentOrder && (
                  <div className="text-sm font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                    <Clock className="w-3 h-3 inline mr-1" />
                    ${table.currentOrder.total.toFixed(2)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Selected Table Details */}
      {selectedTable && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Table {selectedTable.number} - {getStatusText(selectedTable.status, selectedTable.serviceStatus)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Capacity:</span>
                <span className="font-medium">{selectedTable.capacity} guests</span>
              </div>

              {selectedTable.currentOrder && (
                <div className="space-y-2">
                  <h4 className="font-medium">Current Order</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTable?.currentOrder?.items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>${(Number(item.unitPrice ?? item.price) || 0).toFixed(2)}</TableCell>
                          <TableCell>${(item.quantity * (Number(item.unitPrice ?? item.price) || 0)).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between items-center font-bold text-lg pt-2 border-t">
                    <span>Total:</span>
                    <span>${(selectedTable?.currentOrder?.total ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {selectedTable.status === 'available' && (
                  <Button onClick={() => setShowOrderDialog(true)}>
                    Start Order
                  </Button>
                )}
                {selectedTable.status === 'occupied' && (
                  <Button variant="outline">
                    Add to Order
                  </Button>
                )}
                <Button variant="outline">
                  Table Details
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Items to Table {selectedTable?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Select items from the menu to add to this table's order.
            </p>
            {/* Menu items would go here - this is a placeholder for the menu integration */}
            <div className="text-center py-8 text-muted-foreground">
              Menu integration coming soon...
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TableGrid;
