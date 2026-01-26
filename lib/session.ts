import { cookies } from 'next/headers';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Session cookie configuration
const SESSION_COOKIE = 'vtop_session';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24, // 24 hours (our session, not VTOP's)
};

// Encryption key derived from secret
const SECRET = process.env.SESSION_SECRET || 'utop-session-secret-key-2024';
const ENCRYPTION_KEY = scryptSync(SECRET, 'utop-salt', 32);

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:encrypted (all base64url)
  return `${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

function decrypt(data: string): string {
  try {
    const [ivStr, authTagStr, encryptedStr] = data.split(':');
    const iv = Buffer.from(ivStr, 'base64url');
    const authTag = Buffer.from(authTagStr, 'base64url');
    const encrypted = Buffer.from(encryptedStr, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    return '';
  }
}

export interface UserSession {
  jsessionid: string;
  csrf: string;
  serverId?: string; // Load balancer stickiness cookie
  user?: {
    name: string;
    registrationNumber: string;
    loginId: string;
  };
  // Encrypted credentials for re-authentication
  credentials?: {
    username: string;
    password: string;
  };
}

interface SessionData {
  j: string; // jsessionid
  c: string; // csrf
  s?: string; // serverId
  u?: {
    n: string; // name
    r: string; // registrationNumber
    l: string; // loginId
  };
  cr?: {
    u: string; // username
    p: string; // password
  };
  e: number; // expiry timestamp
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const decrypted = decrypt(sessionCookie);
    if (!decrypted) return null;

    const data: SessionData = JSON.parse(decrypted);

    // Check if session has expired
    if (data.e && Date.now() > data.e) {
      await clearSession();
      return null;
    }

    return {
      jsessionid: data.j,
      csrf: data.c,
      serverId: data.s,
      user: data.u ? {
        name: data.u.n,
        registrationNumber: data.u.r,
        loginId: data.u.l,
      } : undefined,
      credentials: data.cr ? {
        username: data.cr.u,
        password: data.cr.p,
      } : undefined,
    };
  } catch {
    await clearSession();
    return null;
  }
}

export async function setSession(
  jsessionid: string,
  csrf: string,
  user?: { name: string; registrationNumber: string; loginId: string },
  credentials?: { username: string; password: string },
  cookieStore?: Awaited<ReturnType<typeof cookies>>,
  serverId?: string
): Promise<void> {
  const store = cookieStore || await cookies();

  const sessionData: SessionData = {
    j: jsessionid,
    c: csrf,
    e: Date.now() + (COOKIE_OPTIONS.maxAge * 1000),
  };

  if (serverId) {
    sessionData.s = serverId;
  }

  if (user) {
    sessionData.u = {
      n: user.name,
      r: user.registrationNumber,
      l: user.loginId,
    };
  }

  if (credentials) {
    sessionData.cr = {
      u: credentials.username,
      p: credentials.password,
    };
  }

  const encrypted = encrypt(JSON.stringify(sessionData));
  store.set(SESSION_COOKIE, encrypted, COOKIE_OPTIONS);
}

export async function updateSession(
  updates: Partial<{ jsessionid: string; csrf: string; serverId: string }>,
  cookieStore?: Awaited<ReturnType<typeof cookies>>
): Promise<void> {
  const session = await getSession();
  if (!session) return;

  await setSession(
    updates.jsessionid || session.jsessionid,
    updates.csrf || session.csrf,
    session.user,
    session.credentials,
    cookieStore,
    updates.serverId || session.serverId
  );
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function hasValidSession(): Promise<boolean> {
  const session = await getSession();
  return session !== null && session.jsessionid.length > 0;
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

// Helper to get user info for client-side rendering
export async function getClientUserInfo(): Promise<{ name: string; registrationNumber: string } | null> {
  const session = await getSession();
  return session?.user || null;
}
