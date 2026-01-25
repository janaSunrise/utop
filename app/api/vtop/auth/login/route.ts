import { NextRequest, NextResponse } from 'next/server';
import { VTOPClient } from '@/lib/vtop-client';
import { setSession } from '@/lib/session';
import { cookies } from 'next/headers';

const TEMP_SESSION_COOKIE = 'vtop_temp_session';
const TEMP_CSRF_COOKIE = 'vtop_temp_csrf';

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

    if (!tempSession || !tempCsrf) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'SESSION_EXPIRED', message: 'CAPTCHA session expired. Please refresh the CAPTCHA.' },
        },
        { status: 400 }
      );
    }

    const loginResult = await VTOPClient.login(tempSession, username, password, captcha, tempCsrf);

    if (!loginResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'LOGIN_FAILED', message: loginResult.message || 'Login failed' },
        },
        { status: 401 }
      );
    }

    await setSession(tempSession, tempCsrf, loginResult.user);

    cookieStore.delete(TEMP_SESSION_COOKIE);
    cookieStore.delete(TEMP_CSRF_COOKIE);

    return NextResponse.json({
      success: true,
      data: { user: loginResult.user },
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
