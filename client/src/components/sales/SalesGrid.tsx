import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Package, Search, LayoutGrid, List } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { QRScanner } from '@/components/QRScanner';
import { Product } from '@/types/sales';
import { API_BASE_URL } from '@/lib/api-config';

interface SalesGridProps {
  products: Product[];
  productsLoading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onScanSuccess: (decodedText: string) => void;
  addToCart: (product: Product) => void;
}

export function SalesGrid({
  products,
  productsLoading,
  searchTerm,
  setSearchTerm,
  onScanSuccess,
  addToCart
}: SalesGridProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode?.includes(searchTerm)
  );

  return (
    <Card>
      <CardContent className="space-y-4">
        {/* QR Scanner */}
        <QRScanner onScanSuccess={onScanSuccess} products={products} />
        
        {/* Search Bar and View Toggle */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('list')}>
              <List className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('grid')}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Product Display Area */}
        {productsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredProducts.map((product) => {
              // Support both imageData (base64) and imageUrl (file path)
              const imageUrl = product.imageData
                ? product.imageData
                : product.imageUrl
                  ? (product.imageUrl.startsWith('http')
                    ? product.imageUrl
                    : `${API_BASE_URL}/uploads/${product.imageUrl}`)
                  : undefined;
              
              return (
                <Card
                  key={product.id}
                  className={`cursor-pointer hover:shadow-md transition-shadow ${
                    product.stock === 0 ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-4">
                    <div className="aspect-square mb-2 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
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
                        className="w-full h-full flex items-center justify-center bg-muted"
                        style={{ display: imageUrl ? 'none' : 'flex' }}
                      >
                        <Package className="w-12 h-12 text-muted-foreground" />
                      </div>
                    </div>
                    <h3 className="font-medium text-sm truncate">{product.name}</h3>
                    <p className="text-lg font-bold">${product.price.toFixed(2)}</p>
                    <Badge variant={product.stock > 10 ? "default" : "destructive"}>
                      Stock: {product.stock}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      {(product.imageData || product.imageUrl) ? (
                        <img
                          src={
                            product.imageData
                              ? product.imageData
                              : `${API_BASE_URL}/uploads/${product.imageUrl}`
                          }
                          alt={product.name}
                          className="h-10 w-10 rounded-md object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center" style={{ display: (product.imageData || product.imageUrl) ? 'none' : 'flex' }}>
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>{product.stock}</TableCell>
                    <TableCell>${product.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <Button 
                        onClick={() => addToCart(product)}
                        disabled={product.stock === 0}
                        className={product.stock === 0 ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
