/**
 * API Utilities for VTOP routes
 * Standardized response helpers and authenticated operation wrapper
 */

import { NextResponse } from 'next/server';
import { getSession, clearSession, type UserSession } from '@/lib/session';
import { VTOPClient } from '@/lib/vtop-client';
import { VTOPError, VTOPErrorCodes, requiresReauth } from '@/lib/vtop-errors';
import { vtopCache, userCacheKey, cacheOrFetch, CacheTTL, clearUserCache } from '@/lib/cache';

export { vtopCache, userCacheKey, cacheOrFetch, CacheTTL, clearUserCache };

/** Standard API success response */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/** Standard API error response */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/** Union type for all API responses */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Create a standardized success response
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Create a standardized error response
 */
export function apiError(
  code: string,
  message: string,
  status = 500
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

/**
 * Create an error response from a VTOPError
 */
export function apiErrorFromVTOP(error: VTOPError): NextResponse<ApiErrorResponse> {
  return apiError(error.code, error.message, error.httpStatus);
}

/** Context passed to authenticated operations */
export interface AuthenticatedContext {
  session: UserSession;
  client: VTOPClient;
}

/** Options for withAuthenticatedClient */
export interface AuthenticatedOptions {
  /** Whether registration number is required (default: true) */
  requireRegistration?: boolean;
  /** Clear session on auth errors (default: true) */
  clearOnAuthError?: boolean;
}

/**
 * Wrapper for authenticated VTOP operations
 * Handles session retrieval, client creation, and standardized error handling
 *
 * @example
 * ```ts
 * export async function GET() {
 *   return withAuthenticatedClient(async ({ client }) => {
 *     const profile = await client.getProfile();
 *     return apiSuccess(profile);
 *   });
 * }
 * ```
 */
export async function withAuthenticatedClient<T>(
  operation: (context: AuthenticatedContext) => Promise<NextResponse<T>>,
  options: AuthenticatedOptions = {}
): Promise<NextResponse<T | ApiErrorResponse>> {
  const { requireRegistration = true, clearOnAuthError = true } = options;

  try {
    const session = await getSession();

    if (!session) {
      return apiError(
        VTOPErrorCodes.UNAUTHORIZED,
        'Not authenticated. Please log in.',
        401
      );
    }

    if (requireRegistration && !session.user?.registrationNumber) {
      return apiError(
        VTOPErrorCodes.MISSING_REGISTRATION,
        'Registration number not found. Please log in again.',
        400
      );
    }

    const client = new VTOPClient(
      session.jsessionid,
      session.csrf,
      session.user?.registrationNumber,
      session.credentials,
      session.serverId
    );

    return await operation({ session, client });
  } catch (error) {
    console.error('[API] Operation error:', error);

    const vtopError = VTOPError.from(error);

    // Clear session on authentication errors
    if (clearOnAuthError && requiresReauth(error)) {
      await clearSession();
    }

    return apiErrorFromVTOP(vtopError);
  }
}

/**
 * Parse and validate a required query parameter
 */
export function requireQueryParam(
  url: URL,
  param: string
): { value: string } | { error: NextResponse<ApiErrorResponse> } {
  const value = url.searchParams.get(param);
  if (!value) {
    return {
      error: apiError(
        'MISSING_PARAMETER',
        `Missing required parameter: ${param}`,
        400
      ),
    };
  }
  return { value };
}

/**
 * Parse an optional query parameter with default value
 */
export function optionalQueryParam(
  url: URL,
  param: string,
  defaultValue: string
): string {
  return url.searchParams.get(param) || defaultValue;
}
