import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

function checkAdminAuth(req: NextRequest) {
  const adminSecret = (process.env.ADMIN_PASSWORD || 'Matvey@1996').trim();
  const authHeader = (req.headers.get('x-admin-key') || '').trim();
  return authHeader === adminSecret;
}

// GET: Получение всех участниц (включая неактивных) для админки
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ success: false, error: 'Неверный пароль администратора' }, { status: 401 });
  }
  try {
    const contestants = await prisma.contestant.findMany({
      orderBy: { elo: 'desc' },
    });

    const totalMatches = await prisma.match.count();
    const totalSessions = await prisma.voteSession.count();

    return NextResponse.json({
      success: true,
      data: {
        contestants,
        stats: {
          totalContestants: contestants.length,
          activeContestants: contestants.filter((c) => c.isActive).length,
          totalMatches,
          totalSessions,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching admin contestants:', error);
    return NextResponse.json({ success: false, error: 'Ошибка сервера' }, { status: 500 });
  }
}

// POST: Добавление новой участницы (поддержка FormData с файлом или JSON с photoUrl)
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ success: false, error: 'Неверный пароль администратора' }, { status: 401 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let name = '';
    let faculty = '';
    let course = 1;
    let bio = '';
    let photoUrl = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      name = formData.get('name') as string;
      faculty = formData.get('faculty') as string;
      course = parseInt(formData.get('course') as string || '1', 10);
      bio = (formData.get('bio') as string) || '';

      const photoFile = formData.get('photo') as File | null;
      if (photoFile && photoFile.size > 0) {
        const bytes = await photoFile.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        await fs.mkdir(uploadsDir, { recursive: true });

        const ext = photoFile.name.split('.').pop() || 'jpg';
        const filename = `${uuidv4()}.${ext}`;
        const filePath = path.join(uploadsDir, filename);

        await fs.writeFile(filePath, buffer);
        photoUrl = `/uploads/${filename}`;
      } else {
        photoUrl = (formData.get('photoUrl') as string) || '';
      }
    } else {
      const body = await req.json();
      name = body.name;
      faculty = body.faculty;
      course = Number(body.course) || 1;
      bio = body.bio || '';
      photoUrl = body.photoUrl || '';
    }

    if (!name || !faculty || !photoUrl) {
      return NextResponse.json(
        { success: false, error: 'Заполните обязательные поля: имя, факультет и фото' },
        { status: 400 }
      );
    }

    const contestant = await prisma.contestant.create({
      data: {
        name,
        faculty,
        course,
        bio,
        photoUrl,
        elo: 1500,
        matchesCount: 0,
        wins: 0,
        losses: 0,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, data: contestant });
  } catch (error) {
    console.error('Error creating contestant:', error);
    return NextResponse.json({ success: false, error: 'Не удалось создать участницу' }, { status: 500 });
  }
}

// PATCH: Обновление статуса, данных или замена фотографии
export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ success: false, error: 'Неверный пароль администратора' }, { status: 401 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let id = '';
    const updateData: {
      isActive?: boolean;
      name?: string;
      faculty?: string;
      course?: number;
      bio?: string;
      photoUrl?: string;
    } = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      id = formData.get('id') as string;

      if (formData.has('name')) {
        const trimmedName = ((formData.get('name') as string) || '').trim();
        if (!trimmedName) {
          return NextResponse.json({ success: false, error: 'Имя не может быть пустым' }, { status: 400 });
        }
        updateData.name = trimmedName;
      }
      if (formData.has('faculty')) updateData.faculty = formData.get('faculty') as string;
      if (formData.has('course')) updateData.course = Number(formData.get('course'));
      if (formData.has('bio')) updateData.bio = formData.get('bio') as string;
      if (formData.has('isActive')) updateData.isActive = formData.get('isActive') === 'true';

      const photoFile = formData.get('photo') as File | null;
      if (photoFile && photoFile.size > 0) {
        const bytes = await photoFile.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        await fs.mkdir(uploadsDir, { recursive: true });

        const ext = photoFile.name.split('.').pop() || 'jpg';
        const filename = `${uuidv4()}.${ext}`;
        const filePath = path.join(uploadsDir, filename);

        await fs.writeFile(filePath, buffer);
        updateData.photoUrl = `/uploads/${filename}`;
      } else if (formData.has('photoUrl') && formData.get('photoUrl')) {
        updateData.photoUrl = formData.get('photoUrl') as string;
      }
    } else {
      const body = await req.json();
      id = body.id;
      const { isActive, name, faculty, course, bio, photoUrl } = body;

      if (isActive !== undefined) updateData.isActive = isActive;
      if (name !== undefined) {
        const trimmedName = (typeof name === 'string' ? name : '').trim();
        if (!trimmedName) {
          return NextResponse.json({ success: false, error: 'Имя не может быть пустым' }, { status: 400 });
        }
        updateData.name = trimmedName;
      }
      if (faculty !== undefined) updateData.faculty = faculty;
      if (course !== undefined) updateData.course = Number(course);
      if (bio !== undefined) updateData.bio = bio;
      if (photoUrl !== undefined) updateData.photoUrl = photoUrl;
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID участницы обязателен' }, { status: 400 });
    }

    const contestant = await prisma.contestant.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: contestant });
  } catch (error) {
    console.error('Error updating contestant:', error);
    return NextResponse.json({ success: false, error: 'Не удалось обновить данные' }, { status: 500 });
  }
}

// DELETE: Удаление участницы
export async function DELETE(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ success: false, error: 'Неверный пароль администратора' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID участницы обязателен' }, { status: 400 });
    }

    await prisma.contestant.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Участница удалена' });
  } catch (error) {
    console.error('Error deleting contestant:', error);
    return NextResponse.json({ success: false, error: 'Не удалось удалить участницу' }, { status: 500 });
  }
}
