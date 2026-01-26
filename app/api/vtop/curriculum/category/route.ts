import { NextRequest } from 'next/server';
import { withAuthenticatedClient, apiSuccess, apiError } from '@/lib/api-utils';

/**
 * GET /api/vtop/curriculum/category?categoryId=NC
 * Fetch courses for a specific curriculum category
 */
export async function GET(request: NextRequest) {
  const categoryId = request.nextUrl.searchParams.get('categoryId');

  if (!categoryId) {
    return apiError('VALIDATION_ERROR', 'categoryId is required');
  }

  return withAuthenticatedClient(async ({ client }) => {
    const courses = await client.getCurriculumCategoryCourses(categoryId);
    return apiSuccess({ courses });
  });
}
