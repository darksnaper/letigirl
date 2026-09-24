import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { REAL_CONTESTANTS } from '@/lib/contestants-data';

export const dynamic = 'force-dynamic';

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Contestant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "course" INTEGER NOT NULL DEFAULT 1,
    "photoUrl" TEXT NOT NULL,
    "bio" TEXT,
    "elo" DOUBLE PRECISION NOT NULL DEFAULT 1500.0,
    "matchesCount" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "tournamentWins" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contestant_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "Match" (
    "id" TEXT NOT NULL,
    "contestant1Id" TEXT NOT NULL,
    "contestant2Id" TEXT NOT NULL,
    "winnerId" TEXT NOT NULL,
    "loserId" TEXT NOT NULL,
    "eloBeforeWinner" DOUBLE PRECISION NOT NULL,
    "eloBeforeLoser" DOUBLE PRECISION NOT NULL,
    "eloAfterWinner" DOUBLE PRECISION NOT NULL,
    "eloAfterLoser" DOUBLE PRECISION NOT NULL,
    "eloDeltaWinner" DOUBLE PRECISION NOT NULL,
    "eloDeltaLoser" DOUBLE PRECISION NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "VoteSession" (
    "sessionId" TEXT NOT NULL,
    "votesCount" INTEGER NOT NULL DEFAULT 0,
    "lastVotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoteSession_pkey" PRIMARY KEY ("sessionId")
  );`,

  `CREATE TABLE IF NOT EXISTS "SessionPairHistory" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "contestantAId" TEXT NOT NULL,
    "contestantBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionPairHistory_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "TournamentSession" (
    "sessionId" TEXT NOT NULL,
    "currentStage" INTEGER NOT NULL DEFAULT 1,
    "stageName" TEXT NOT NULL DEFAULT 'Первый раунд',
    "activePoolIds" TEXT NOT NULL DEFAULT '[]',
    "stageWinnersIds" TEXT NOT NULL DEFAULT '[]',
    "currentPairAId" TEXT,
    "currentPairBId" TEXT,
    "matchesInStage" INTEGER NOT NULL DEFAULT 0,
    "totalInStage" INTEGER NOT NULL DEFAULT 0,
    "championId" TEXT,
    "isFinished" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentSession_pkey" PRIMARY KEY ("sessionId")
  );`,

  `CREATE INDEX IF NOT EXISTS "Match_sessionId_idx" ON "Match"("sessionId");`,
  `CREATE INDEX IF NOT EXISTS "Match_winnerId_idx" ON "Match"("winnerId");`,
  `CREATE INDEX IF NOT EXISTS "Match_loserId_idx" ON "Match"("loserId");`,
  `CREATE INDEX IF NOT EXISTS "SessionPairHistory_sessionId_idx" ON "SessionPairHistory"("sessionId");`,
];

export async function GET(req: NextRequest) {
  return handleInit(req);
}

export async function POST(req: NextRequest) {
  return handleInit(req);
}

async function handleInit(req: NextRequest) {
  try {
    const adminSecret = process.env.ADMIN_PASSWORD || 'Matvey@1996';
    const authHeader = req.headers.get('x-admin-key');
    const urlKey = req.nextUrl.searchParams.get('key');

    if (authHeader !== adminSecret && urlKey !== adminSecret) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 401 });
    }

    // 1. Создаем таблицы DDL
    for (const sql of DDL_STATEMENTS) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (err: any) {
        console.warn('DDL note:', err?.message);
      }
    }

    // 2. Наполняем базу 27 девушками, если их нет
    let addedCount = 0;
    for (const c of REAL_CONTESTANTS) {
      const existing = await prisma.contestant.findFirst({
        where: { name: c.name },
      });

      if (!existing) {
        await prisma.contestant.create({
          data: {
            name: c.name,
            faculty: c.faculty,
            course: c.course,
            photoUrl: c.photoUrl,
            bio: c.bio || '',
            elo: 1500,
            matchesCount: 0,
            wins: 0,
            losses: 0,
            tournamentWins: 0,
            isActive: true,
          },
        });
        addedCount++;
      }
    }

    const totalInDb = await prisma.contestant.count();

    return NextResponse.json({
      success: true,
      message: `База данных успешно инициализирована! Добавлено: ${addedCount}, всего участниц в базе: ${totalInDb}`,
      totalContestants: totalInDb,
      addedNow: addedCount,
    });
  } catch (error: any) {
    console.error('Database init error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Ошибка инициализации базы',
        details: String(error),
      },
      { status: 500 }
    );
  }
}
