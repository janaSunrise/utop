import { withAuthenticatedClient, apiSuccess } from '@/lib/api-utils';

/**
 * GET /api/vtop/curriculum
 * Fetch curriculum data
 */
export async function GET() {
  return withAuthenticatedClient(async ({ client }) => {
    const curriculum = await client.getCurriculum();
    return apiSuccess(curriculum);
  });
}
