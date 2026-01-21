import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Package, Search, LayoutGrid, List, Plus, Minus, ShoppingCart } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { QRScanner } from '@/components/QRScanner';
import type { Product, CartItem } from '@shared/schema';
import { API_BASE_URL } from '@/lib/api-config';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';
import { motion, AnimatePresence } from 'framer-motion';

// Fly-to-cart animation component
function FlyingItem({
  product,
  startPos,
  endPos,
  onComplete
}: {
  product: Product;
  startPos: { x: number; y: number };
  endPos: { x: number; y: number };
  onComplete: () => void;
}) {
  const imageUrl = product.imageData
    ? product.imageData
    : product.imageUrl
      ? (product.imageUrl.startsWith('http')
        ? product.imageUrl
        : `${API_BASE_URL}/uploads/${product.imageUrl}`)
      : undefined;

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{
        left: startPos.x,
        top: startPos.y,
        animation: 'flyToCart 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        '--end-x': `${endPos.x - startPos.x}px`,
        '--end-y': `${endPos.y - startPos.y}px`,
      } as React.CSSProperties}
      onAnimationEnd={onComplete}
    >
      <div className="w-14 h-14 rounded-lg shadow-2xl bg-white overflow-hidden border-2 border-primary">
        {imageUrl ? (
          <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Package className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

interface GroceryGridProps {
  products: Product[];
  productsLoading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onScanSuccess: (decodedText: string) => void;
  addToCart: (product: Product) => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  cart?: CartItem[];
  updateQuantity?: (id: string, quantity: number) => void;
}

export function GroceryGrid({
  products,
  productsLoading,
  searchTerm,
  setSearchTerm,
  onScanSuccess,
  addToCart,
  searchInputRef,
  cart = [],
  updateQuantity
}: GroceryGridProps) {
  const { formatCurrency } = useCurrency();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [flyingItems, setFlyingItems] = useState<{ id: string; product: Product; startPos: { x: number; y: number }; endPos: { x: number; y: number } }[]>([]);
  const [cartPulse, setCartPulse] = useState(false);
  const cartIconRef = useRef<HTMLDivElement>(null);

  // Create a map of productId -> cart quantity for O(1) lookup
  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, { quantity: number; cartItemId: string }>();
    cart.forEach(item => {
      if (item.productId) {
        map.set(item.productId, { quantity: item.quantity, cartItemId: item.id });
      }
    });
    return map;
  }, [cart]);

  // Extract unique categories from products
  const categories = useMemo(() => {
    const uniqueCategories = new Set<string>();
    products.forEach(p => {
      if (p.category && p.category.trim()) {
        uniqueCategories.add(p.category.trim());
      }
    });
    return ['All', ...Array.from(uniqueCategories).sort()];
  }, [products]);

  // Filter products by category and search term
  const filteredProducts = useMemo(() => {
    let result = products;

    // Apply category filter
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Apply search filter
    if (searchTerm) {
      result = result.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.barcode?.includes(searchTerm)
      );
    }

    return result;
  }, [products, selectedCategory, searchTerm]);

  // Handle fly-to-cart animation
  const handleAddToCart = useCallback((product: Product, event: React.MouseEvent<HTMLElement>) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const startPos = {
      x: rect.left + rect.width / 2 - 28,
      y: rect.top + rect.height / 2 - 28
    };

    // Get cart icon position (fallback to top-right if ref not available)
    let endPos = { x: window.innerWidth - 60, y: 20 };
    if (cartIconRef.current) {
      const cartRect = cartIconRef.current.getBoundingClientRect();
      endPos = {
        x: cartRect.left + cartRect.width / 2 - 28,
        y: cartRect.top + cartRect.height / 2 - 28
      };
    }

    // Add flying item
    const flyId = crypto.randomUUID();
    setFlyingItems(prev => [...prev, { id: flyId, product, startPos, endPos }]);

    // Add to cart immediately for responsiveness
    addToCart(product);

    // Trigger cart pulse
    setTimeout(() => {
      setCartPulse(true);
      setTimeout(() => setCartPulse(false), 300);
    }, 400);
  }, [addToCart]);

  const removeFlyingItem = useCallback((id: string) => {
    setFlyingItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // Handle quantity changes on-card
  const handleQuantityChange = useCallback((productId: string, cartItemId: string, delta: number) => {
    if (!updateQuantity) return;
    const current = cartQuantityMap.get(productId);
    if (current) {
      updateQuantity(cartItemId, current.quantity + delta);
    }
  }, [cartQuantityMap, updateQuantity]);

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      {/* CSS for fly animation */}
      <style>{`
        @keyframes flyToCart {
          0% {
            transform: translate(0, 0) scale(1) rotate(0deg);
            opacity: 1;
          }
          50% {
            transform: translate(calc(var(--end-x) * 0.5), calc(var(--end-y) * 0.3 - 40px)) scale(0.7) rotate(180deg);
            opacity: 0.9;
          }
          100% {
            transform: translate(var(--end-x), var(--end-y)) scale(0.2) rotate(360deg);
            opacity: 0;
          }
        }
        @keyframes cartPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.25); }
        }
        @keyframes quantityPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        .cart-pulse {
          animation: cartPulse 0.3s ease-in-out;
        }
        .quantity-pop {
          animation: quantityPop 0.2s ease-in-out;
        }
        /* Hide scrollbars while keeping scroll functionality */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Flying items */}
      {flyingItems.map(item => (
        <FlyingItem
          key={item.id}
          product={item.product}
          startPos={item.startPos}
          endPos={item.endPos}
          onComplete={() => removeFlyingItem(item.id)}
        />
      ))}

      <Card>
        <CardContent className="space-y-4 pt-4">
          {/* QR Scanner */}
          <QRScanner onScanSuccess={onScanSuccess} products={products} />

          {/* Search Bar and View Toggle */}
          <div className="flex gap-2 sm:gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                id="product-search"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 min-h-[48px] text-base"
              />
            </div>
            <div className="flex gap-1 sm:gap-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
                className="h-12 w-12 min-h-[48px] min-w-[48px]"
              >
                <List className="h-5 w-5" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className="h-12 w-12 min-h-[48px] min-w-[48px]"
              >
                <LayoutGrid className="h-5 w-5" />
              </Button>
              {/* Cart Icon with pulse animation - target for flying items */}
              <div
                ref={cartIconRef}
                className={`relative flex items-center justify-center h-12 w-12 min-h-[48px] min-w-[48px] rounded-md bg-primary text-primary-foreground ${cartPulse ? 'cart-pulse' : ''}`}
              >
                <ShoppingCart className="h-5 w-5" />
                {totalCartItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center font-bold px-1">
                    {totalCartItems}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sticky Category Filter Bar */}
          <div className="sticky top-0 z-50 -mx-4 sm:-mx-2 mb-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b pb-3 pt-2">
            <div className="flex gap-2 overflow-x-auto no-scrollbar touch-pan-x select-none px-4 sm:px-2">
              {categories.map((category) => {
                const productCount = category === 'All'
                  ? products.length
                  : products.filter(p => p.category === category).length;

                return (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                      "whitespace-nowrap min-w-[80px] h-10 font-medium transition-all duration-200 flex items-center gap-2",
                      selectedCategory === category && "shadow-md scale-105"
                    )}
                  >
                    <span>{category}</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs px-1.5 py-0",
                        selectedCategory === category && "bg-white/20 text-white"
                      )}
                    >
                      {productCount}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Product Display Area */}
          {productsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-36 sm:h-40 md:h-44" />
              ))}
            </div>
          ) : viewMode === 'grid' ? (
            <motion.div
              layout
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4 pb-32 select-none touch-manipulation"
            >
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product) => {
                  // Support both imageData (base64) and imageUrl (file path)
                  const imageUrl = product.imageData
                    ? product.imageData
                    : product.imageUrl
                      ? (product.imageUrl.startsWith('http')
                        ? product.imageUrl
                        : `${API_BASE_URL}/uploads/${product.imageUrl}`)
                      : undefined;

                  const cartInfo = cartQuantityMap.get(product.id);
                  const inCart = !!cartInfo;
                  const quantity = cartInfo?.quantity || 0;

                  return (
                    <motion.div
                      key={product.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                      whileTap={{ scale: product.stock > 0 ? 0.95 : 1 }}
                    >
                      <Card
                        className={cn(
                          "cursor-pointer transition-all duration-200 active:scale-[0.98] relative overflow-hidden group",
                          "touch-target min-h-[140px] sm:min-h-[160px]",
                          product.stock === 0 && "opacity-50 cursor-not-allowed",
                          inCart && "ring-2 ring-primary shadow-lg bg-primary/5"
                        )}
                        onClick={(e) => {
                          if (product.stock === 0) return;
                          if (!inCart) {
                            handleAddToCart(product, e);
                          }
                        }}
                      >
                        {/* Quantity Badge - Top Right */}
                        {inCart && (
                          <div className="absolute top-1 right-1 z-20">
                            <Badge className="bg-red-500 hover:bg-red-500 text-white font-bold text-sm px-2 py-0.5 shadow-lg quantity-pop">
                              {quantity}
                            </Badge>
                          </div>
                        )}

                        <CardContent className="p-2 sm:p-3 md:p-4 relative">
                          {/* Product Image */}
                          <div className="aspect-square mb-2 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center overflow-hidden relative">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover rounded-md"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  img.style.display = 'none';
                                  const fallback = img.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div
                              className="w-full h-full flex items-center justify-center bg-muted absolute inset-0"
                              style={{ display: imageUrl ? 'none' : 'flex' }}
                            >
                              <Package className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-muted-foreground" />
                            </div>

                            {/* On-Card Quantity Controls (visible when item is in cart) */}
                            {inCart && updateQuantity && (
                              <div
                                className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity duration-200"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center gap-2 bg-white rounded-full px-2 py-1 shadow-xl">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 rounded-full bg-red-100 hover:bg-red-200 text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuantityChange(product.id, cartInfo!.cartItemId, -1);
                                    }}
                                  >
                                    <Minus className="w-4 h-4" />
                                  </Button>
                                  <span className="text-xl font-bold w-8 text-center text-black">{quantity}</span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 rounded-full bg-green-100 hover:bg-green-200 text-green-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuantityChange(product.id, cartInfo!.cartItemId, 1);
                                    }}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Add indicator for items not in cart */}
                            {!inCart && product.stock > 0 && (
                              <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                                <div className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-200">
                                  <Plus className="w-6 h-6" />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Product Name */}
                          <h3 className="font-medium text-xs sm:text-sm truncate leading-tight">
                            {product.name}
                          </h3>
                          {/* Price - Prominent */}
                          <p className="text-base sm:text-lg font-bold text-primary mt-1">
                            {formatCurrency(Number(product.price) || 0)}
                          </p>
                          {/* Stock Badge */}
                          <Badge
                            variant={product.stock > 10 ? "secondary" : product.stock > 0 ? "outline" : "destructive"}
                            className="mt-1 text-xs"
                          >
                            {product.stock === 0 ? 'Out' : `${product.stock} left`}
                          </Badge>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          ) : (
            /* List View */
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Category</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-center">In Cart</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const imageUrl = product.imageData
                      ? product.imageData
                      : product.imageUrl
                        ? `${API_BASE_URL}/uploads/${product.imageUrl}`
                        : undefined;

                    const cartInfo = cartQuantityMap.get(product.id);
                    const inCart = !!cartInfo;
                    const quantity = cartInfo?.quantity || 0;

                    return (
                      <TableRow
                        key={product.id}
                        className={cn(
                          "min-h-[56px]",
                          product.stock === 0 && "opacity-50",
                          inCart && "bg-primary/5"
                        )}
                      >
                        <TableCell className="p-2">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={product.name}
                              className="h-10 w-10 sm:h-12 sm:w-12 rounded-md object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className="h-10 w-10 sm:h-12 sm:w-12 rounded-md bg-muted flex items-center justify-center"
                            style={{ display: imageUrl ? 'none' : 'flex' }}
                          >
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <span className="line-clamp-2 text-sm">{product.name}</span>
                          <span className="text-xs text-muted-foreground sm:hidden block">
                            {product.category || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {product.category || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={product.stock > 10 ? "secondary" : product.stock > 0 ? "outline" : "destructive"}>
                            {product.stock}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold font-mono">
                          {formatCurrency(Number(product.price) || 0)}
                        </TableCell>
                        <TableCell className="text-center">
                          {inCart && updateQuantity ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => handleQuantityChange(product.id, cartInfo!.cartItemId, -1)}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="font-bold w-6 text-center">{quantity}</span>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => handleQuantityChange(product.id, cartInfo!.cartItemId, 1)}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : inCart ? (
                            <Badge className="bg-primary">{quantity}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center p-2">
                          <Button
                            onClick={(e) => handleAddToCart(product, e)}
                            disabled={product.stock === 0}
                            size="sm"
                            variant={inCart ? "secondary" : "default"}
                            className={cn(
                              "h-10 min-h-[40px] px-3 sm:px-4",
                              product.stock === 0 && "cursor-not-allowed"
                            )}
                          >
                            <span className="hidden sm:inline">
                              {product.stock === 0 ? "Out" : inCart ? "More" : "Add"}
                            </span>
                            <span className="sm:hidden">+</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default GroceryGrid;
