import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Package, AlertTriangle, Plus, Minus, Search, History, Barcode, Shuffle, Lock } from "lucide-react";
import type { Product, InventoryLog } from "@shared/schema";

function generateBarcode(): string {
  let barcode = "";
  for (let i = 0; i < 13; i++) {
    barcode += Math.floor(Math.random() * 10).toString();
  }
  return barcode;
}

export default function Inventory() {
  const { toast } = useToast();
  const { session, canAccess } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "subtract">("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  
  const [newProduct, setNewProduct] = useState({
    name: "",
    barcode: "",
    price: "",
    stock: "",
    minStockLevel: "",
    category: "",
    unit: "pcs",
  });

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const isLoggedIn = !!session;
  const canManageStock = canAccess("manager");

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: productLogs = [], isLoading: logsLoading } = useQuery<InventoryLog[]>({
    queryKey: [`/api/inventory/logs/${selectedProduct?.id}`],
    enabled: !!selectedProduct && historyModalOpen,
  });

  const adjustMutation = useMutation({
    mutationFn: (data: { productId: string; quantityChange: number; type: string; reason: string; staffName?: string }) =>
      apiRequest("POST", `/api/inventory/adjust/${data.productId}`, {
        quantityChange: data.quantityChange,
        type: data.type,
        reason: data.reason,
        staffName: data.staffName,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      if (selectedProduct) {
        queryClient.invalidateQueries({ queryKey: [`/api/inventory/logs/${selectedProduct.id}`] });
      }
      toast({ title: "Stock adjusted successfully" });
      closeAdjustModal();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to adjust stock",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createProductMutation = useMutation({
    mutationFn: (data: Omit<Product, "id">) => apiRequest("POST", "/api/products", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product added successfully" });
      closeAddProductModal();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (barcodeSearch.length >= 8) {
      const found = products.find((p) => p.barcode === barcodeSearch);
      if (found) {
        setSearchTerm(found.name);
        setBarcodeSearch("");
        toast({ title: `Found: ${found.name}` });
      }
    }
  }, [barcodeSearch, products, toast]);

  const openAdjustModal = (product: Product, type: "add" | "subtract") => {
    setSelectedProduct(product);
    setAdjustmentType(type);
    setQuantity("");
    setReason("");
    setAdjustModalOpen(true);
  };

  const closeAdjustModal = () => {
    setAdjustModalOpen(false);
    setSelectedProduct(null);
    setQuantity("");
    setReason("");
  };

  const openHistoryModal = (product: Product) => {
    setSelectedProduct(product);
    setHistoryModalOpen(true);
  };

  const closeAddProductModal = () => {
    setAddProductModalOpen(false);
    setNewProduct({
      name: "",
      barcode: "",
      price: "",
      stock: "",
      minStockLevel: "",
      category: "",
      unit: "pcs",
    });
  };

  const handleAdjustSubmit = () => {
    if (!selectedProduct) return;
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Please enter a valid quantity", variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: "Reason is required", variant: "destructive" });
      return;
    }

    const quantityChange = adjustmentType === "add" ? qty : -qty;
    const type = adjustmentType === "add" ? "stock-in" : "adjustment";

    adjustMutation.mutate({
      productId: selectedProduct.id,
      quantityChange,
      type,
      reason: reason.trim(),
      staffName: session?.staff.name,
    });
  };

  const handleAddProduct = () => {
    if (!newProduct.name.trim()) {
      toast({ title: "Product name is required", variant: "destructive" });
      return;
    }
    const price = parseFloat(newProduct.price);
    if (isNaN(price) || price <= 0) {
      toast({ title: "Please enter a valid price", variant: "destructive" });
      return;
    }
    const stock = parseInt(newProduct.stock) || 0;
    const minStock = parseInt(newProduct.minStockLevel) || 5;

    createProductMutation.mutate({
      name: newProduct.name.trim(),
      barcode: newProduct.barcode.trim() || undefined,
      price,
      stock,
      minStockLevel: minStock,
      category: newProduct.category.trim() || undefined,
      unit: newProduct.unit || "pcs",
    });
  };

  const handleGenerateBarcode = () => {
    setNewProduct((prev) => ({ ...prev, barcode: generateBarcode() }));
  };

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const lowStockCount = products.filter((p) => p.stock <= p.minStockLevel).length;
  const totalStockValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Inventory Management
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Track stock levels and adjustments
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lowStockCount > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {lowStockCount} Low Stock
            </Badge>
          )}
          {!isLoggedIn ? (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Please Login to Manage Stock
            </Badge>
          ) : canManageStock ? (
            <Button onClick={() => setAddProductModalOpen(true)} data-testid="button-add-product">
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Barcode className="w-5 h-5 text-indigo-500" />
              <span className="text-sm font-medium">Scan Barcode:</span>
            </div>
            <Input
              ref={barcodeInputRef}
              placeholder="Scan or enter barcode..."
              value={barcodeSearch}
              onChange={(e) => setBarcodeSearch(e.target.value)}
              className="max-w-[250px] font-mono"
              data-testid="input-barcode-scan"
            />
            <div className="ml-auto text-sm text-muted-foreground">
              Total Stock Value: <span className="font-bold text-foreground">${totalStockValue.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="p-3 md:p-4">
          <CardTitle className="text-base md:text-lg font-medium flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-500" />
            Product Inventory ({filteredProducts.length} items)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4 pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden lg:table-cell">Barcode</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Value</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Min</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {canManageStock && <TableHead className="text-center">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => {
                  const isLowStock = product.stock <= product.minStockLevel;
                  const stockValue = product.price * product.stock;
                  return (
                    <TableRow
                      key={product.id}
                      data-testid={`row-product-${product.id}`}
                      className={isLowStock ? "bg-red-50 dark:bg-red-950/20" : ""}
                    >
                      <TableCell className="font-medium">
                        <span className="block truncate max-w-[150px] md:max-w-none">
                          {product.name}
                        </span>
                        <span className="text-xs text-muted-foreground md:hidden">
                          {product.unit || "pcs"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {product.category || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground hidden lg:table-cell">
                        {product.barcode || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        ${product.price.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={isLowStock ? "text-destructive font-bold" : "font-medium"}>
                          {product.stock}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">
                          {product.unit || "pcs"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        <span className="font-medium">${stockValue.toFixed(2)}</span>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground hidden sm:table-cell">
                        {product.minStockLevel}
                      </TableCell>
                      <TableCell className="text-center">
                        {isLowStock ? (
                          <Badge variant="destructive" className="text-xs">
                            Low
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            OK
                          </Badge>
                        )}
                      </TableCell>
                      {canManageStock && (
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openAdjustModal(product, "add")}
                              data-testid={`button-add-stock-${product.id}`}
                            >
                              <Plus className="w-4 h-4 text-emerald-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openAdjustModal(product, "subtract")}
                              data-testid={`button-subtract-stock-${product.id}`}
                            >
                              <Minus className="w-4 h-4 text-destructive" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openHistoryModal(product)}
                              data-testid={`button-history-${product.id}`}
                            >
                              <History className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canManageStock ? 9 : 8} className="text-center py-8 text-muted-foreground">
                      No products found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addProductModalOpen} onOpenChange={setAddProductModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Enter product details to add to inventory
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="product-name"
                value={newProduct.name}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter product name"
                data-testid="input-product-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-barcode">Barcode</Label>
              <div className="flex gap-2">
                <Input
                  id="product-barcode"
                  value={newProduct.barcode}
                  onChange={(e) => setNewProduct((prev) => ({ ...prev, barcode: e.target.value }))}
                  placeholder="Enter or generate barcode"
                  className="font-mono flex-1"
                  data-testid="input-product-barcode"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleGenerateBarcode}
                  data-testid="button-generate-barcode"
                >
                  <Shuffle className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-price">
                  Price <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="product-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                  data-testid="input-product-price"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-stock">Initial Stock</Label>
                <Input
                  id="product-stock"
                  type="number"
                  min="0"
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct((prev) => ({ ...prev, stock: e.target.value }))}
                  placeholder="0"
                  data-testid="input-product-stock"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-min-stock">Min Stock Level</Label>
                <Input
                  id="product-min-stock"
                  type="number"
                  min="0"
                  value={newProduct.minStockLevel}
                  onChange={(e) => setNewProduct((prev) => ({ ...prev, minStockLevel: e.target.value }))}
                  placeholder="5"
                  data-testid="input-product-min-stock"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-unit">Unit</Label>
                <Select
                  value={newProduct.unit}
                  onValueChange={(value) => setNewProduct((prev) => ({ ...prev, unit: value }))}
                >
                  <SelectTrigger data-testid="select-product-unit">
                    <SelectValue placeholder="pcs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">pcs</SelectItem>
                    <SelectItem value="bag">bag</SelectItem>
                    <SelectItem value="box">box</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="gallon">gallon</SelectItem>
                    <SelectItem value="loaf">loaf</SelectItem>
                    <SelectItem value="bottle">bottle</SelectItem>
                    <SelectItem value="can">can</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-category">Category</Label>
              <Input
                id="product-category"
                value={newProduct.category}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="e.g., Groceries, Dairy, Electronics"
                data-testid="input-product-category"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAddProductModal}>
              Cancel
            </Button>
            <Button
              onClick={handleAddProduct}
              disabled={createProductMutation.isPending}
              data-testid="button-submit-product"
            >
              {createProductMutation.isPending ? "Adding..." : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustModalOpen} onOpenChange={setAdjustModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustmentType === "add" ? "Add Stock" : "Subtract Stock"}
            </DialogTitle>
            <DialogDescription>
              {selectedProduct?.name} - Current stock: {selectedProduct?.stock} {selectedProduct?.unit || "pcs"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
                data-testid="input-quantity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for adjustment (required)"
                data-testid="input-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAdjustModal}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjustSubmit}
              disabled={adjustMutation.isPending}
              data-testid="button-submit-adjustment"
            >
              {adjustMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Stock History</DialogTitle>
            <DialogDescription>
              {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            {logsLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : productLogs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No history available</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">After</TableHead>
                    <TableHead className="hidden md:table-cell">Reason</TableHead>
                    <TableHead className="hidden md:table-cell">By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.timestamp).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.type === "sale"
                              ? "secondary"
                              : log.type === "stock-in"
                              ? "default"
                              : "outline"
                          }
                          className="text-xs"
                        >
                          {log.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            log.quantityChanged > 0
                              ? "text-emerald-600 font-medium"
                              : "text-destructive font-medium"
                          }
                        >
                          {log.quantityChanged > 0 ? "+" : ""}
                          {log.quantityChanged}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{log.currentStock}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate hidden md:table-cell">
                        {log.reason || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                        {log.staffName || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
