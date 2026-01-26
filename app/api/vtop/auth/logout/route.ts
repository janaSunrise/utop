import { NextResponse } from 'next/server';
import { getSession, clearSession } from '@/lib/session';
import { clearUserCache } from '@/lib/cache';

export async function POST() {
  try {
    // Get session to clear user's cache
    const session = await getSession();
    if (session?.user?.registrationNumber) {
      clearUserCache(session.user.registrationNumber);
    }

    await clearSession();
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  } catch (error) {
    console.error('Logout error:', error);
    // Even on error, redirect to login page
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }
}
