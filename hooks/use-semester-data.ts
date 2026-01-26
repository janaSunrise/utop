'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { Semester } from '@/types/vtop';

interface ApiResponse<T> {
  success: boolean;
  data?: T & { semesters?: Semester[] };
  error?: { code?: string; message?: string };
}

interface UseSemesterDataOptions {
  /** Endpoint for fetching semesters list */
  semestersEndpoint: string;
  /** Endpoint for fetching data (will append ?semesterId=xxx) */
  dataEndpoint: string;
  /** Stale time for data cache (default: 5 minutes) */
  staleTime?: number;
}

interface UseSemesterDataReturn<T> {
  semesters: Semester[];
  selectedSemester: string;
  setSelectedSemester: (id: string) => void;
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

async function fetchWithAuth<T>(url: string): Promise<ApiResponse<T>> {
  const response = await fetch(url);
  return response.json();
}

/**
 * Shared hook for semester-based data fetching with React Query caching.
 * Handles: semesters fetch, semester selection, data fetch, error/loading states, session expiry.
 */
export function useSemesterData<T>(
  options: UseSemesterDataOptions
): UseSemesterDataReturn<T> {
  const { semestersEndpoint, dataEndpoint, staleTime = 5 * 60 * 1000 } = options;
  const router = useRouter();

  const [selectedSemester, setSelectedSemester] = useState<string>('');

  // Fetch semesters
  const semestersQuery = useQuery({
    queryKey: ['semesters', semestersEndpoint],
    queryFn: () => fetchWithAuth<{ semesters: Semester[] }>(semestersEndpoint),
    staleTime: 2 * 60 * 60 * 1000, // 2 hours for semesters
    gcTime: 4 * 60 * 60 * 1000,
  });

  // Fetch data for selected semester
  const dataQuery = useQuery({
    queryKey: ['semesterData', dataEndpoint, selectedSemester],
    queryFn: () => fetchWithAuth<T>(`${dataEndpoint}?semesterId=${selectedSemester}`),
    enabled: !!selectedSemester,
    staleTime,
    gcTime: 30 * 60 * 1000,
  });

  // Handle auth errors
  const handleAuthError = useCallback((errorData?: { code?: string }) => {
    if (errorData?.code === 'SESSION_EXPIRED' || errorData?.code === 'UNAUTHORIZED') {
      router.push('/login');
      return true;
    }
    return false;
  }, [router]);

  // Check for auth errors in responses
  useEffect(() => {
    if (semestersQuery.data && !semestersQuery.data.success) {
      handleAuthError(semestersQuery.data.error);
    }
  }, [semestersQuery.data, handleAuthError]);

  useEffect(() => {
    if (dataQuery.data && !dataQuery.data.success) {
      handleAuthError(dataQuery.data.error);
    }
  }, [dataQuery.data, handleAuthError]);

  // Auto-select current semester when semesters load
  useEffect(() => {
    if (semestersQuery.data?.success && semestersQuery.data.data?.semesters?.length && !selectedSemester) {
      const semesters = semestersQuery.data.data.semesters;
      const current = semesters.find((s) => s.isCurrent) || semesters[0];
      setSelectedSemester(current.id);
    }
  }, [semestersQuery.data, selectedSemester]);

  // Derive state
  const semesters = semestersQuery.data?.data?.semesters || [];
  const data = dataQuery.data?.success ? (dataQuery.data.data as T) : null;
  const loading = semestersQuery.isLoading || (!!selectedSemester && dataQuery.isLoading);

  // Compute error message
  let error: string | null = null;
  if (semestersQuery.error) {
    error = 'Failed to connect to server';
  } else if (semestersQuery.data && !semestersQuery.data.success) {
    error = semestersQuery.data.error?.message || 'Failed to load semesters';
  } else if (dataQuery.error) {
    error = 'Failed to connect to server';
  } else if (dataQuery.data && !dataQuery.data.success) {
    error = dataQuery.data.error?.message || 'Failed to load data';
  }

  const refetch = useCallback(() => {
    dataQuery.refetch();
  }, [dataQuery]);

  return {
    semesters,
    selectedSemester,
    setSelectedSemester,
    data,
    loading,
    error,
    refetch,
  };
}
