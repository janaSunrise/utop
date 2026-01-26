import { NextRequest, NextResponse } from 'next/server';
import { VTOPClient } from '@/lib/vtop-client';
import { setSession } from '@/lib/session';
import { cookies } from 'next/headers';

const TEMP_SESSION_COOKIE = 'vtop_temp_session';
const TEMP_CSRF_COOKIE = 'vtop_temp_csrf';
const TEMP_SERVER_COOKIE = 'vtop_temp_server';

interface LoginRequestBody {
  username: string;
  password: string;
  captcha: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequestBody = await request.json();
    const { username, password, captcha } = body;

    if (!username || !password || !captcha) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'Username, password, and CAPTCHA are required' },
        },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const tempSession = cookieStore.get(TEMP_SESSION_COOKIE)?.value;
    const tempCsrf = cookieStore.get(TEMP_CSRF_COOKIE)?.value;
    const tempServer = cookieStore.get(TEMP_SERVER_COOKIE)?.value;

    if (!tempSession || !tempCsrf) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'SESSION_EXPIRED', message: 'CAPTCHA session expired. Please refresh the CAPTCHA.' },
        },
        { status: 400 }
      );
    }

    const loginResult = await VTOPClient.login(tempSession, username, password, captcha, tempCsrf, tempServer);

    if (!loginResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'LOGIN_FAILED', message: loginResult.message || 'Login failed' },
        },
        { status: 401 }
      );
    }

    const finalSessionId = loginResult.newSessionId || tempSession;
    const finalCsrf = loginResult.newCsrf || tempCsrf;
    const finalServerId = loginResult.newServerId || tempServer;
    let registrationNumber = loginResult.user?.registrationNumber || '';

    // Use username as authorizedID if no registration number found
    if (!registrationNumber) {
      registrationNumber = username;
    }

    // Fetch profile while session is active (VTOP sessions expire quickly)
    let profileData = null;
    try {
      const client = new VTOPClient(finalSessionId, finalCsrf, registrationNumber, undefined, finalServerId);
      profileData = await client.getProfile();
      if (profileData?.personal?.registrationNumber) {
        registrationNumber = profileData.personal.registrationNumber;
      }
    } catch (e) {
      // If profile fetch failed with SESSION_EXPIRED, the session is already dead
      if (e instanceof Error && e.message === 'SESSION_EXPIRED') {
        return NextResponse.json({
          success: false,
          error: {
            code: 'SESSION_INVALID',
            message: 'Login succeeded but session became invalid immediately. Please try again.'
          },
        }, { status: 401 });
      }
    }

    await setSession(
      finalSessionId,
      finalCsrf,
      {
        name: registrationNumber || username,
        registrationNumber,
        loginId: username,
      },
      { username, password },
      cookieStore,
      finalServerId
    );

    // Clean up temp cookies
    cookieStore.delete(TEMP_SESSION_COOKIE);
    cookieStore.delete(TEMP_CSRF_COOKIE);
    cookieStore.delete(TEMP_SERVER_COOKIE);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          name: loginResult.user?.name || loginResult.user?.registrationNumber || username,
          registrationNumber,
        },
        profile: profileData,
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    return NextResponse.json(
      {
        success: false,
        error: { code: 'LOGIN_ERROR', message: error instanceof Error ? error.message : 'An error occurred during login' },
      },
      { status: 500 }
    );
  }
}
