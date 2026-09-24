import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const adminSecret = (process.env.ADMIN_PASSWORD || 'Matvey@1996').trim();
    const authHeader = (req.headers.get('x-admin-key') || '').trim();
    if (authHeader !== adminSecret) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 401 });
    }

    const { action } = await req.json(); // 'reset_stats' | 'clear_all'

    if (action === 'clear_all') {
      await prisma.match.deleteMany();
      await prisma.sessionPairHistory.deleteMany();
      await prisma.tournamentSession.deleteMany();
      await prisma.voteSession.deleteMany();
      await prisma.contestant.deleteMany();

      return NextResponse.json({
        success: true,
        message: 'Все участницы и история голосований полностью удалены',
      });
    }

    // Default: сброс статистики, турниров и Elo
    await prisma.match.deleteMany();
    await prisma.sessionPairHistory.deleteMany();
    await prisma.tournamentSession.deleteMany();
    await prisma.voteSession.deleteMany();
    await prisma.contestant.updateMany({
      data: {
        elo: 1500,
        matchesCount: 0,
        wins: 0,
        losses: 0,
        tournamentWins: 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Все рейтинги успешно сброшены до 1500, история очищена',
    });
  } catch (error) {
    console.error('Error resetting contest:', error);
    return NextResponse.json({ success: false, error: 'Ошибка сброса данных' }, { status: 500 });
  }
}
