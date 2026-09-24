import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const adminSecret = process.env.ADMIN_PASSWORD || 'Matvey@1996';
  const urlKey = req.nextUrl.searchParams.get('key');

  if (urlKey !== adminSecret) {
    return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 401 });
  }

  const dbKeys = Object.keys(process.env).filter(
    (k) =>
      k.includes('POSTGRES') ||
      k.includes('DATABASE') ||
      k.includes('DB') ||
      k.includes('URL') ||
      k.includes('PRISMA')
  );

  return NextResponse.json({
    success: true,
    availableEnvKeys: dbKeys,
    hasPostgresPrismaUrl: Boolean(process.env.POSTGRES_PRISMA_URL),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasPostgresUrl: Boolean(process.env.POSTGRES_URL),
    hasPostgresNonPooling: Boolean(process.env.POSTGRES_URL_NON_POOLING),
  });
}
