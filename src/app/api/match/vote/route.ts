import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';
import { calculateElo } from '@/lib/elo';
import { advanceTournamentPair } from '@/lib/matchmaking';
import { SESSION_COOKIE_NAME } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    let isNewSession = false;

    if (!sessionId) {
      sessionId = uuidv4();
      isNewSession = true;
    }

    const body = await req.json();
    const { winnerId, loserId } = body;

    if (!winnerId || !loserId || winnerId === loserId) {
      return NextResponse.json(
        { success: false, error: 'Некорректные идентификаторы участниц' },
        { status: 400 }
      );
    }

    // Защита от ботов/спама (анти-клик менее чем за 200 мс)
    const existingSession = await prisma.voteSession.findUnique({
      where: { sessionId },
    });

    if (existingSession && existingSession.lastVotedAt) {
      const msSinceLast = Date.now() - new Date(existingSession.lastVotedAt).getTime();
      if (msSinceLast < 200) {
        return NextResponse.json(
          { success: false, error: 'Слишком частые клики. Пожалуйста, не спешите.' },
          { status: 429 }
        );
      }
    }

    // Получаем участниц из БД
    const winner = await prisma.contestant.findUnique({ where: { id: winnerId } });
    const loser = await prisma.contestant.findUnique({ where: { id: loserId } });

    if (!winner || !loser) {
      return NextResponse.json(
        { success: false, error: 'Одна или обе участницы не найдены' },
        { status: 404 }
      );
    }

    // Расчет нового Elo
    const eloResult = calculateElo(
      winner.elo,
      loser.elo,
      winner.matchesCount,
      loser.matchesCount
    );

    // Выполняем транзакцию обновления данных
    const [updatedWinner, updatedLoser, , session] = await prisma.$transaction([
      prisma.contestant.update({
        where: { id: winnerId },
        data: {
          elo: eloResult.winnerNewElo,
          wins: { increment: 1 },
          matchesCount: { increment: 1 },
        },
      }),
      prisma.contestant.update({
        where: { id: loserId },
        data: {
          elo: eloResult.loserNewElo,
          losses: { increment: 1 },
          matchesCount: { increment: 1 },
        },
      }),
      prisma.match.create({
        data: {
          contestant1Id: winnerId,
          contestant2Id: loserId,
          winnerId,
          loserId,
          eloBeforeWinner: winner.elo,
          eloBeforeLoser: loser.elo,
          eloAfterWinner: eloResult.winnerNewElo,
          eloAfterLoser: eloResult.loserNewElo,
          eloDeltaWinner: eloResult.deltaWinner,
          eloDeltaLoser: eloResult.deltaLoser,
          sessionId,
        },
      }),
      prisma.voteSession.upsert({
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
      }),
    ]);

    // Продвигаем турнирную сетку пользователя
    const nextTournamentPair = await advanceTournamentPair(sessionId, winnerId);

    const response = NextResponse.json({
      success: true,
      data: {
        votesCount: session.votesCount,
        nextPair: nextTournamentPair,
        winner: {
          id: updatedWinner.id,
          name: updatedWinner.name,
          newElo: updatedWinner.elo,
          delta: eloResult.deltaWinner,
        },
        loser: {
          id: updatedLoser.id,
          name: updatedLoser.name,
          newElo: updatedLoser.elo,
          delta: eloResult.deltaLoser,
        },
      },
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
    console.error('Error recording vote:', error);
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка при записи голоса' },
      { status: 500 }
    );
  }
}
