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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Package, AlertTriangle, Plus, Minus, Search, History, Barcode, Shuffle, Lock, Image, Pencil, Trash, Loader2, Sparkles, ScanLine } from "lucide-react";
import type { Product, InventoryLog, BusinessUnit } from "@shared/schema";
import { API_BASE_URL } from "@/lib/api-config";
import MobileScanner from "@/components/MobileScanner";

type NewProductForm = {
  name: string;
  barcode: string;
  price: string;
  cost: string;
  stock: string;
  minStockLevel: string;
  category: string;
  unit: string;
  imageData?: string | undefined;
  imageUrl?: string | undefined;
};

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
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<string | null>(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "subtract">("add");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const [newProduct, setNewProduct] = useState<NewProductForm>({
    name: "",
    barcode: "",
    price: "",
    cost: "",
    stock: "",
    minStockLevel: "",
    category: "",
    unit: "pcs",
    imageData: undefined,
    imageUrl: undefined,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Product Recognition
  const identifyProductMutation = useMutation({
    mutationFn: async (imageData: string) => {
      const response = await apiRequest("POST", "/api/ai/identify-product", { image: imageData });
      return response.json();
    },
    onSuccess: (data) => {
      // Auto-populate form fields with AI response
      if (data.name) {
        setNewProduct(prev => ({ ...prev, name: data.name }));
      }
      if (data.category) {
        setNewProduct(prev => ({ ...prev, category: data.category }));
      }
      if (data.estimatedPrice) {
        setNewProduct(prev => ({ ...prev, price: data.estimatedPrice.toString() }));
      }
      toast({
        title: "AI Product Recognition",
        description: "Product details have been automatically filled. Please review and save.",
      });
    },
    onError: (error) => {
      toast({
        title: "AI Recognition Failed",
        description: "Could not identify the product. Please enter details manually.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        setNewProduct((prev) => ({ ...prev, imageData: loadEvent.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const isLoggedIn = !!session;
  const canManageStock = canAccess("manager");

  const { data: businessUnits = [] } = useQuery<BusinessUnit[]>({
    queryKey: ['/api/business-units'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/business-units`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch business units');
      return response.json();
    }
  });

  useEffect(() => {
    if (selectedBusinessUnitId) return;
    if (!businessUnits || businessUnits.length === 0) return;

    const sessionBu = (session as any)?.staff?.businessUnitId as string | undefined;
    const initial = sessionBu || businessUnits[0].id;
    setSelectedBusinessUnitId(initial);
  }, [businessUnits, selectedBusinessUnitId, session]);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', selectedBusinessUnitId],
    queryFn: async () => {
      const url = selectedBusinessUnitId
        ? `${API_BASE_URL}/api/products?businessUnitId=${selectedBusinessUnitId}`
        : `${API_BASE_URL}/api/products`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
    enabled: isLoggedIn && !!selectedBusinessUnitId,
  });

  const { data: productLogs = [], isLoading: logsLoading } = useQuery<InventoryLog[]>({
    queryKey: [`/api/inventory/logs/${selectedProduct?.id}`],
    enabled: !!selectedProduct && historyModalOpen,
  });

  const handleDelete = (id: string) => {
    setProductToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const openEditModal = (product: Product) => {
    setIsEditing(true);
    setSelectedProduct(product);
    setNewProduct({
      name: product.name,
      barcode: product.barcode || "",
      price: String(product.price),
      cost: String(product.cost || ""),
      stock: String(product.stock),
      minStockLevel: String(product.minStockLevel),
      category: product.category || "",
      unit: product.unit || "pcs",
      imageData: product.imageData ?? undefined,
      imageUrl: product.imageUrl ?? undefined,
    });
    setAddProductModalOpen(true);
  };

  // Camera lifecycle managed via useEffect when camera modal opens
  useEffect(() => {
    let mounted = true;
    if (!cameraModalOpen) {
      // cleanup if closing
      try {
        streamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      } catch (e) {
        console.error('Error stopping camera tracks when modal closed:', (e as any)?.name || e);
      }
      streamRef.current = null;
      if (videoRef.current) {
        try { videoRef.current.pause(); videoRef.current.srcObject = null; } catch (e) { console.error(e); }
      }
      return;
    }

    const start = async () => {
      setCameraError(null);
      const tryConstraints = async (constraints: MediaStreamConstraints) => {
        return await navigator.mediaDevices.getUserMedia(constraints);
      };

      let stream: MediaStream | null = null;
      try {
        try {
          stream = await tryConstraints({ video: { facingMode: 'environment' } });
        } catch (err: any) {
          console.error('Inventory primary getUserMedia failed (environment):', err?.name, err?.message || err);
          if (err?.name === 'NotReadableError') {
            setCameraError('Camera is being used by another application');
          }
          try {
            stream = await tryConstraints({ video: true });
          } catch (err2: any) {
            console.error('Inventory fallback getUserMedia failed:', err2?.name, err2?.message || err2);
            if (mounted) setCameraError(err2?.message || 'Failed to access camera');
            return;
          }
        }

        if (!mounted || !stream) return;
        streamRef.current = stream;
        if (videoRef.current) {
          try {
            videoRef.current.srcObject = stream;
            videoRef.current.muted = true;
            videoRef.current.playsInline = true;
            (videoRef.current as HTMLVideoElement).autoplay = true as any;
            await (videoRef.current as HTMLVideoElement).play();
          } catch (playErr: any) {
            console.error('Inventory video play() failed after attaching stream:', playErr?.name, playErr?.message || playErr);
          }
        } else {
          console.error('inventory videoRef.current is null after stream obtained');
        }
      } catch (e: any) {
        console.error('Unexpected camera initialization error in Inventory:', e?.name, e?.message || e);
        if (mounted) setCameraError(e?.message || 'Failed to start camera');
      }
    };

    start();

    return () => {
      mounted = false;
      try { streamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop()); } catch (e) { console.error('Error stopping camera tracks (inventory cleanup):', (e as any)?.name || e); }
      streamRef.current = null;
      if (videoRef.current) {
        try { videoRef.current.pause(); videoRef.current.srcObject = null; } catch (e) { console.error(e); }
      }
    };
  }, [cameraModalOpen]);


  const adjustMutation = useMutation({
    mutationFn: (data: { productId: string; quantityChange: number; type: string; reason: string; staffName?: string }) =>
      apiRequest("POST", `/api/inventory/adjust/${data.productId}`, {
        quantityChange: data.quantityChange,
        type: data.type,
        reason: data.reason,
        staffName: data.staffName,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
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
    mutationFn: (data: Omit<Product, "id" | "status"> & { status?: string }) => apiRequest("POST", "/api/products", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
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

  const updateProductMutation = useMutation({
    mutationFn: (payload: { id: string; data: Partial<Product> }) => apiRequest("PATCH", `/api/products/${payload.id}`, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: "Product updated" });
      setIsEditingProduct(false);
      closeAddProductModal();
    },
    onError: (err: any) => {
      toast({ title: "Failed to update product", description: err.message, variant: 'destructive' });
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: "Product deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete", description: err.message, variant: 'destructive' });
    }
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
    setIsEditing(false);
    setSelectedProduct(null);
    setNewProduct({
      name: "",
      barcode: "",
      price: "",
      cost: "",
      stock: "",
      minStockLevel: "",
      category: "",
      unit: "pcs",
      imageUrl: undefined,
      imageData: undefined,
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

  const handleSaveProduct = () => {
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
    const cost = parseFloat(newProduct.cost);

    const productData = {
      name: newProduct.name.trim(),
      barcode: newProduct.barcode.trim() || undefined,
      price,
      cost: isNaN(cost) ? undefined : cost,
      imageData: (newProduct as any).imageData || undefined,
      imageUrl: newProduct.imageUrl || undefined,
      stock,
      minStockLevel: minStock,
      category: newProduct.category.trim() || null,
      unit: newProduct.unit || "pcs",
      businessUnitId: selectedBusinessUnitId,
    };

    if (isEditing && selectedProduct) {
      updateProductMutation.mutate({ id: selectedProduct.id, data: productData });
    } else {
      createProductMutation.mutate(productData);
    }
  };

  const handleGenerateBarcode = () => {
    setNewProduct((prev) => ({ ...prev, barcode: generateBarcode() }));
  };

  // Camera helpers for Add Product photo
  const startCamera = async () => {
    try {
      // Use a simple video constraint for broader compatibility
      const constraints: MediaStreamConstraints = { video: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        try {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          videoRef.current.autoplay = true as any;
          await videoRef.current.play();
        } catch (playErr: any) {
          console.error('Inventory video play() failed after attaching stream:', playErr?.name, playErr?.message || playErr);
        }
      }
      setCameraModalOpen(true);
    } catch (err: any) {
      console.error('Could not access camera in Inventory:', err?.name || 'UnknownError', err?.message || err);
    }
  };

  const stopCamera = () => {
    try {
      streamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    } catch (e) {
      console.error('Error stopping camera tracks:', (e as any)?.name || e);
    }
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setCameraModalOpen(false);
  };

  const captureProductPhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // compress the captured image to JPEG to reduce size
    const compress = async (c: HTMLCanvasElement, maxWidth = 1024, quality = 0.8) => {
      const width = c.width;
      const height = c.height;
      let targetWidth = width;
      let targetHeight = height;
      if (width > maxWidth) {
        targetWidth = maxWidth;
        targetHeight = Math.round((maxWidth / width) * height);
      }
      const tmp = document.createElement('canvas');
      tmp.width = targetWidth;
      tmp.height = targetHeight;
      const tctx = tmp.getContext('2d');
      if (!tctx) return null;
      tctx.drawImage(c, 0, 0, targetWidth, targetHeight);
      return await new Promise<Blob | null>((resolve) => tmp.toBlob((b) => resolve(b), 'image/jpeg', quality));
    };

    const blob = await compress(canvas);
    if (!blob) {
      stopCamera();
      return;
    }
    // convert blob to dataURL for storage in product.imageData
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read compressed image'));
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    setNewProduct((prev) => ({ ...prev, imageData: dataUrl } as any));
    stopCamera();
  };

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];

  const filteredProducts = products.filter((product) => {
    const matchesBusinessUnit = !selectedBusinessUnitId || product.businessUnitId === selectedBusinessUnitId;
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    return matchesBusinessUnit && matchesSearch && matchesCategory;
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
            <Button onClick={() => { setIsEditing(false); setNewProduct({ name: "", barcode: "", price: "", cost: "", stock: "", minStockLevel: "", category: "", unit: "pcs", imageData: undefined, imageUrl: undefined }); setAddProductModalOpen(true); }} data-testid="button-add-product">
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
              Total Stock Value: <span className="font-bold text-foreground">${Math.round(totalStockValue)}</span>
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
        <Select value={selectedBusinessUnitId || ''} onValueChange={(v) => setSelectedBusinessUnitId(v)}>
          <SelectTrigger className="w-[220px]" data-testid="select-business-unit">
            <SelectValue placeholder="Select Store" />
          </SelectTrigger>
          <SelectContent>
            {businessUnits.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                  <TableHead>Image</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden lg:table-cell">Barcode</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Margin</TableHead>
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
                  const profitMargin = product.cost && product.cost > 0
                    ? ((product.price - product.cost) / product.price * 100).toFixed(1)
                    : null;

                  const imageUrl = product.imageUrl
                    ? product.imageUrl.startsWith('http')
                      ? product.imageUrl
                      : `${API_BASE_URL}/uploads/${product.imageUrl}`
                    : product.imageData;

                  if (imageUrl) {
                    console.log("Full Image URL:", imageUrl);
                  }
                  return (
                    <TableRow
                      key={product.id}
                      data-testid={`row-product-${product.id}`}
                      className={isLowStock ? "bg-red-50 dark:bg-red-950/20" : ""}
                    >
                      <TableCell>
                        {imageUrl ? (
                          <img src={imageUrl} alt={product.name} className="w-10 h-10 object-cover rounded" style={{ position: 'relative', zIndex: 50 }} />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <Image className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
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
                        ${Math.round(product.price)}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {profitMargin ? (
                          <span className={parseFloat(profitMargin) >= 20 ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                            {profitMargin}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
                        <span className="font-medium">${Math.round(stockValue)}</span>
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
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditModal(product)}
                            >
                              <Pencil className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(product.id)}
                            >
                              <Trash className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canManageStock ? 10 : 9} className="text-center py-8 text-muted-foreground">
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
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
              <Label htmlFor="product-image-url">Image URL</Label>
              <Input
                id="product-image-url"
                value={newProduct.imageUrl || ""}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="https://example.com/image.png"
              />
            </div>

            <div className="space-y-2">
              <Label>Product Photo</Label>
              {(newProduct.imageData || newProduct.imageUrl) && (
                <div className="mt-2">
                  <img
                    src={(() => {
                      const imageUrl = newProduct.imageUrl
                        ? newProduct.imageUrl.startsWith('http')
                          ? newProduct.imageUrl
                          : `${API_BASE_URL}/uploads/${newProduct.imageUrl}`
                        : undefined;
                      const finalUrl = newProduct.imageData || imageUrl;
                      if (finalUrl) {
                        console.log("Full Image URL:", finalUrl);
                      }
                      return finalUrl;
                    })()}
                    alt="Product preview"
                    className="w-full h-32 object-cover rounded-lg border" style={{ position: 'relative', zIndex: 50 }}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button onClick={startCamera} data-testid="button-take-photo">Take Photo</Button>
                <Button onClick={() => fileInputRef.current?.click()} variant="outline">Upload Image</Button>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                {newProduct.imageData && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setNewProduct((p) => ({ ...p, imageData: undefined } as any))}
                    >
                      Remove Photo
                    </Button>
                    <Button
                      onClick={() => identifyProductMutation.mutate(newProduct.imageData!)}
                      disabled={identifyProductMutation.isPending}
                      variant="secondary"
                      className="flex items-center gap-2"
                    >
                      {identifyProductMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          AI က ခွဲခြမ်းစိတ်ဖြာနေပါတယ်...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Analyze Image
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
              {newProduct.imageData && (
                <img src={(newProduct as any).imageData} alt="preview" className="mt-2 max-h-40 object-contain border" />
              )}
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
                  onClick={() => setBarcodeScannerOpen(true)}
                  data-testid="button-scan-barcode"
                >
                  <ScanLine className="w-4 h-4" />
                </Button>
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
                  Selling Price <span className="text-destructive">*</span>
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
                <Label htmlFor="product-cost">Cost Price</Label>
                <Input
                  id="product-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newProduct.cost}
                  onChange={(e) => setNewProduct((prev) => ({ ...prev, cost: e.target.value }))}
                  placeholder="0.00"
                  data-testid="input-product-cost"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="product-category">Category</Label>
                <Input
                  id="product-category"
                  value={newProduct.category}
                  onChange={(e) => setNewProduct((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Groceries"
                  data-testid="input-product-category"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeAddProductModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveProduct}
              disabled={createProductMutation.isPending || updateProductMutation.isPending}
              data-testid="button-submit-product"
            >
              {isEditing
                ? updateProductMutation.isPending ? "Saving..." : "Save Changes"
                : createProductMutation.isPending ? "Adding..." : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MobileScanner
        isOpen={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onScanSuccess={(decodedText) => {
          setNewProduct((prev) => ({ ...prev, barcode: decodedText }));
        }}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the product from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (productToDelete) {
                  deleteProductMutation.mutate(productToDelete);
                }
                setDeleteConfirmOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={cameraModalOpen} onOpenChange={(open) => { if (!open) stopCamera(); setCameraModalOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Take Product Photo</DialogTitle>
            <DialogDescription>
              Position the product in front of your camera and capture a clear photo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-black">
              <video ref={videoRef} className="w-full max-h-96 object-contain" playsInline autoPlay muted />
            </div>
            {cameraError && (
              <div className="text-sm text-destructive">{cameraError}</div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { stopCamera(); }}>
                Cancel
              </Button>
              <Button onClick={captureProductPhoto} data-testid="button-capture-product">Capture</Button>
            </div>
          </div>
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
