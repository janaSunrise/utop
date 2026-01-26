import { NextRequest, NextResponse } from 'next/server';
import { getSession, clearSession } from '@/lib/session';
import { VTOPClient } from '@/lib/vtop-client';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { VTOPError, VTOPErrorCodes, requiresReauth } from '@/lib/vtop-errors';

/**
 * GET /api/vtop/attendance
 * - Without semesterId: Returns list of available semesters
 * - With semesterId: Returns attendance data for that semester
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return apiError(VTOPErrorCodes.UNAUTHORIZED, 'Not authenticated. Please log in.', 401);
    }

    if (!session.user?.registrationNumber) {
      return apiError(VTOPErrorCodes.MISSING_REGISTRATION, 'Registration number not found.', 400);
    }

    const client = new VTOPClient(
      session.jsessionid,
      session.csrf,
      session.user.registrationNumber,
      session.credentials,
      session.serverId
    );

    const semesterId = request.nextUrl.searchParams.get('semesterId');

    // If no semesterId provided, return list of semesters
    if (!semesterId) {
      const semesters = await client.getSemesters();
      return apiSuccess({ semesters });
    }

    // Get attendance for specific semester
    const attendance = await client.getAttendance(semesterId);
    return apiSuccess(attendance);
  } catch (error) {
    const vtopError = VTOPError.from(error);

    if (requiresReauth(error)) {
      await clearSession();
    }

    return apiError(vtopError.code, vtopError.message, vtopError.httpStatus);
  }
}
