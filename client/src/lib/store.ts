import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product, Store } from "@shared/schema";

interface CartState {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getSubtotal: () => number;
  getItemCount: () => number;
}

interface StoreState {
  currentStore: Store | null;
  setCurrentStore: (store: Store | null) => void;
}

interface AppState extends CartState, StoreState {}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Cart state
      items: [],

      addItem: (product: Product, quantity: number = 1) => {
        set((state) => {
          const existingItem = state.items.find(
            (item) => item.productId === product.id
          );

          if (existingItem) {
            return {
              items: state.items.map((item) =>
                item.productId === product.id
                  ? {
                      ...item,
                      quantity: item.quantity + quantity,
                      total: (item.quantity + quantity) * item.unitPrice,
                    }
                  : item
              ),
            };
          }

          const newItem: CartItem = {
            productId: product.id,
            productName: product.name,
            quantity,
            unitPrice: product.price,
            total: product.price * quantity,
            product,
          };

          return { items: [...state.items, newItem] };
        });
      },

      removeItem: (productId: string) => {
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
        }));
      },

      updateQuantity: (productId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }

        set((state) => ({
          items: state.items.map((item) =>
            item.productId === productId
              ? {
                  ...item,
                  quantity,
                  total: quantity * item.unitPrice,
                }
              : item
          ),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      getTotal: () => {
        return get().items.reduce((sum, item) => sum + item.total, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((sum, item) => sum + item.total, 0);
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      // Store state
      currentStore: null,

      setCurrentStore: (store: Store | null) => {
        set({ currentStore: store });
      },
    }),
    {
      name: "quickpos-storage",
      partialize: (state) => ({
        items: state.items,
        currentStore: state.currentStore,
      }),
    }
  )
);
