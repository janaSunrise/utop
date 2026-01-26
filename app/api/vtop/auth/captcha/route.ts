import { NextResponse } from 'next/server';
import { VTOPClient } from '@/lib/vtop-client';
import { cookies } from 'next/headers';

const TEMP_SESSION_COOKIE = 'vtop_temp_session';
const TEMP_CSRF_COOKIE = 'vtop_temp_csrf';
const TEMP_SERVER_COOKIE = 'vtop_temp_server';

export async function GET() {
  try {
    const { captcha, jsessionid, serverId } = await VTOPClient.getCaptcha();
    const cookieStore = await cookies();

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 5, // 5 minutes - CAPTCHA expires quickly
    };

    cookieStore.set(TEMP_SESSION_COOKIE, jsessionid, cookieOptions);
    cookieStore.set(TEMP_CSRF_COOKIE, captcha.csrf, cookieOptions);
    cookieStore.set(TEMP_SERVER_COOKIE, serverId || '', cookieOptions);

    return NextResponse.json({
      success: true,
      data: { captchaImage: captcha.captchaImage },
    });
  } catch (error) {
    console.error('CAPTCHA fetch error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CAPTCHA_FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch CAPTCHA',
        },
      },
      { status: 500 }
    );
  }
}
