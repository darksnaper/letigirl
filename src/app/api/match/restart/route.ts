import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resetTournamentSession } from '@/lib/matchmaking';
import { SESSION_COOKIE_NAME } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cookieStore = cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (sessionId) {
      await resetTournamentSession(sessionId);
    }

    return NextResponse.json({ success: true, message: 'Турнир перезапущен' });
  } catch (error) {
    console.error('Error restarting tournament:', error);
    return NextResponse.json({ success: false, error: 'Ошибка перезапуска' }, { status: 500 });
  }
}
