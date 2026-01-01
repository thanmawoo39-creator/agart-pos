import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product, Store, Customer } from "@shared/schema";

interface CartState {
  items: CartItem[];
  linkedCustomer: Customer | null;
  discount: number;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setLinkedCustomer: (customer: Customer | null) => void;
  setDiscount: (discount: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

interface StoreState {
  currentStore: Store | null;
  setCurrentStore: (store: Store | null) => void;
}

interface AIAlert {
  type: "warning" | "tip" | "success";
  message: string;
}

interface AIState {
  alerts: AIAlert[];
  addAlert: (alert: AIAlert) => void;
  clearAlerts: () => void;
  setAlerts: (alerts: AIAlert[]) => void;
}

interface AppState extends CartState, StoreState, AIState {}

const TAX_RATE = 0.08;

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Cart state
      items: [],
      linkedCustomer: null,
      discount: 0,

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

      setLinkedCustomer: (customer: Customer | null) => {
        set({ linkedCustomer: customer });
      },

      setDiscount: (discount: number) => {
        set({ discount: Math.max(0, discount) });
      },

      clearCart: () => {
        set({ items: [], linkedCustomer: null, discount: 0, alerts: [] });
      },

      getSubtotal: () => {
        return get().items.reduce((sum, item) => sum + item.total, 0);
      },

      getTax: () => {
        const subtotal = get().getSubtotal();
        const discount = get().discount;
        return (subtotal - discount) * TAX_RATE;
      },

      getTotal: () => {
        const subtotal = get().getSubtotal();
        const discount = get().discount;
        const tax = get().getTax();
        return subtotal - discount + tax;
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      // Store state
      currentStore: null,

      setCurrentStore: (store: Store | null) => {
        set({ currentStore: store });
      },

      // AI Alerts state
      alerts: [],

      addAlert: (alert: AIAlert) => {
        set((state) => {
          // Avoid duplicate alerts
          const exists = state.alerts.some(a => a.message === alert.message);
          if (exists) return state;
          return { alerts: [...state.alerts, alert] };
        });
      },

      clearAlerts: () => {
        set({ alerts: [] });
      },

      setAlerts: (alerts: AIAlert[]) => {
        set({ alerts });
      },
    }),
    {
      name: "quickpos-storage",
      partialize: (state) => ({
        items: state.items,
        linkedCustomer: state.linkedCustomer,
        discount: state.discount,
        currentStore: state.currentStore,
      }),
    }
  )
);
