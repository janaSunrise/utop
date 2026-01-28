'use client';

import { useQuery } from '@tanstack/react-query';
import type { AttendanceData, MarksData, GradesData, Semester, ApiResponse } from '@/types/vtop';

type ApiResponseWithSemesters<T> = ApiResponse<T & { semesters?: Semester[] }>;

async function fetchWithAuth<T>(url: string): Promise<ApiResponseWithSemesters<T>> {
  const response = await fetch(url);
  return response.json();
}

/**
 * Query key factory for consistent cache keys
 */
export const queryKeys = {
  semesters: (endpoint: string) => ['semesters', endpoint] as const,
  attendance: (semesterId: string | null) => ['attendance', semesterId] as const,
  marks: (semesterId: string | null) => ['marks', semesterId] as const,
  grades: (semesterId: string | null) => ['grades', semesterId] as const,
};

/**
 * Fetch semesters from any endpoint that returns them
 */
export function useSemesters(endpoint: string) {
  return useQuery({
    queryKey: queryKeys.semesters(endpoint),
    queryFn: () => fetchWithAuth<{ semesters: Semester[] }>(endpoint),
    staleTime: 2 * 60 * 60 * 1000, // 2 hours (match server cache)
    gcTime: 4 * 60 * 60 * 1000, // 4 hours
  });
}

/**
 * Fetch attendance data for a semester
 */
export function useAttendance(semesterId: string | null) {
  return useQuery({
    queryKey: queryKeys.attendance(semesterId),
    queryFn: () => fetchWithAuth<AttendanceData>(`/api/vtop/attendance?semesterId=${semesterId}`),
    enabled: !!semesterId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Fetch marks data for a semester
 */
export function useMarks(semesterId: string | null) {
  return useQuery({
    queryKey: queryKeys.marks(semesterId),
    queryFn: () => fetchWithAuth<MarksData>(`/api/vtop/marks?semesterId=${semesterId}`),
    enabled: !!semesterId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Fetch grades data for a semester
 */
export function useGrades(semesterId: string | null) {
  return useQuery({
    queryKey: queryKeys.grades(semesterId),
    queryFn: () => fetchWithAuth<GradesData>(`/api/vtop/grades?semesterId=${semesterId}`),
    enabled: !!semesterId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
