import apiClient, { USE_MOCK_DATA } from './client';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { Medicine, MedicineCategory, PlaceOrderPayload, Order } from './types';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ─── Mock Data ─────────────────────────────────────────────────────────────────
export const MOCK_MEDICINES: Medicine[] = [
  {
    id: 'med-001',
    name: 'Dolo 650',
    brand: 'Micro Labs',
    generic: 'Paracetamol 650mg',
    category: 'PAIN_RELIEF',
    packSize: '15 Tablets',
    price: 30,
    discountedPrice: 28,
    discountPercent: 7,
    requiresPrescription: false,
    inStock: true,
    description: 'Used to reduce fever and treat mild to moderate pain.',
  },
  {
    id: 'med-002',
    name: 'Pan 40',
    brand: 'Alkem Labs',
    generic: 'Pantoprazole 40mg',
    category: 'DIGESTIVE',
    packSize: '10 Tablets',
    price: 85,
    discountedPrice: 72,
    discountPercent: 15,
    requiresPrescription: true,
    inStock: true,
    description: 'Used to treat acidity, GERD, and gastric ulcers.',
  },
  {
    id: 'med-003',
    name: 'Limcee 500',
    brand: 'Abbott',
    generic: 'Vitamin C 500mg',
    category: 'VITAMINS',
    packSize: '30 Tablets',
    price: 65,
    discountedPrice: 55,
    discountPercent: 15,
    requiresPrescription: false,
    inStock: true,
    description: 'Vitamin C supplement for immunity and antioxidant support.',
  },
  {
    id: 'med-004',
    name: 'Metformin 500',
    brand: 'Sun Pharma',
    generic: 'Metformin HCl 500mg',
    category: 'DIABETES',
    packSize: '20 Tablets',
    price: 45,
    discountedPrice: 38,
    discountPercent: 16,
    requiresPrescription: true,
    inStock: true,
  },
  {
    id: 'med-005',
    name: 'Atorvastatin 20',
    brand: 'Cipla',
    generic: 'Atorvastatin 20mg',
    category: 'CARDIAC',
    packSize: '10 Tablets',
    price: 120,
    discountedPrice: 95,
    discountPercent: 21,
    requiresPrescription: true,
    inStock: true,
    description: 'Used to lower cholesterol and reduce risk of heart disease.',
  },
  {
    id: 'med-006',
    name: 'Cetirizine 10',
    brand: 'GSK',
    generic: 'Cetirizine HCl 10mg',
    category: 'COLD_FLU',
    packSize: '10 Tablets',
    price: 25,
    discountedPrice: 20,
    discountPercent: 20,
    requiresPrescription: false,
    inStock: true,
    description: 'Antihistamine for allergy relief.',
  },
];

export const MOCK_CATEGORIES: { id: MedicineCategory; label: string; emoji: string }[] = [
  { id: 'VITAMINS', label: 'Vitamins', emoji: '💊' },
  { id: 'DAILY_ESSENTIALS', label: 'Daily Essentials', emoji: '🏥' },
  { id: 'CARDIAC', label: 'Cardiac', emoji: '❤️' },
  { id: 'DIABETES', label: 'Diabetes', emoji: '🩸' },
  { id: 'PAIN_RELIEF', label: 'Pain Relief', emoji: '💆' },
  { id: 'COLD_FLU', label: 'Cold & Flu', emoji: '🤧' },
  { id: 'DIGESTIVE', label: 'Digestive', emoji: '🫁' },
  { id: 'ANTIBIOTICS', label: 'Antibiotics', emoji: '🔬' },
];

// ─── API Functions ─────────────────────────────────────────────────────────────
export async function searchMedicines(searchTerm: string): Promise<Medicine[]> {
  if (USE_MOCK_DATA) {
    await delay(400);
    if (!searchTerm.trim()) return MOCK_MEDICINES.slice(0, 6);
    return MOCK_MEDICINES.filter(
      (m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.generic ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  const { data } = await apiClient.get('/pharmacy/search', { params: { q: searchTerm } });
  return data.data;
}

export async function fetchMedicinesByCategory(
  category: MedicineCategory
): Promise<Medicine[]> {
  if (USE_MOCK_DATA) {
    await delay(500);
    return MOCK_MEDICINES.filter((m) => m.category === category);
  }
  const { data } = await apiClient.get('/pharmacy/medicines', { params: { category } });
  return data.data;
}

export async function placeOrder(payload: PlaceOrderPayload): Promise<Order> {
  if (USE_MOCK_DATA) {
    await delay(2000);
    return {
      orderId: 'ORD-' + Date.now(),
      status: 'CONFIRMED',
      items: [],
      totalAmount: payload.items.reduce((acc) => acc + 100, 0),
      estimatedDelivery: new Date(Date.now() + 2 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    };
  }
  const { data } = await apiClient.post('/pharmacy/orders', payload);
  return data.data;
}

// ─── React Query Hooks ─────────────────────────────────────────────────────────
export function useMedicineSearch(searchTerm: string) {
  return useQuery({
    queryKey: ['medicines', searchTerm],
    queryFn: () => searchMedicines(searchTerm),
    staleTime: 2 * 60 * 1000,
  });
}

export function useMedicinesByCategory(category: MedicineCategory) {
  return useQuery({
    queryKey: ['medicines', 'category', category],
    queryFn: () => fetchMedicinesByCategory(category),
    enabled: !!category,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlaceOrder() {
  return useMutation({ mutationFn: placeOrder });
}
