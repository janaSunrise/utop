import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'LOGOUT_ERROR', message: error instanceof Error ? error.message : 'An error occurred during logout' },
      },
      { status: 500 }
    );
  }
}
