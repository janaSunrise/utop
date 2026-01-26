import { NextRequest } from 'next/server';
import { withAuthenticatedClient, apiSuccess, apiError, requireQueryParam } from '@/lib/api-utils';

/**
 * GET /api/vtop/timetable?semesterId=VL20252601
 * Fetch timetable for the specified semester
 */
export async function GET(request: NextRequest) {
  const semesterParam = requireQueryParam(request.nextUrl, 'semesterId');
  if ('error' in semesterParam) {
    return semesterParam.error;
  }

  return withAuthenticatedClient(async ({ client }) => {
    const timetable = await client.getTimetable(semesterParam.value);
    return apiSuccess(timetable);
  });
}
