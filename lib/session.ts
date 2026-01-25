import { cookies } from 'next/headers';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 30, // 30 minutes (VTOP session timeout)
};

const JSESSIONID_COOKIE = 'vtop_session';
const CSRF_COOKIE = 'vtop_csrf';
const USER_INFO_COOKIE = 'vtop_user';

export interface UserSession {
  jsessionid: string;
  csrf: string;
  user?: {
    name: string;
    registrationNumber: string;
  };
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();

  const jsessionid = cookieStore.get(JSESSIONID_COOKIE)?.value;
  const csrf = cookieStore.get(CSRF_COOKIE)?.value;

  if (!jsessionid) {
    return null;
  }

  const userInfoStr = cookieStore.get(USER_INFO_COOKIE)?.value;
  let user: UserSession['user'] | undefined;

  if (userInfoStr) {
    try {
      user = JSON.parse(decodeURIComponent(userInfoStr));
    } catch {
      // Invalid user info, ignore
    }
  }

  return { jsessionid, csrf: csrf || '', user };
}

export async function setSession(
  jsessionid: string,
  csrf: string,
  user?: { name: string; registrationNumber: string }
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(JSESSIONID_COOKIE, jsessionid, COOKIE_OPTIONS);
  cookieStore.set(CSRF_COOKIE, csrf, COOKIE_OPTIONS);

  if (user) {
    cookieStore.set(USER_INFO_COOKIE, encodeURIComponent(JSON.stringify(user)), {
      ...COOKIE_OPTIONS,
      httpOnly: false, // Client needs to read user info for UI
    });
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(JSESSIONID_COOKIE);
  cookieStore.delete(CSRF_COOKIE);
  cookieStore.delete(USER_INFO_COOKIE);
}

export async function hasValidSession(): Promise<boolean> {
  const session = await getSession();
  return session !== null && session.jsessionid.length > 0;
}

export async function refreshSession(): Promise<void> {
  const session = await getSession();
  if (session) {
    await setSession(session.jsessionid, session.csrf, session.user);
  }
}

export async function requireSession(): Promise<UserSession> {
  const session = await getSession();
  if (!session) {
    throw new SessionError('No active session', 'INVALID_SESSION');
  }
  return session;
}

export class SessionError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'SessionError';
    this.code = code;
  }
}

export async function updateCSRF(csrf: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE, csrf, COOKIE_OPTIONS);
}
