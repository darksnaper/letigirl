import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { getNextPair } from '@/lib/matchmaking';
import { SESSION_COOKIE_NAME } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = cookies();
    let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    let isNewSession = false;

    if (!sessionId) {
      sessionId = uuidv4();
      isNewSession = true;
    }

    const pair = await getNextPair(sessionId);

    const response = NextResponse.json({
      success: true,
      data: pair,
    });

    if (isNewSession) {
      response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('Error fetching next match pair:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при подборе пары' },
      { status: 500 }
    );
  }
}
