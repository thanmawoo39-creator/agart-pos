/**
 * Custom Hook: useCart (Zustand Store)
 * Manages all cart logic including items, totals, tax, and change calculation
 * Separates business logic from UI components for better maintainability
 */

import { create } from "zustand";
import { Product } from "@shared/schema";

export interface CartItem extends Product {
  quantity: number;
}

interface CartState {
  // State
  items: CartItem[];
  amountReceived: number;
  taxEnabled: boolean;
  taxPercentage: number;

  // Actions
  addToCart: (product: Product) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  setAmountReceived: (amount: number) => void;
  setTaxSettings: (enabled: boolean, percentage: number) => void;

  // Computed values (getters)
  getSubtotal: () => number;
  getTaxAmount: () => number;
  getTotal: () => number;
  getChange: () => number;
  isPaymentSufficient: () => boolean;
  isEmpty: () => boolean;
  getItemCount: () => number;
}

export const useCart = create<CartState>((set, get) => ({
  // Initial state
  items: [],
  amountReceived: 0,
  taxEnabled: false,
  taxPercentage: 0,

  // Actions
  addToCart: (product) =>
    set((state) => {
      const existingItem = state.items.find((item) => item.id === product.id);
      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      }
      return { items: [...state.items, { ...product, quantity: 1 }] };
    }),

  updateQuantity: (productId, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return {
          items: state.items.filter((item) => item.id !== productId),
        };
      }
      return {
        items: state.items.map((item) =>
          item.id === productId ? { ...item, quantity } : item
        ),
      };
    }),

  removeFromCart: (productId) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== productId),
    })),

  clearCart: () => set({ items: [], amountReceived: 0 }),

  setAmountReceived: (amount) => set({ amountReceived: amount }),

  setTaxSettings: (enabled, percentage) =>
    set({ taxEnabled: enabled, taxPercentage: percentage }),

  // Computed values
  getSubtotal: () => {
    const state = get();
    return state.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  },

  getTaxAmount: () => {
    const state = get();
    if (!state.taxEnabled) return 0;
    return (state.getSubtotal() * state.taxPercentage) / 100;
  },

  getTotal: () => {
    const state = get();
    return state.getSubtotal() + state.getTaxAmount();
  },

  getChange: () => {
    const state = get();
    const calculatedChange = state.amountReceived - state.getTotal();
    return calculatedChange > 0 ? calculatedChange : 0;
  },

  isPaymentSufficient: () => {
    const state = get();
    return state.amountReceived >= state.getTotal();
  },

  isEmpty: () => {
    const state = get();
    return state.items.length === 0;
  },

  getItemCount: () => {
    const state = get();
    return state.items.reduce((count, item) => count + item.quantity, 0);
  },
}));