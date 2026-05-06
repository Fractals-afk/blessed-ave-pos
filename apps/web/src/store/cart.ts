import { create } from "zustand";
import type { MenuItem, ModifierOption } from "@blessed-ave/types";

export interface CartItem {
  id: string; // unique per line (menuItemId + options combo)
  menuItem: MenuItem;
  quantity: number;
  selectedOptions: ModifierOption[];
  notes?: string;
  unitPrice: number; // base + modifiers
  subtotal: number;
}

interface CartStore {
  items: CartItem[];
  tableId?: string;
  tableName?: string;

  setTable: (id: string, name: string) => void;
  addItem: (item: Omit<CartItem, "subtotal">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCart = create<CartStore>((set, get) => ({
  items: [],

  setTable: (id, name) => set({ tableId: id, tableName: name }),

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id
              ? { ...i, quantity: i.quantity + item.quantity, subtotal: (i.quantity + item.quantity) * i.unitPrice }
              : i
          ),
        };
      }
      return {
        items: [
          ...state.items,
          { ...item, subtotal: item.quantity * item.unitPrice },
        ],
      };
    }),

  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

  updateQuantity: (id, qty) =>
    set((state) => ({
      items:
        qty <= 0
          ? state.items.filter((i) => i.id !== id)
          : state.items.map((i) =>
              i.id === id ? { ...i, quantity: qty, subtotal: qty * i.unitPrice } : i
            ),
    })),

  clearCart: () => set({ items: [] }),

  total: () => get().items.reduce((s, i) => s + i.subtotal, 0),
}));
