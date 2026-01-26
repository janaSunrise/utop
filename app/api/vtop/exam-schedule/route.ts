import { NextRequest } from 'next/server';
import { withAuthenticatedClient, apiSuccess, requireQueryParam } from '@/lib/api-utils';

/**
 * GET /api/vtop/exam-schedule?semesterId=VL20252601
 * Fetch exam schedule for the specified semester
 */
export async function GET(request: NextRequest) {
  const semesterParam = requireQueryParam(request.nextUrl, 'semesterId');
  if ('error' in semesterParam) {
    return semesterParam.error;
  }

  return withAuthenticatedClient(async ({ client }) => {
    const examSchedule = await client.getExamSchedule(semesterParam.value);
    return apiSuccess(examSchedule);
  });
}
