import { NextRequest, NextResponse } from 'next/server';
import { withAuthenticatedClient, apiSuccess } from '@/lib/api-utils';

/**
 * GET /api/vtop/grades
 * GET /api/vtop/grades?semesterId=VL20252601
 * Fetch grades - returns semesters if no semesterId, or grades for specific semester
 */
export async function GET(request: NextRequest) {
  const semesterId = request.nextUrl.searchParams.get('semesterId');

  if (semesterId) {
    return withAuthenticatedClient(async ({ client }) => {
      const grades = await client.getGrades(semesterId);
      return apiSuccess(grades);
    });
  }

  // Return semesters list (reuse from attendance endpoint logic)
  return withAuthenticatedClient(async ({ client }) => {
    const semesters = await client.getSemesters();
    return apiSuccess({ semesters });
  }) as Promise<NextResponse>;
}
