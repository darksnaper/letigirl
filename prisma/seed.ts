import { PrismaClient } from '@prisma/client';
import { REAL_CONTESTANTS } from '../src/lib/contestants-data';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding ' + REAL_CONTESTANTS.length + ' contestants...');
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
          tournamentWins: 0,
          isActive: true,
        },
      });
      console.log('Created: ' + c.name);
    } else {
      console.log('Already exists: ' + c.name);
    }
  }
  console.log('Seeding finished!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
