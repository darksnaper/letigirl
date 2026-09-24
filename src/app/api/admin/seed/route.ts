import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const SAMPLE_CONTESTANTS = [
  {
    name: 'Алина Воронина',
    faculty: 'Экономический',
    course: 3,
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800&auto=format&fit=crop',
    bio: 'Люблю шахматы, теннис и финансовую аналитику.',
  },
  {
    name: 'Екатерина Смирнова',
    faculty: 'Факультет ИТ и Робототехники',
    course: 2,
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800&auto=format&fit=crop',
    bio: 'Fullstack-разработчица, обожаю Python и дизайн интерфейсов.',
  },
  {
    name: 'Мария Кузнецова',
    faculty: 'Юридический',
    course: 4,
    photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=800&auto=format&fit=crop',
    bio: 'Увлекаюсь дебатами, международным правом и конным спортом.',
  },
  {
    name: 'София Лебедева',
    faculty: 'Медицинский институт',
    course: 3,
    photoUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=800&auto=format&fit=crop',
    bio: 'Будущий хирург, волонтер, играю на фортепиано.',
  },
  {
    name: 'Анна Морозова',
    faculty: 'Журналистика и медиа',
    course: 1,
    photoUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?q=80&w=800&auto=format&fit=crop',
    bio: 'Веду подкаст об университетской жизни и делаю репортажи.',
  },
  {
    name: 'Дарья Новикова',
    faculty: 'Архитектурный',
    course: 4,
    photoUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=800&auto=format&fit=crop',
    bio: 'Проектирую общественные пространства и пишу акварелью.',
  },
  {
    name: 'Полина Ковалева',
    faculty: 'Факультет ИТ и Робототехники',
    course: 1,
    photoUrl: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?q=80&w=800&auto=format&fit=crop',
    bio: 'Олимпиадное программирование, киберспорт и нейросети.',
  },
  {
    name: 'Валерия Попова',
    faculty: 'Лингвистика и перевод',
    course: 2,
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop',
    bio: 'Говорю на 4 языках, люблю французское кино и путешествия.',
  },
  {
    name: 'Виктория Соколова',
    faculty: 'Биоинженерия',
    course: 3,
    photoUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=800&auto=format&fit=crop',
    bio: 'Исследую генетику растений и занимаюсь йогой.',
  },
  {
    name: 'Анастасия Федорова',
    faculty: 'Экономический',
    course: 2,
    photoUrl: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?q=80&w=800&auto=format&fit=crop',
    bio: 'Стартапы, маркетинг и современная хореография.',
  },
  {
    name: 'Ксения Романова',
    faculty: 'Журналистика и медиа',
    course: 3,
    photoUrl: 'https://images.unsplash.com/photo-1514315384763-ba401779410f?q=80&w=800&auto=format&fit=crop',
    bio: 'Фотограф, организатор студенческих фестивалей.',
  },
  {
    name: 'Елизавета Козлова',
    faculty: 'Юридический',
    course: 1,
    photoUrl: 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?q=80&w=800&auto=format&fit=crop',
    bio: 'КМС по легкой атлетике, активистка студенческого совета.',
  },
];

export async function POST(req: NextRequest) {
  try {
    const adminSecret = process.env.ADMIN_PASSWORD || 'Matvey@1996';
    const authHeader = req.headers.get('x-admin-key');
    if (authHeader !== adminSecret) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 401 });
    }

    // Добавляем участниц
    let createdCount = 0;
    for (const c of SAMPLE_CONTESTANTS) {
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
