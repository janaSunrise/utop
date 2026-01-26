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

    // Log all cookies for debugging
    const allCookies = cookieStore.getAll();
    console.log('[Login] All cookies received:', allCookies.map(c => c.name));
    console.log('[Login] Received temp cookies:', {
      hasSession: !!tempSession,
      sessionPrefix: tempSession?.substring(0, 15),
      sessionFull: tempSession,
      hasCsrf: !!tempCsrf,
      csrfPrefix: tempCsrf?.substring(0, 15),
      csrfFull: tempCsrf,
      hasServer: !!tempServer,
      server: tempServer,
      captchaFromUser: captcha,
    });

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

    // Use new session ID if VTOP issued one (session fixation prevention)
    const finalSessionId = loginResult.newSessionId || tempSession;
    const finalCsrf = loginResult.newCsrf || tempCsrf;
    const finalServerId = loginResult.newServerId || tempServer;
    let registrationNumber = loginResult.user?.registrationNumber || '';

    console.log('[Login] Initial registrationNumber from login:', registrationNumber);

    // If no registration number found, use username as authorizedID
    // VTOP APIs may accept username for authorizedID parameter
    if (!registrationNumber) {
      console.log('[Login] No registration number found, using username as authorizedID');
      registrationNumber = username;
    }

    // Immediately fetch profile while session is active
    // VTOP sessions expire very quickly, so we must fetch data RIGHT NOW
    let profileData = null;
    let profileFetchError = null;
    try {
      console.log('[Login] Fetching profile with:', {
        jsessionidPrefix: finalSessionId?.substring(0, 10),
        csrf: finalCsrf?.substring(0, 10),
        serverId: finalServerId,
        registrationNumber,
      });
      const client = new VTOPClient(finalSessionId, finalCsrf, registrationNumber, undefined, finalServerId);
      profileData = await client.getProfile();
      console.log('[Login] Profile fetch SUCCESS, got data:', !!profileData);
      // Try to extract registration number from profile if we used username
      if (profileData?.personal?.registrationNumber) {
        registrationNumber = profileData.personal.registrationNumber;
        console.log('[Login] Got registrationNumber from profile:', registrationNumber);
      }
    } catch (e) {
      profileFetchError = e instanceof Error ? e.message : 'Unknown error';
      console.log('[Login] Profile fetch FAILED:', profileFetchError);

      // If profile fetch failed with SESSION_EXPIRED, the session is already dead
      if (profileFetchError === 'SESSION_EXPIRED') {
        return NextResponse.json({
          success: false,
          error: {
            code: 'SESSION_INVALID',
            message: 'Login succeeded but session became invalid immediately. Please try again.'
          },
        }, { status: 401 });
      }
    }

    // Store session with credentials for future re-authentication
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

    console.log('[Login] Storing session:', {
      jsessionidPrefix: finalSessionId?.substring(0, 10),
      serverId: finalServerId,
      registrationNumber,
    });

    return NextResponse.json({
      success: true,
      data: {
        user: {
          name: loginResult.user?.name || loginResult.user?.registrationNumber || username,
          registrationNumber,
        },
        // Include profile data if we managed to fetch it
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
