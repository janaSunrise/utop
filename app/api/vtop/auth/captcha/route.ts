import { NextResponse } from 'next/server';
import { VTOPClient } from '@/lib/vtop-client';
import { cookies } from 'next/headers';

const TEMP_SESSION_COOKIE = 'vtop_temp_session';
const TEMP_CSRF_COOKIE = 'vtop_temp_csrf';

export async function GET() {
  try {
    const { captcha, jsessionid } = await VTOPClient.getCaptcha();
    const cookieStore = await cookies();

    cookieStore.set(TEMP_SESSION_COOKIE, jsessionid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 5, // 5 minutes - CAPTCHA expires quickly
    });

    cookieStore.set(TEMP_CSRF_COOKIE, captcha.csrf, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 5,
    });

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
