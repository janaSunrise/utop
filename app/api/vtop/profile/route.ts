import { NextRequest } from 'next/server';
import {
  withAuthenticatedClient,
  apiSuccess,
  vtopCache,
  userCacheKey,
  cacheOrFetch,
} from '@/lib/api-utils';

/**
 * GET /api/vtop/profile
 * Fetch student profile data with caching
 * Use ?refresh=true to bypass cache
 */
export async function GET(request: NextRequest) {
  const refresh = request.nextUrl.searchParams.get('refresh') === 'true';

  return withAuthenticatedClient(async ({ client, session }) => {
    const regNo = session.user?.registrationNumber || '';
    const cacheKey = userCacheKey(regNo, 'profile');

    // Clear cache if refresh requested
    if (refresh) {
      vtopCache.profile.delete(cacheKey);
    }

    const profile = await cacheOrFetch(
      vtopCache.profile,
      cacheKey,
      () => client.getProfile()
    );

    return apiSuccess(profile);
  });
}
