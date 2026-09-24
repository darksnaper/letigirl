import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

import { REAL_CONTESTANTS } from '../../../../prisma/seed';

export async function POST(req: NextRequest) {
  try {
    const adminSecret = process.env.ADMIN_PASSWORD || 'Matvey@1996';
    const authHeader = req.headers.get('x-admin-key');
    if (authHeader !== adminSecret) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 401 });
    }

    // Добавляем участниц
    let createdCount = 0;
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
            bio: c.bio,
            elo: 1500,
            matchesCount: 0,
            wins: 0,
            losses: 0,
            isActive: true,
          },
        });
        createdCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Успешно добавлено ${createdCount} демо-участниц`,
      totalAdded: createdCount,
    });
  } catch (error) {
    console.error('Error seeding contestants:', error);
    return NextResponse.json({ success: false, error: 'Ошибка генерации демо-данных' }, { status: 500 });
  }
}
