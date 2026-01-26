import { NextRequest, NextResponse } from 'next/server';
import { VTOPClient } from '@/lib/vtop-client';
import { getSession, setSession } from '@/lib/session';
import { cookies } from 'next/headers';

const TEMP_SESSION_COOKIE = 'vtop_temp_session';
const TEMP_CSRF_COOKIE = 'vtop_temp_csrf';
const TEMP_SERVER_COOKIE = 'vtop_temp_server';

/**
 * GET - Get a new CAPTCHA for session refresh (uses stored credentials)
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.credentials) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CREDENTIALS', message: 'No stored credentials. Please log in again.' } },
        { status: 401 }
      );
    }

    // Get fresh CAPTCHA (returns new session and serverId)
    const { captcha, jsessionid, serverId } = await VTOPClient.getCaptcha();

    // Store temp session for the refresh flow
    const cookieStore = await cookies();
    cookieStore.set(TEMP_SESSION_COOKIE, jsessionid, { httpOnly: true, path: '/', maxAge: 300 });
    cookieStore.set(TEMP_CSRF_COOKIE, captcha.csrf, { httpOnly: true, path: '/', maxAge: 300 });
    if (serverId) {
      cookieStore.set(TEMP_SERVER_COOKIE, serverId, { httpOnly: true, path: '/', maxAge: 300 });
    }

    return NextResponse.json({
      success: true,
      data: { captchaImage: captcha.captchaImage },
    });
  } catch (error) {
    console.error('Refresh captcha error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'CAPTCHA_ERROR', message: 'Failed to get CAPTCHA' } },
      { status: 500 }
    );
  }
}

/**
 * POST - Complete session refresh with CAPTCHA solution
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { captcha } = body;

    if (!captcha) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_CAPTCHA', message: 'CAPTCHA is required' } },
        { status: 400 }
      );
    }

    const session = await getSession();
    if (!session?.credentials) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CREDENTIALS', message: 'No stored credentials. Please log in again.' } },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    const tempSession = cookieStore.get(TEMP_SESSION_COOKIE)?.value;
    const tempCsrf = cookieStore.get(TEMP_CSRF_COOKIE)?.value;
    const tempServer = cookieStore.get(TEMP_SERVER_COOKIE)?.value;

    if (!tempSession || !tempCsrf) {
      return NextResponse.json(
        { success: false, error: { code: 'SESSION_EXPIRED', message: 'CAPTCHA expired. Please refresh again.' } },
        { status: 400 }
      );
    }

    // Attempt login with stored credentials (pass serverId for load balancer stickiness)
    const loginResult = await VTOPClient.login(
      tempSession,
      session.credentials.username,
      session.credentials.password,
      captcha,
      tempCsrf,
      tempServer
    );

    if (!loginResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'LOGIN_FAILED', message: loginResult.message || 'Login failed' } },
        { status: 401 }
      );
    }

    // Update session with new VTOP session (preserve serverId)
    const finalSessionId = loginResult.newSessionId || tempSession;
    const finalCsrf = loginResult.newCsrf || tempCsrf;
    const finalServerId = loginResult.newServerId || tempServer;

    await setSession(
      finalSessionId,
      finalCsrf,
      session.user,
      session.credentials,
      cookieStore,
      finalServerId
    );

    // Clean up temp cookies
    cookieStore.delete(TEMP_SESSION_COOKIE);
    cookieStore.delete(TEMP_CSRF_COOKIE);
    cookieStore.delete(TEMP_SERVER_COOKIE);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session refresh error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'REFRESH_ERROR', message: 'Session refresh failed' } },
      { status: 500 }
    );
  }
}
