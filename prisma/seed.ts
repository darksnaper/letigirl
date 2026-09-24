import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const REAL_CONTESTANTS = [
  {
    "name": "Злата Товстоног",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/b0e17b36-9812-4785-855c-89bb0cd94512.png",
    "bio": ""
  },
  {
    "name": "Виктория Виюжанина",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/82efd8a4-1cd6-4301-b56a-118ca7a291f2.jpg",
    "bio": ""
  },
  {
    "name": "Карина Бокова",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/733f0b1e-1586-4882-be30-41bab932fe07.png",
    "bio": ""
  },
  {
    "name": "Алина Чистякова",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/b148cf0b-01b2-488d-9a4c-71d940927c94.png",
    "bio": ""
  },
  {
    "name": "Лера Червонец",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/ac38b806-5718-44e9-84d1-dff1fc1a51f7.jpg",
    "bio": ""
  },
  {
    "name": "Дарья Кондрашова",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/6acdf058-c95d-45dc-a6e3-0544c1c27e13.png",
    "bio": ""
  },
  {
    "name": "Вика Купова",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/d54ce30e-bd2f-41a6-b35b-d03e1a004959.jpg",
    "bio": ""
  },
  {
    "name": "Оля Нестеренко",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/ccd1bace-a375-428f-8540-03e394b74781.png",
    "bio": ""
  },
  {
    "name": "Анна Кравцова",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/390a77b2-feb1-44f8-896c-a3450f3ae1b9.jpg",
    "bio": ""
  },
  {
    "name": "Марина Каравашкина",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/c501a1c3-e40a-46ec-a542-330cf14f72bb.jpg",
    "bio": ""
  },
  {
    "name": "Ксюша Коробкова",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/6445fcb2-0bc8-41b9-93c2-584d437bf28c.jpg",
    "bio": ""
  },
  {
    "name": "Александрия Рид",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/c56c2345-3d9a-461e-bbcf-12cbf02c0b5b.jpg",
    "bio": ""
  },
  {
    "name": "София Прокопчук",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/78264f61-b0d1-4126-8c31-bf290818a62e.jpg",
    "bio": ""
  },
  {
    "name": "Ксения Потапенко",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/0384d817-993b-4b3a-a236-e0f0584da694.jpg",
    "bio": ""
  },
  {
    "name": "Лера Суркова",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/1d8063a5-86aa-4442-9e0b-0ee75759af7b.png",
    "bio": ""
  },
  {
    "name": "Ксюша 88",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/6e555dbe-1035-40d4-b085-a3793663dc68.jpg",
    "bio": ""
  },
  {
    "name": "Александра Федорова",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/54715dcf-8931-4200-9aaf-e6129c5f97ac.jpg",
    "bio": ""
  },
  {
    "name": "Ралина Валиева",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/486d7b31-be6e-4a01-b925-0dffe59bfe08.jpg",
    "bio": ""
  },
  {
    "name": "Настя Тайманова",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/984e48af-abf5-45dc-81cd-84e6aa32c7df.jpg",
    "bio": ""
  },
  {
    "name": "Карина Рябишина",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/3b1231ae-0dec-4656-b19e-0aa0763ed29a.jpg",
    "bio": ""
  },
  {
    "name": "Елизавета Сильванович",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/5d3c891e-99b9-4a6a-b17b-f3899c55c9e0.jpg",
    "bio": ""
  },
  {
    "name": "Анастасия Брагина",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/9e6d67d1-e1bc-4db2-aaec-14ca0fdac218.png",
    "bio": ""
  },
  {
    "name": "Рина Комарова",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/5407965f-f422-473b-8ae3-4ae267f016e6.jpg",
    "bio": ""
  },
  {
    "name": "Римма Михайлова",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/6074de66-749a-4e08-a6e9-9a07050f4402.png",
    "bio": ""
  },
  {
    "name": "Дарья Липинская",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/e2c12982-91a6-4729-beb4-c0a6fa1cc5e1.png",
    "bio": ""
  },
  {
    "name": "Соня Суркова",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/f7f4a4f0-d314-4db4-8cd4-95a6be954cbe.png",
    "bio": ""
  },
  {
    "name": "Таня(мб) Богданова",
    "faculty": "ФЭА",
    "course": 3,
    "photoUrl": "/uploads/3cd8330d-4990-4e36-9ae9-9f80a41f03fa.png",
    "bio": ""
  }
];

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
