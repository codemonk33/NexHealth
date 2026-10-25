import { create } from 'zustand';
import type { CartItem, Medicine } from '../api/types';

interface CartStore {
  items: CartItem[];
  addItem: (medicine: Medicine) => void;
  removeItem: (medicineId: string) => void;
  updateQuantity: (medicineId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (medicine) => {
    const existing = get().items.find((i) => i.medicine.id === medicine.id);
    if (existing) {
      set({
        items: get().items.map((i) =>
          i.medicine.id === medicine.id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      });
    } else {
      set({ items: [...get().items, { medicine, quantity: 1 }] });
    }
  },

  removeItem: (medicineId) => {
    set({ items: get().items.filter((i) => i.medicine.id !== medicineId) });
  },

  updateQuantity: (medicineId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(medicineId);
      return;
    }
    set({
      items: get().items.map((i) =>
        i.medicine.id === medicineId ? { ...i, quantity } : i
      ),
    });
  },

  clearCart: () => set({ items: [] }),

  get totalItems() {
    return get().items.reduce((sum, i) => sum + i.quantity, 0);
  },

  get totalAmount() {
    return get().items.reduce(
      (sum, i) => sum + (i.medicine.discountedPrice ?? i.medicine.price) * i.quantity,
      0
    );
  },
}));
