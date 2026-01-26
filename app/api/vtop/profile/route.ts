import { withAuthenticatedClient, apiSuccess } from '@/lib/api-utils';

/**
 * GET /api/vtop/profile
 * Fetch student profile data
 */
export async function GET() {
  return withAuthenticatedClient(async ({ client }) => {
    const profile = await client.getProfile();
    return apiSuccess(profile);
  });
}
