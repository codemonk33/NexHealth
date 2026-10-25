/**
 * Wearables API Module (Phase 2 — Health Data Integration)
 * 
 * Handles wearable device management and data synchronization:
 * - Fetch connected wearable devices
 * - Sync step and sleep data from wearables
 * - Manage device connections
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type {
  StepLog,
  SleepRecord,
  WearableDeviceBackend,
} from './types';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_DEVICES: WearableDeviceBackend[] = [
  {
    id: 'dev-1',
    user_id: 'user-001',
    name: 'OnePlus Watch 2',
    type: 'OTHER',
    connected: true,
    last_sync: new Date(Date.now() - 900000).toISOString(),
    created_at: '2026-09-15T10:00:00Z',
    updated_at: '2026-10-17T15:30:00Z',
  },
  {
    id: 'dev-2',
    user_id: 'user-001',
    name: 'Apple Health',
    type: 'APPLE_HEALTH',
    connected: false,
    last_sync: null,
    created_at: '2026-09-20T12:00:00Z',
    updated_at: '2026-09-20T12:00:00Z',
  },
];

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Fetch all wearable devices for the authenticated user.
 */
export async function fetchWearableDevices(userId: string): Promise<WearableDeviceBackend[]> {
  if (process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true') {
    await delay(600);
    return MOCK_DEVICES;
  }

  try {
    const { data } = await apiClient.get<WearableDeviceBackend[]>(
      `/wearables/${userId}`
    );
    return data;
  } catch (error) {
    console.error('Failed to fetch wearable devices:', error);
    throw error;
  }
}

/**
 * Connect a new wearable device.
 */
export async function connectWearableDevice(
  userId: string,
  device: { name: string; type: string }
): Promise<WearableDeviceBackend> {
  if (process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true') {
    await delay(500);
    return {
      id: `dev-${Date.now()}`,
      user_id: userId,
      ...device,
      connected: true,
      last_sync: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  try {
    const { data } = await apiClient.post<WearableDeviceBackend>(
      `/wearables/${userId}`,
      device
    );
    return data;
  } catch (error) {
    console.error('Failed to connect wearable device:', error);
    throw error;
  }
}

/**
 * Update wearable device (e.g., sync status).
 */
export async function updateWearableDevice(
  userId: string,
  deviceId: string,
  updates: Partial<{ connected: boolean; last_sync: string }>
): Promise<WearableDeviceBackend> {
  if (process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true') {
    await delay(400);
    const device = MOCK_DEVICES.find((d) => d.id === deviceId);
    if (!device) throw new Error('Device not found');
    return { ...device, ...updates };
  }

  try {
    const { data } = await apiClient.put<WearableDeviceBackend>(
      `/wearables/${userId}/${deviceId}`,
      updates
    );
    return data;
  } catch (error) {
    console.error('Failed to update wearable device:', error);
    throw error;
  }
}

/**
 * Disconnect/remove a wearable device.
 */
export async function disconnectWearableDevice(
  userId: string,
  deviceId: string
): Promise<void> {
  if (process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true') {
    await delay(300);
    return;
  }

  try {
    await apiClient.delete(`/wearables/${userId}/${deviceId}`);
  } catch (error) {
    console.error('Failed to disconnect wearable device:', error);
    throw error;
  }
}

/**
 * Sync step data to the backend.
 */
export async function syncStepData(
  userId: string,
  steps: StepLog[],
  timezone?: string
): Promise<{ daily_total: number }> {
  if (process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true') {
    await delay(800);
    return { daily_total: steps.reduce((sum, s) => sum + s.step_count, 0) };
  }

  try {
    const params = {
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const { data } = await apiClient.post<{ daily_total: number }>(
      `/steps/${userId}`,
      steps,
      { params }
    );
    return data;
  } catch (error) {
    console.error('Failed to sync step data:', error);
    throw error;
  }
}

/**
 * Sync sleep data to the backend.
 */
export async function syncSleepData(
  userId: string,
  sleep: SleepRecord[],
  timezone?: string
): Promise<{ success: boolean; message: string }> {
  if (process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true') {
    await delay(800);
    return { success: true, message: 'Sleep records ingested successfully' };
  }

  try {
    const params = {
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const { data } = await apiClient.post<{ success: boolean; message: string }>(
      `/sleep/${userId}`,
      { records: sleep },
      { params }
    );
    return data;
  } catch (error) {
    console.error('Failed to sync sleep data:', error);
    throw error;
  }
}

/**
 * Sync all wearable data (steps and sleep).
 */
export async function syncAllWearableData(
  userId: string,
  steps: StepLog[],
  sleep: SleepRecord[]
): Promise<{ stepsResult: { daily_total: number }; sleepResult: { success: boolean; message: string } }> {
  if (process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true') {
    await delay(1200);
    return {
      stepsResult: { daily_total: steps.reduce((sum, s) => sum + s.step_count, 0) },
      sleepResult: { success: true, message: 'Sleep records ingested successfully' },
    };
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    const [stepsResult, sleepResult] = await Promise.all([
      steps.length > 0 ? syncStepData(userId, steps, timezone) : Promise.resolve({ daily_total: 0 }),
      sleep.length > 0 ? syncSleepData(userId, sleep, timezone) : Promise.resolve({ success: true, message: '' }),
    ]);

    return { stepsResult, sleepResult };
  } catch (error) {
    console.error('Failed to sync wearable data:', error);
    throw error;
  }
}

// ─── React Query Hooks ────────────────────────────────────────────────────────

export function useWearableDevices(userId: string) {
  return useQuery({
    queryKey: ['wearables', userId],
    queryFn: () => fetchWearableDevices(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,  // 5 minutes
  });
}

export function useConnectWearable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, device }: { userId: string; device: { name: string; type: string } }) =>
      connectWearableDevice(userId, device),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wearables', data.user_id] });
    },
  });
}

export function useDisconnectWearable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, deviceId }: { userId: string; deviceId: string }) =>
      disconnectWearableDevice(userId, deviceId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wearables', variables.userId] });
    },
  });
}

export function useSyncStepData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, steps, timezone }: { userId: string; steps: StepLog[]; timezone?: string }) =>
      syncStepData(userId, steps, timezone),
    onSuccess: (data, variables) => {
      // Invalidate health data queries to refetch updated steps
      queryClient.invalidateQueries({ queryKey: ['health', variables.userId] });
    },
  });
}

export function useSyncSleepData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, sleep, timezone }: { userId: string; sleep: SleepRecord[]; timezone?: string }) =>
      syncSleepData(userId, sleep, timezone),
    onSuccess: (data, variables) => {
      // Invalidate health data queries to refetch updated sleep
      queryClient.invalidateQueries({ queryKey: ['health', variables.userId] });
    },
  });
}

export function useSyncAllWearableData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, steps, sleep }: { userId: string; steps: StepLog[]; sleep: SleepRecord[] }) =>
      syncAllWearableData(userId, steps, sleep),
    onSuccess: (data, variables) => {
      // Invalidate health data and device queries
      queryClient.invalidateQueries({ queryKey: ['health', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['wearables', variables.userId] });
    },
  });
}
