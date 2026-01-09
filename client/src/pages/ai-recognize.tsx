import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImageRecognition } from '@/components/image-recognition';
import { Product, CartItem } from '@/types/sales';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/lib/api-config';

export function AIRecognizePage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const { toast } = useToast();

  // Fetch products
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/products`);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    }
  });

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });

    toast({
      title: "Product Added",
      description: `${product.name} has been added to cart.`,
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">AI Product Recognition</h1>
        <p className="text-muted-foreground">Use AI to identify products and automatically add them to cart</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <ImageRecognition addToCart={addToCart} />
        </div>
        
        <div>
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Cart ({cart.length} items)</h2>
            {cart.length === 0 ? (
              <p className="text-muted-foreground">Cart is empty</p>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-2 border rounded">
                    <div>
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">${item.price.toFixed(2)} each</p>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>${cart.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
