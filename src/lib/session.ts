import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './prisma';

export const SESSION_COOKIE_NAME = 'univote_session_id';

export async function getSessionId(): Promise<string> {
  const cookieStore = cookies();
  let sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sid) {
    sid = uuidv4();
    try {
      cookieStore.set(SESSION_COOKIE_NAME, sid, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: '/',
      });
    } catch {
      // If called in a Server Component where setting cookies directly throws, it will be handled in route handlers
    }
  }

  return sid;
}

export async function getSessionVoteCount(sessionId: string): Promise<number> {
  const session = await prisma.voteSession.findUnique({
    where: { sessionId },
  });
  return session ? session.votesCount : 0;
}

export async function incrementSessionVoteCount(sessionId: string): Promise<number> {
  const session = await prisma.voteSession.upsert({
    where: { sessionId },
    update: {
      votesCount: { increment: 1 },
      lastVotedAt: new Date(),
    },
    create: {
      sessionId,
      votesCount: 1,
      lastVotedAt: new Date(),
    },
  });

  return session.votesCount;
}
