import { VTOPClient } from './vtop-client';
import { getSession, setSession, clearSession } from './session';
import { cookies } from 'next/headers';

// In-memory cache of recent session validations to avoid repeated VTOP calls
const sessionValidationCache = new Map<string, { valid: boolean; timestamp: number }>();
const VALIDATION_CACHE_TTL = 30_000; // 30 seconds

/**
 * Get a validated VTOP client for the current session.
 * Throws if no valid session exists.
 */
export async function getVTOPClient(): Promise<{
  client: VTOPClient;
  session: {
    jsessionid: string;
    csrf: string;
    serverId?: string;
    registrationNumber: string;
  };
}> {
  const session = await getSession();

  if (!session || !session.jsessionid || !session.csrf) {
    throw new SessionError('No active session', 'NO_SESSION');
  }

  if (!session.user?.registrationNumber) {
    throw new SessionError('No registration number in session', 'INVALID_SESSION');
  }

  const client = new VTOPClient(
    session.jsessionid,
    session.csrf,
    session.user.registrationNumber,
    session.credentials,
    session.serverId
  );

  return {
    client,
    session: {
      jsessionid: session.jsessionid,
      csrf: session.csrf,
      serverId: session.serverId,
      registrationNumber: session.user.registrationNumber,
    },
  };
}

/**
 * Execute a VTOP operation with automatic session expiry handling.
 * If the session expires during the operation, clears the session and throws.
 */
export async function withVTOPClient<T>(
  operation: (client: VTOPClient) => Promise<T>
): Promise<T> {
  const { client } = await getVTOPClient();

  try {
    return await operation(client);
  } catch (error) {
    if (error instanceof Error && error.message === 'SESSION_EXPIRED') {
      await clearSession();
      throw new SessionError('VTOP session expired', 'SESSION_EXPIRED');
    }
    throw error;
  }
}

/**
 * Perform a fresh login and store the session.
 * Returns the client for immediate use.
 */
export async function loginAndGetClient(
  tempSession: string,
  username: string,
  password: string,
  captcha: string,
  csrf: string,
  serverId?: string | null
): Promise<{
  client: VTOPClient;
  loginResult: {
    success: boolean;
    registrationNumber: string;
    name: string;
  };
}> {
  const loginResult = await VTOPClient.login(
    tempSession,
    username,
    password,
    captcha,
    csrf,
    serverId
  );

  if (!loginResult.success) {
    throw new SessionError(loginResult.message || 'Login failed', 'LOGIN_FAILED');
  }

  const finalSessionId = loginResult.newSessionId || tempSession;
  const finalCsrf = loginResult.newCsrf || csrf;
  const finalServerId = loginResult.newServerId || serverId || undefined;

  let registrationNumber = loginResult.user?.registrationNumber || '';
  const client = new VTOPClient(
    finalSessionId,
    finalCsrf,
    registrationNumber || username,
    { username, password },
    finalServerId
  );

  // Try to get registration number from profile
  try {
    const profile = await client.getProfile();
    if (profile?.personal?.registrationNumber) {
      registrationNumber = profile.personal.registrationNumber;
      client.setRegistrationNumber(registrationNumber);
    }
  } catch {
    // Profile fetch failed, continue with what we have
  }

  if (!registrationNumber) {
    registrationNumber = username;
  }

  const cookieStore = await cookies();
  await setSession(
    finalSessionId,
    finalCsrf,
    {
      name: registrationNumber,
      registrationNumber,
      loginId: username,
    },
    { username, password },
    cookieStore,
    finalServerId
  );

  return {
    client,
    loginResult: {
      success: true,
      registrationNumber,
      name: loginResult.user?.name || registrationNumber,
    },
  };
}

/**
 * Check if current session is likely valid without making a VTOP request.
 * Uses in-memory cache to avoid repeated validation calls.
 */
export function isSessionLikelyValid(jsessionid: string): boolean {
  const cached = sessionValidationCache.get(jsessionid);
  if (cached && Date.now() - cached.timestamp < VALIDATION_CACHE_TTL) {
    return cached.valid;
  }
  return true;
}

/**
 * Mark a session as valid or invalid in the cache.
 */
export function markSessionValidity(jsessionid: string, valid: boolean): void {
  sessionValidationCache.set(jsessionid, { valid, timestamp: Date.now() });

  // Clean old entries
  for (const [key, value] of sessionValidationCache.entries()) {
    if (Date.now() - value.timestamp > VALIDATION_CACHE_TTL * 2) {
      sessionValidationCache.delete(key);
    }
  }
}

export class SessionError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'SessionError';
    this.code = code;
  }
}
