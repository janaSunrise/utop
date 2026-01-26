import { NextRequest } from 'next/server';
import {
  withAuthenticatedClient,
  apiSuccess,
  vtopCache,
  userCacheKey,
  cacheOrFetch,
} from '@/lib/api-utils';

/**
 * GET /api/vtop/attendance
 * - Without semesterId: Returns list of available semesters
 * - With semesterId: Returns attendance data for that semester
 */
export async function GET(request: NextRequest) {
  const semesterId = request.nextUrl.searchParams.get('semesterId');

  return withAuthenticatedClient(async ({ client, session }) => {
    const regNo = session.user?.registrationNumber || '';

    // If no semesterId provided, return list of semesters
    if (!semesterId) {
      const cacheKey = userCacheKey(regNo, 'semesters');
      const semesters = await cacheOrFetch(
        vtopCache.semesters,
        cacheKey,
        () => client.getSemesters()
      );
      return apiSuccess({ semesters });
    }

    // Get attendance for specific semester with caching
    const cacheKey = userCacheKey(regNo, 'attendance', semesterId);
    const attendance = await cacheOrFetch(
      vtopCache.attendance,
      cacheKey,
      () => client.getAttendance(semesterId)
    );

    return apiSuccess(attendance);
  });
}
