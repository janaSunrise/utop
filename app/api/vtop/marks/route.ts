import { NextRequest } from 'next/server';
import { withAuthenticatedClient, apiSuccess, apiError, requireQueryParam } from '@/lib/api-utils';

/**
 * GET /api/vtop/marks?semesterId=VL20252601
 * Fetch marks for the specified semester
 */
export async function GET(request: NextRequest) {
  const semesterParam = requireQueryParam(request.nextUrl, 'semesterId');
  if ('error' in semesterParam) {
    return semesterParam.error;
  }

  return withAuthenticatedClient(async ({ client }) => {
    const marks = await client.getMarks(semesterParam.value);
    return apiSuccess(marks);
  });
}
