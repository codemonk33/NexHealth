import apiClient, { USE_MOCK_DATA } from './client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  LabTest,
  LabPartner,
  LabSearchResult,
  BookLabTestPayload,
  BookingConfirmation,
  TestCategory,
} from './types';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ─── Mock Data ─────────────────────────────────────────────────────────────────
export const MOCK_POPULAR_TESTS: LabTest[] = [
  {
    id: 'test-001',
    name: 'Full Body Checkup',
    category: 'FULL_BODY',
    description: 'Comprehensive health panel covering 80+ parameters.',
    price: 1999,
    discountedPrice: 999,
    fasting: true,
    sampleType: 'BLOOD',
    turnaroundHours: 24,
    includes: ['CBC', 'Lipid Profile', 'Blood Sugar', 'Thyroid', 'Liver Function', 'Kidney Function'],
    aiPowered: true,
    popular: true,
  },
  {
    id: 'test-002',
    name: 'Fever Panel',
    category: 'FEVER',
    description: 'Detects common causes of fever including Malaria, Dengue, Typhoid.',
    price: 799,
    discountedPrice: 499,
    fasting: false,
    sampleType: 'BLOOD',
    turnaroundHours: 12,
    includes: ['CBC', 'Malaria Antigen', 'Dengue NS1', 'Widal Test', 'CRP'],
    aiPowered: true,
    popular: true,
  },
  {
    id: 'test-003',
    name: 'Thyroid Profile',
    category: 'THYROID',
    description: 'Complete thyroid function test: T3, T4, TSH.',
    price: 599,
    discountedPrice: 399,
    fasting: false,
    sampleType: 'BLOOD',
    turnaroundHours: 18,
    includes: ['T3', 'T4', 'TSH'],
    aiPowered: true,
    popular: true,
  },
  {
    id: 'test-004',
    name: 'Diabetes Panel',
    category: 'DIABETES',
    description: 'HbA1c + Fasting Blood Sugar + Post Prandial Blood Sugar.',
    price: 699,
    discountedPrice: 449,
    fasting: true,
    sampleType: 'BLOOD',
    turnaroundHours: 20,
    includes: ['HbA1c', 'FBS', 'PPBS', 'Urine Microalbumin'],
    aiPowered: true,
    popular: true,
  },
  {
    id: 'test-005',
    name: 'Cardiac Care',
    category: 'CARDIAC',
    description: 'Heart health assessment with lipid profile and cardiac markers.',
    price: 1299,
    discountedPrice: 799,
    fasting: true,
    sampleType: 'BLOOD',
    turnaroundHours: 24,
    includes: ['Lipid Profile', 'Troponin', 'CK-MB', 'ECG', 'Homocysteine'],
    aiPowered: true,
    popular: true,
  },
  {
    id: 'test-006',
    name: 'CBC Test',
    category: 'FULL_BODY',
    description: 'Complete Blood Count to evaluate overall health.',
    price: 299,
    discountedPrice: 199,
    fasting: false,
    sampleType: 'BLOOD',
    turnaroundHours: 8,
    includes: ['WBC', 'RBC', 'Platelets', 'Hemoglobin', 'Hematocrit'],
    aiPowered: false,
    popular: true,
  },
];

export const MOCK_LAB_PARTNERS: LabPartner[] = [
  {
    id: 'lab-001',
    name: 'Tata 1mg Labs',
    rating: 4.1,
    reviewCount: 2340,
    address: 'Phase I, OIDC Industrial, Timing',
    timings: '06:00 AM - 11:30 PM',
    nabl: true,
    cap: false,
    homeCollection: true,
    price: 499,
    discountedPrice: 399,
  },
  {
    id: 'lab-002',
    name: 'Thyrocare',
    rating: 4.4,
    reviewCount: 8720,
    address: 'Phase II, OIDC Industrial, Timing',
    timings: '06:00 AM - 10:00 PM',
    nabl: true,
    cap: true,
    homeCollection: true,
    price: 599,
    discountedPrice: 449,
  },
  {
    id: 'lab-003',
    name: 'Dr Lal PathLabs',
    rating: 4.6,
    reviewCount: 15200,
    address: 'Goregaon West, Mumbai',
    timings: '07:00 AM - 09:00 PM',
    nabl: true,
    cap: true,
    homeCollection: true,
    price: 749,
    discountedPrice: 549,
  },
];

// ─── API Functions ─────────────────────────────────────────────────────────────
export async function fetchPopularTests(category?: TestCategory): Promise<LabTest[]> {
  if (USE_MOCK_DATA) {
    await delay(700);
    if (category) return MOCK_POPULAR_TESTS.filter((t) => t.category === category);
    return MOCK_POPULAR_TESTS;
  }
  const { data } = await apiClient.get('/diagnostics/tests', { params: { category } });
  return data.data;
}

export async function searchLabTests(
  query: string,
  location: string
): Promise<LabSearchResult[]> {
  if (USE_MOCK_DATA) {
    await delay(900);
    const filtered = MOCK_POPULAR_TESTS.filter((t) =>
      t.name.toLowerCase().includes(query.toLowerCase())
    );
    return filtered.map((test) => ({ test, labs: MOCK_LAB_PARTNERS }));
  }
  const { data } = await apiClient.get('/diagnostics/search', {
    params: { q: query, location },
  });
  return data.data;
}

export async function fetchLabTestDetail(testId: string): Promise<LabTest> {
  if (USE_MOCK_DATA) {
    await delay(600);
    const test = MOCK_POPULAR_TESTS.find((t) => t.id === testId);
    if (!test) throw { code: 'NOT_FOUND', message: 'Test not found', statusCode: 404 };
    return test;
  }
  const { data } = await apiClient.get(`/diagnostics/tests/${testId}`);
  return data.data;
}

export async function bookLabTest(
  payload: BookLabTestPayload
): Promise<BookingConfirmation> {
  if (USE_MOCK_DATA) {
    await delay(1500);
    return {
      bookingId: 'BKG-' + Date.now(),
      status: 'CONFIRMED',
      date: payload.date,
      timeSlot: payload.timeSlot,
      labName: 'Tata 1mg Labs',
      testName: 'Selected Test',
      totalAmount: 499,
    };
  }
  const { data } = await apiClient.post('/diagnostics/book', payload);
  return data.data;
}

// ─── React Query Hooks ─────────────────────────────────────────────────────────
export function useLabTests(category?: TestCategory) {
  return useQuery({
    queryKey: ['labTests', category],
    queryFn: () => fetchPopularTests(category),
    staleTime: 10 * 60 * 1000,
  });
}

export function useLabTestSearch(query: string, location: string) {
  return useQuery({
    queryKey: ['labSearch', query, location],
    queryFn: () => searchLabTests(query, location),
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLabTestDetail(testId: string) {
  return useQuery({
    queryKey: ['labTestDetail', testId],
    queryFn: () => fetchLabTestDetail(testId),
    enabled: !!testId,
  });
}

export function useBookLabTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bookLabTest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}
