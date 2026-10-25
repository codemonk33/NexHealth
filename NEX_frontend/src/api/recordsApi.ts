import apiClient, { USE_MOCK_DATA } from './client';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { MedicalRecord, UploadRecordPayload, UploadRecordResponse, OcrParseStatus } from './types';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const MOCK_RECORDS: MedicalRecord[] = [
  {
    id: 'rec-001',
    title: 'CBC Report - Thyrocare',
    type: 'LAB_RESULT',
    date: '2024-11-15',
    doctor: 'Dr. Ramesh Kumar',
    hospital: 'Thyrocare Labs',
    fileUrl: '',
    fileSize: 245000,
    mimeType: 'application/pdf',
    ocrStatus: 'DONE',
    tags: ['CBC', 'Blood Test'],
  },
  {
    id: 'rec-002',
    title: 'Prescription - Dr. Sharma',
    type: 'PRESCRIPTION',
    date: '2024-11-10',
    doctor: 'Dr. Anjali Sharma',
    hospital: 'Apollo Clinic',
    fileUrl: '',
    fileSize: 180000,
    mimeType: 'image/jpeg',
    ocrStatus: 'DONE',
    tags: ['Prescription', 'Fever'],
  },
  {
    id: 'rec-003',
    title: 'Discharge Summary - Kokilaben',
    type: 'DISCHARGE_SUMMARY',
    date: '2024-10-05',
    doctor: 'Dr. Mehta',
    hospital: 'Kokilaben Dhirubhai Ambani Hospital',
    fileUrl: '',
    fileSize: 512000,
    mimeType: 'application/pdf',
    ocrStatus: 'DONE',
    tags: ['Discharge', 'Surgery'],
  },
  {
    id: 'rec-004',
    title: 'X-Ray Chest - Lal PathLabs',
    type: 'RADIOLOGY',
    date: '2024-09-20',
    hospital: 'Dr Lal PathLabs',
    fileUrl: '',
    fileSize: 1024000,
    mimeType: 'image/jpeg',
    ocrStatus: 'DONE',
    tags: ['X-Ray', 'Chest'],
  },
];

// ─── API Functions ─────────────────────────────────────────────────────────────
export async function fetchUserRecords(userId: string): Promise<MedicalRecord[]> {
  if (USE_MOCK_DATA) {
    await delay(700);
    return MOCK_RECORDS;
  }
  const { data } = await apiClient.get(`/records/${userId}`);
  return data.data;
}

export async function uploadRecord(payload: UploadRecordPayload): Promise<UploadRecordResponse> {
  if (USE_MOCK_DATA) {
    await delay(2000);
    return {
      recordId: 'rec-' + Date.now(),
      status: 'DONE',
      progress: 100,
    };
  }
  const formData = new FormData();
  formData.append('file', payload.file as unknown as Blob);
  formData.append('recordType', payload.recordType);
  const { data } = await apiClient.post('/records/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function fetchOcrStatus(recordId: string): Promise<OcrParseStatus> {
  if (USE_MOCK_DATA) {
    await delay(500);
    return { recordId, status: 'DONE', summary: 'CBC values are within normal range.' };
  }
  const { data } = await apiClient.get(`/records/${recordId}/ocr-status`);
  return data.data;
}

// ─── React Query Hooks ─────────────────────────────────────────────────────────
export function useUserRecords(userId: string) {
  return useQuery({
    queryKey: ['records', userId],
    queryFn: () => fetchUserRecords(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUploadRecord() {
  return useMutation({ mutationFn: uploadRecord });
}
