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

    const contestants = await prisma.contestant.findMany({
      where: whereClause,
    });

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
      // По умолчанию рейтинг Elo
      list.sort((a, b) => b.elo - a.elo || b.winrate - a.winrate);
    }

    // Присваиваем ранг
    const rankedList = list.map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

    // Получаем уникальные факультеты и курсы для фильтров
    const allContestants = await prisma.contestant.findMany({
      where: { isActive: true },
      select: { faculty: true, course: true },
    });

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
