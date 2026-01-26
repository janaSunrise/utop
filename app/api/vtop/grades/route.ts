import { withAuthenticatedClient, apiSuccess } from '@/lib/api-utils';

/**
 * GET /api/vtop/grades
 * Fetch grade history (all semesters)
 */
export async function GET() {
  return withAuthenticatedClient(async ({ client }) => {
    const grades = await client.getGrades();
    return apiSuccess(grades);
  });
}
