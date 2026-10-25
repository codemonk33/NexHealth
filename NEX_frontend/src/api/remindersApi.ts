/**
 * Reminders API Module (Phase 2 — Health Data Integration)
 * 
 * Handles medication reminder CRUD and logging:
 * - Fetch reminders for the authenticated user
 * - Log reminder completion (taken, missed, skipped)
 * - Create, update, delete reminders
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type {
  MedicationReminder,
  ReminderLogEntry,
} from './types';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_REMINDERS: MedicationReminder[] = [
  {
    id: 'rem-1',
    medication_id: 'med-1',
    medication: {
      id: 'med-1',
      name: 'Aspirin',
      dosage: '100mg',
      frequency: 'DAILY',
    },
    time: '09:00:00',
    frequency: 'DAILY',
    days_of_week: null,
    priority: 'ROUTINE',
    is_active: true,
    status: 'UPCOMING',
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'rem-2',
    medication_id: 'med-2',
    medication: {
      id: 'med-2',
      name: 'Metformin',
      dosage: '500mg',
      frequency: 'TWICE_DAILY',
    },
    time: '14:30:00',
    frequency: 'DAILY',
    days_of_week: null,
    priority: 'NORMAL',
    is_active: true,
    status: 'DONE',
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
];

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Fetch all reminders for the authenticated patient.
 */
export async function fetchReminders(): Promise<MedicationReminder[]> {
  if (process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true') {
    await delay(600);
    return MOCK_REMINDERS;
  }

  try {
    const { data } = await apiClient.get<MedicationReminder[]>('/reminders');
    return data;
  } catch (error) {
    console.error('Failed to fetch reminders:', error);
    throw error;
  }
}

/**
 * Log a reminder as taken, missed, or skipped.
 */
export async function logReminderStatus(
  reminderId: string,
  status: 'TAKEN' | 'MISSED' | 'SKIPPED'
): Promise<ReminderLogEntry> {
  if (process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true') {
    await delay(400);
    return {
      id: `log-${Date.now()}`,
      reminder_id: reminderId,
      scheduled_date: new Date().toISOString().split('T')[0],
      status,
      logged_at: new Date().toISOString(),
    };
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await apiClient.post<ReminderLogEntry>(
      `/reminders/${reminderId}/log`,
      {
        scheduled_date: today,
        status,
      }
    );
    return data;
  } catch (error) {
    console.error('Failed to log reminder:', error);
    throw error;
  }
}

/**
 * Create a new reminder.
 */
export async function createReminder(payload: {
  medication_id: string;
  time: string;  // HH:MM:SS format
  frequency: string;
  days_of_week?: string;
  priority?: string;
}): Promise<MedicationReminder> {
  if (process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true') {
    await delay(400);
    return {
      id: `rem-${Date.now()}`,
      medication_id: payload.medication_id,
      medication: { id: '', name: '', dosage: '', frequency: '' },
      time: payload.time,
      frequency: payload.frequency,
      days_of_week: payload.days_of_week || null,
      priority: (payload.priority as any) || 'ROUTINE',
      is_active: true,
      status: 'UPCOMING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  try {
    const { data } = await apiClient.post<MedicationReminder>(
      '/reminders',
      payload
    );
    return data;
  } catch (error) {
    console.error('Failed to create reminder:', error);
    throw error;
  }
}

/**
 * Update an existing reminder.
 */
export async function updateReminder(
  reminderId: string,
  payload: Partial<{
    time: string;
    frequency: string;
    days_of_week: string;
    is_active: boolean;
    priority: string;
  }>
): Promise<MedicationReminder> {
  if (process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true') {
    await delay(400);
    const reminder = MOCK_REMINDERS.find((r) => r.id === reminderId);
    if (!reminder) throw new Error('Reminder not found');
    return { ...reminder, ...payload };
  }

  try {
    const { data } = await apiClient.put<MedicationReminder>(
      `/reminders/${reminderId}`,
      payload
    );
    return data;
  } catch (error) {
    console.error('Failed to update reminder:', error);
    throw error;
  }
}

/**
 * Delete a reminder.
 */
export async function deleteReminder(reminderId: string): Promise<void> {
  if (process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true') {
    await delay(300);
    return;
  }

  try {
    await apiClient.delete(`/reminders/${reminderId}`);
  } catch (error) {
    console.error('Failed to delete reminder:', error);
    throw error;
  }
}

/**
 * Fetch logs for a specific reminder.
 */
export async function fetchReminderLogs(
  reminderId: string
): Promise<ReminderLogEntry[]> {
  if (process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true') {
    await delay(400);
    return [];
  }

  try {
    const { data } = await apiClient.get<ReminderLogEntry[]>(
      `/reminders/${reminderId}/logs`
    );
    return data;
  } catch (error) {
    console.error('Failed to fetch reminder logs:', error);
    throw error;
  }
}

// ─── React Query Hooks ────────────────────────────────────────────────────────

export function useReminders() {
  return useQuery({
    queryKey: ['reminders'],
    queryFn: fetchReminders,
    staleTime: 3 * 60 * 1000,  // 3 minutes
  });
}

export function useLogReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reminderId, status }: { reminderId: string; status: 'TAKEN' | 'MISSED' | 'SKIPPED' }) =>
      logReminderStatus(reminderId, status),
    onSuccess: () => {
      // Invalidate reminders query to refetch updated status
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReminder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reminderId,
      payload,
    }: {
      reminderId: string;
      payload: Parameters<typeof updateReminder>[1];
    }) => updateReminder(reminderId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteReminder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

export function useReminderLogs(reminderId: string) {
  return useQuery({
    queryKey: ['reminder-logs', reminderId],
    queryFn: () => fetchReminderLogs(reminderId),
    enabled: !!reminderId,
  });
}
