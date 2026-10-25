import apiClient, { USE_MOCK_DATA } from './client';
import { useQuery } from '@tanstack/react-query';
import type { HealthData, WearableDevice } from './types';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const MOCK_HEALTH_DATA: HealthData = {
  score: { score: 79, maxScore: 100, label: 'Good', lastUpdated: new Date().toISOString() },
  steps: {
    label: 'Steps',
    value: 5000,
    unit: 'steps',
    trend: 'up',
    timestamp: new Date().toISOString(),
  },
  heartRate: {
    label: 'Heart Rate',
    value: 89,
    unit: 'BPM',
    trend: 'stable',
    timestamp: new Date().toISOString(),
  },
  sleep: {
    label: 'Sleep',
    value: 9,
    unit: 'hr',
    trend: 'down',
    timestamp: new Date().toISOString(),
  },
  bloodOxygen: {
    label: 'SpO2',
    value: 98,
    unit: '%',
    trend: 'stable',
    timestamp: new Date().toISOString(),
  },
  history: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 86400000).toISOString(),
    steps: 3000 + Math.floor(Math.random() * 4000),
    heartRate: 72 + Math.floor(Math.random() * 20),
    sleepHours: 6 + Math.random() * 3,
  })),
};

const MOCK_DEVICES: WearableDevice[] = [
  {
    id: 'dev-1',
    name: 'OnePlus Watch 2',
    type: 'OTHER',
    connected: true,
    lastSync: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: 'dev-2',
    name: 'Apple Health',
    type: 'APPLE_HEALTH',
    connected: false,
  },
  {
    id: 'dev-3',
    name: 'Google Health Connect',
    type: 'GOOGLE_HEALTH',
    connected: false,
  },
];

// ─── Helper: Transform backend DailyHealthRecord to frontend HealthData ──────
function transformDailyRecordsToHealthData(records: any[]): HealthData {
  // Sort records by date descending (most recent first)
  const sorted = [...records].sort((a, b) => 
    new Date(b.record_date).getTime() - new Date(a.record_date).getTime()
  );

  // Get current values from most recent record
  const current = sorted[0] || {};
  const today = new Date();

  // Compute trends by comparing today vs 7 days ago
  const sevenDaysAgo = sorted.find((r) => {
    const recordDate = new Date(r.record_date);
    return (today.getTime() - recordDate.getTime()) >= 7 * 86400000;
  });

  const stepTrend = (() => {
    if (!current.step_count || !sevenDaysAgo?.step_count) return 'stable';
    return current.step_count > sevenDaysAgo.step_count ? 'up' : 
           current.step_count < sevenDaysAgo.step_count ? 'down' : 'stable';
  })();

  const sleepTrend = (() => {
    if (!current.sleep_hours || !sevenDaysAgo?.sleep_hours) return 'stable';
    return current.sleep_hours > sevenDaysAgo.sleep_hours ? 'up' : 
           current.sleep_hours < sevenDaysAgo.sleep_hours ? 'down' : 'stable';
  })();

  // Build history (last 7 days)
  const history = sorted.slice(0, 7).reverse().map((r) => ({
    date: r.record_date,
    steps: r.step_count || 0,
    heartRate: r.heart_rate || 0,
    sleepHours: r.sleep_hours || 0,
  }));

  // Compute health score label
  const score = current.health_score || 75;
  const label = score >= 85 ? 'Excellent' :
                score >= 70 ? 'Good' :
                score >= 50 ? 'Fair' : 'Poor';

  return {
    score: {
      score,
      maxScore: 100,
      label,
      lastUpdated: current.record_date || today.toISOString(),
    },
    steps: {
      label: 'Steps',
      value: current.step_count || 0,
      unit: 'steps',
      trend: stepTrend,
      timestamp: current.record_date || today.toISOString(),
    },
    heartRate: {
      label: 'Heart Rate',
      value: current.heart_rate || 85,
      unit: 'BPM',
      trend: 'stable',
      timestamp: current.record_date || today.toISOString(),
    },
    sleep: {
      label: 'Sleep',
      value: current.sleep_hours || 7,
      unit: 'hr',
      trend: sleepTrend,
      timestamp: current.record_date || today.toISOString(),
    },
    bloodOxygen: {
      label: 'SpO2',
      value: current.blood_oxygen || 98,
      unit: '%',
      trend: 'stable',
      timestamp: current.record_date || today.toISOString(),
    },
    history,
  };
}

// ─── API Functions ─────────────────────────────────────────────────────────────

/**
 * Fetch health data for a user over a date range.
 * Transforms backend DailyHealthRecord array to frontend HealthData shape.
 */
export async function fetchHealthData(userId: string, daysBack: number = 7): Promise<HealthData> {
  if (USE_MOCK_DATA) {
    await delay(800);
    return MOCK_HEALTH_DATA;
  }

  try {
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - daysBack * 86400000);
    
    const { data } = await apiClient.get<any[]>(`/daily-health/${userId}`, {
      params: {
        from_date: fromDate.toISOString().split('T')[0],
        to_date: toDate.toISOString().split('T')[0],
      },
    });

    return transformDailyRecordsToHealthData(data);
  } catch (error) {
    console.error('Failed to fetch health data:', error);
    // Fallback to mock data on error
    return MOCK_HEALTH_DATA;
  }
}

/**
 * Fetch wearable devices for a user.
 */
export async function fetchWearableDevices(userId: string): Promise<WearableDevice[]> {
  if (USE_MOCK_DATA) {
    await delay(600);
    return MOCK_DEVICES;
  }

  try {
    const { data } = await apiClient.get<any[]>(`/wearables/${userId}`);
    // Transform backend WearableDeviceBackend to frontend WearableDevice
    return data.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      connected: d.connected,
      lastSync: d.last_sync,
    }));
  } catch (error) {
    console.error('Failed to fetch wearable devices:', error);
    // Fallback to mock data on error
    return MOCK_DEVICES;
  }
}

// ─── React Query Hooks ─────────────────────────────────────────────────────────
export function useHealthData(userId: string) {
  return useQuery({
    queryKey: ['health', userId],
    queryFn: () => fetchHealthData(userId),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  });
}

export function useWearableDevices(userId: string) {
  return useQuery({
    queryKey: ['devices', userId],
    queryFn: () => fetchWearableDevices(userId),
    enabled: !!userId,
  });
}
