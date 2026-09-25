import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const faculty = searchParams.get('faculty');
    const course = searchParams.get('course');
    const sortBy = searchParams.get('sort') || 'elo'; // 'elo' | 'winrate' | 'matches'
    const search = searchParams.get('search')?.trim().toLowerCase();

    // Фильтры
    const whereClause: {
      isActive: boolean;
      faculty?: string;
      course?: number;
      name?: { contains: string };
    } = {
      isActive: true,
    };

    if (faculty && faculty !== 'all') {
      whereClause.faculty = faculty;
    }

    if (course && course !== 'all') {
      const courseNum = parseInt(course, 10);
      if (!isNaN(courseNum)) {
        whereClause.course = courseNum;
      }
    }

    if (search) {
      whereClause.name = { contains: search };
    }

    const [contestants, matches, allContestants] = await Promise.all([
      prisma.contestant.findMany({
        where: whereClause,
      }),
      prisma.match.findMany({
        select: {
          winnerId: true,
          loserId: true,
        },
      }),
      prisma.contestant.findMany({
        where: { isActive: true },
        select: { faculty: true, course: true },
      }),
    ]);

    // Карта результатов личных встреч (Head-to-Head)
    const h2hCounts = new Map<string, number>();
    for (const m of matches) {
      const key = `${m.winnerId}_${m.loserId}`;
      h2hCounts.set(key, (h2hCounts.get(key) || 0) + 1);
    }

    const getH2H = (c1Id: string, c2Id: string) => {
      return h2hCounts.get(`${c1Id}_${c2Id}`) || 0;
    };

    // Добавляем вычисленный winrate и форматируем
    const list = contestants.map((c) => {
      const winrate = c.matchesCount > 0 ? Math.round((c.wins / c.matchesCount) * 100) : 0;
      return {
        ...c,
        winrate,
      };
    });

    // Сортировка
    if (sortBy === 'winrate') {
      list.sort((a, b) => b.winrate - a.winrate || b.elo - a.elo);
    } else if (sortBy === 'matches') {
      list.sort((a, b) => b.matchesCount - a.matchesCount || b.elo - a.elo);
    } else {
      // По умолчанию рейтинг Elo с учетом Head-to-Head (очных встреч) при разнице <= 3 Elo
      list.sort((a, b) => {
        const eloDiff = Math.abs(a.elo - b.elo);
        // Если разница больше статистической погрешности (3 очка), решает Elo
        if (eloDiff > 3) {
          return b.elo - a.elo;
        }

        // В пределах статистической погрешности (<= 3 очков):
        // 1. Очные встречи (Head-to-Head): кто побеждал чаще в личных дуэлях
        const h2hA = getH2H(a.id, b.id);
        const h2hB = getH2H(b.id, a.id);
        if (h2hA !== h2hB) {
          return h2hB - h2hA;
        }

        // 2. Если личные встречи равны (или не играли друг с другом), преимущество у более высокого Elo
        if (b.elo !== a.elo) {
          return b.elo - a.elo;
        }

        // 3. Общий винрейт
        if (b.winrate !== a.winrate) {
          return b.winrate - a.winrate;
        }

        // 4. Общее количество побед
        return b.wins - a.wins;
      });
    }

    // Присваиваем ранг
    const rankedList = list.map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

    const faculties = Array.from(new Set(allContestants.map((c) => c.faculty))).sort();
    const courses = Array.from(new Set(allContestants.map((c) => c.course))).sort((a, b) => a - b);

    return NextResponse.json({
      success: true,
      data: {
        contestants: rankedList,
        filters: {
          faculties,
          courses,
        },
        totalCount: rankedList.length,
      },
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения таблицы лидеров' },
      { status: 500 }
    );
  }
}
