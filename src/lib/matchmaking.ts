import { prisma } from './prisma';
import { Contestant } from '@prisma/client';
import { REAL_CONTESTANTS } from './contestants-data';

export interface NextMatchPair {
  contestant1: Contestant;
  contestant2: Contestant;
  stageName: string;
  currentStage: number;
  matchIndexInStage: number;
  totalMatchesInStage: number;
  isFinished: boolean;
  champion?: Contestant | null;
  runnerUp?: Contestant | null;
  thirdPlace?: Contestant | null;
}

export interface FinishedTournament {
  isFinished: true;
  champion: Contestant;
  runnerUp?: Contestant | null;
  thirdPlace?: Contestant | null;
  stageName: string;
}

/**
 * 4-Квадрантный Олимпийский посев (Grand Slam 4-Quadrant Seeding).
 * 4 главные фаворитки (Анастасия, Ралина, Оля, Марина) разводятся в 4 РАЗНЫХ КВАДРАНТА сетки.
 * Они ни при каких обстоятельствах не могут пересечься в 1-м круге, 2-м круге или Четвертьфинале!
 * В первых кругах фаворитки выбивают несеяных участниц, поэтому в Полуфинал
 * гарантированно выходят только лучшие девушки, и Оля борется за законное призовое место!
 */
function getTopFourSeeds(allActive: Contestant[]): {
  top4: Contestant[];
  unseeded: Contestant[];
} {
  // Находим ключевых фавориток
  const anastasia = allActive.find((c) => c.name.includes('Анастасия Брагина'));
  const ralina = allActive.find((c) => c.name.includes('Ралина Валиева'));
  const olya = allActive.find((c) => c.name.includes('Оля Нестеренко'));
  const marina = allActive.find((c) => c.name.includes('Марина Каравашкина'));

  const coreFavorites = [anastasia, ralina, olya, marina].filter(Boolean) as Contestant[];
  const coreIds = new Set(coreFavorites.map((c) => c.id));

  // Оставшиеся участницы, отсортированные по Elo
  const otherSorted = allActive
    .filter((c) => !coreIds.has(c.id))
    .sort((a, b) => b.elo - a.elo || b.wins - a.wins);

  const top4: Contestant[] = [...coreFavorites];
  while (top4.length < 4 && otherSorted.length > 0) {
    top4.push(otherSorted.shift()!);
  }

  return { top4, unseeded: otherSorted };
}

/**
 * Создание пар для 1-го круга по 4 квадрантам
 */
function createQuadrantRound1Pairs(allActive: Contestant[]): {
  pairs: [Contestant, Contestant][];
  byes: Contestant[];
} {
  const { top4, unseeded } = getTopFourSeeds(allActive);

  // Квадранты:
  // Q1 (Seed 1: Анастасия): top4[0] + 6 несеяных (7 участниц) -> Seed 1 bye, 3 пары
  // Q2 (Seed 2: Ралина):    top4[1] + 6 несеяных (7 участниц) -> Seed 2 bye, 3 пары
  // Q3 (Seed 3: Оля):       top4[2] + 6 несеяных (7 участниц) -> Seed 3 bye, 3 пары
  // Q4 (Seed 4: Марина):    top4[3] + 5 несеяных (6 участниц) -> 3 пары (включая Марину)

  const pairs: [Contestant, Contestant][] = [];
  const byes: Contestant[] = [top4[0], top4[1], top4[2]]; // Анастасия, Ралина, Оля начинают со 2-го круга

  const q1Unseeded = unseeded.slice(0, 6);
  const q2Unseeded = unseeded.slice(6, 12);
  const q3Unseeded = unseeded.slice(12, 18);
  const q4Pool = [top4[3], ...unseeded.slice(18, 23)]; // 6 участниц

  const pairList = (list: Contestant[]) => {
    for (let i = 0; i < list.length - 1; i += 2) {
      pairs.push([list[i], list[i + 1]]);
    }
  };

  pairList(q1Unseeded); // 3 пары
  pairList(q2Unseeded); // 3 пары
  pairList(q3Unseeded); // 3 пары
  pairList(q4Pool);     // 3 пары

  return { pairs, byes };
}

/**
 * Получить следующую пару в турнире
 */
export async function getNextPair(
  sessionId: string
): Promise<NextMatchPair | FinishedTournament | null> {
  let allActive = await prisma.contestant.findMany({
    where: { isActive: true },
  });

  if (allActive.length < 2) {
    try {
      for (const c of REAL_CONTESTANTS) {
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
      }
      allActive = await prisma.contestant.findMany({
        where: { isActive: true },
      });
    } catch (e) {
      console.error('Auto-seed failed:', e);
    }
  }

  if (allActive.length < 2) return null;
  const contestantsMap = new Map(allActive.map((c) => [c.id, c]));

  let tournament = await prisma.tournamentSession.findUnique({
    where: { sessionId },
  });

  // Если сессия была в старом зависшем этапе (15 или 16) — мягко сбрасываем её
  if (tournament && (tournament.currentStage === 15 || tournament.currentStage === 16)) {
    await prisma.tournamentSession.delete({ where: { sessionId } });
    tournament = null;
  }

  // Если турнир уже завершен — возвращаем результаты пьедестала
  if (tournament && tournament.isFinished && tournament.championId) {
    const champion = contestantsMap.get(tournament.championId);
    let runnerUp: Contestant | null = null;
    let thirdPlace: Contestant | null = null;

    try {
      const podium = JSON.parse(tournament.stageWinnersIds || '{}');
      if (podium.runnerUpId) runnerUp = contestantsMap.get(podium.runnerUpId) || null;
      if (podium.thirdPlaceId) thirdPlace = contestantsMap.get(podium.thirdPlaceId) || null;
    } catch {}

    if (champion) {
      return {
        isFinished: true,
        champion,
        runnerUp,
        thirdPlace,
        stageName: 'Турнир завершен',
      };
    }
  }

  // Если турнирной сессии нет — инициализируем 1-й круг с правильным 4-квадрантным посевом
  if (!tournament) {
    const { pairs, byes } = createQuadrantRound1Pairs(allActive);
    const firstPair = pairs[0];
    const remainingPairs = pairs.slice(1);
    const activePoolIds = remainingPairs.flatMap(([a, b]) => [a.id, b.id]);
    const byesIds = byes.map((b) => b.id);

    tournament = await prisma.tournamentSession.create({
      data: {
        sessionId,
        currentStage: 1,
        stageName: '1-й круг',
        activePoolIds: JSON.stringify(activePoolIds),
        stageWinnersIds: JSON.stringify(byesIds), // сеяные фаворитки ждут во 2-м круге
        currentPairAId: firstPair[0].id,
        currentPairBId: firstPair[1].id,
        matchesInStage: 1,
        totalInStage: pairs.length,
        isFinished: false,
      },
    });

    const [left, right] = Math.random() > 0.5 ? [firstPair[0], firstPair[1]] : [firstPair[1], firstPair[0]];

    return {
      contestant1: left,
      contestant2: right,
      stageName: tournament.stageName,
      currentStage: tournament.currentStage,
      matchIndexInStage: tournament.matchesInStage,
      totalMatchesInStage: tournament.totalInStage,
      isFinished: false,
    };
  }

  // Если текущая пара уже выбрана
  if (tournament.currentPairAId && tournament.currentPairBId) {
    const c1 = contestantsMap.get(tournament.currentPairAId);
    const c2 = contestantsMap.get(tournament.currentPairBId);

    if (c1 && c2) {
      const [left, right] = Math.random() > 0.5 ? [c1, c2] : [c2, c1];
      return {
        contestant1: left,
        contestant2: right,
        stageName: tournament.stageName,
        currentStage: tournament.currentStage,
        matchIndexInStage: tournament.matchesInStage,
        totalMatchesInStage: tournament.totalInStage,
        isFinished: false,
      };
    }
  }

  return await advanceTournamentPair(tournament.sessionId, null);
}

/**
 * Продвижение по турнирной сетке после каждого голоса
 */
export async function advanceTournamentPair(
  sessionId: string,
  winnerId: string | null
): Promise<NextMatchPair | FinishedTournament | null> {
  const allActive = await prisma.contestant.findMany({ where: { isActive: true } });
  if (allActive.length < 2) return null;
  const contestantsMap = new Map(allActive.map((c) => [c.id, c]));

  let tournament = await prisma.tournamentSession.findUnique({
    where: { sessionId },
  });

  if (!tournament) return null;

  // Если сессия была в старом этапе 15 или 16 — безопасно сбрасываем и начинаем чистый турнир
  if (tournament.currentStage === 15 || tournament.currentStage === 16) {
    await prisma.tournamentSession.delete({ where: { sessionId } });
    return await getNextPair(sessionId);
  }

  // ЭТАП 1: МЫ В ГРАНД-ФИНАЛЕ (РЕШАЮЩИЙ КЛИК ТУРНИРА!) 👑
  if (tournament.currentStage === 90) {
    const championId = winnerId || tournament.currentPairAId!;
    const runnerUpId =
      tournament.currentPairAId === championId
        ? tournament.currentPairBId!
        : tournament.currentPairAId!;

    let thirdPlaceId: string | null = null;
    let fourthPlaceId: string | null = null;
    try {
      const bronzeData = JSON.parse(tournament.activePoolIds || '[]');
      if (bronzeData.length > 0) thirdPlaceId = bronzeData[0];
      if (bronzeData.length > 1) fourthPlaceId = bronzeData[1];
    } catch {}

    const champion = contestantsMap.get(championId)!;
    const runnerUp = contestantsMap.get(runnerUpId) || null;
    const thirdPlace = thirdPlaceId ? contestantsMap.get(thirdPlaceId) || null : null;

    // Записываем победу в турнире чемпионке (tournamentWins)
    await prisma.contestant.update({
      where: { id: championId },
      data: {
        tournamentWins: { increment: 1 },
      },
    });

    // Завершаем турнир и сохраняем пьедестал в stageWinnersIds
    await prisma.tournamentSession.update({
      where: { sessionId },
      data: {
        isFinished: true,
        championId,
        stageWinnersIds: JSON.stringify({ runnerUpId, thirdPlaceId, fourthPlaceId }),
        currentPairAId: null,
        currentPairBId: null,
        activePoolIds: '[]',
      },
    });

    return {
      isFinished: true,
      champion,
      runnerUp,
      thirdPlace,
      stageName: 'Турнир завершен',
    };
  }

  // ЭТАП 2: МЫ В МАТЧЕ ЗА 3-Е МЕСТО 🥉
  if (tournament.currentStage === 80) {
    const thirdPlaceId = winnerId || tournament.currentPairAId!;
    const fourthPlaceId =
      tournament.currentPairAId === thirdPlaceId
        ? tournament.currentPairBId!
        : tournament.currentPairAId!;

    // Достаем финалисток для Гранд-финала из activePoolIds
    let finalists: string[] = [];
    try {
      finalists = JSON.parse(tournament.activePoolIds || '[]');
    } catch {}

    if (finalists.length >= 2) {
      const finalC1 = contestantsMap.get(finalists[0])!;
      const finalC2 = contestantsMap.get(finalists[1])!;

      await prisma.tournamentSession.update({
        where: { sessionId },
        data: {
          currentStage: 90,
          stageName: 'Гранд-финал 👑',
          currentPairAId: finalC1.id,
          currentPairBId: finalC2.id,
          activePoolIds: JSON.stringify([thirdPlaceId, fourthPlaceId]), // сохраняем 3-е и 4-е место
          matchesInStage: 1,
          totalInStage: 1,
        },
      });

      const [left, right] = Math.random() > 0.5 ? [finalC1, finalC2] : [finalC2, finalC1];

      return {
        contestant1: left,
        contestant2: right,
        stageName: 'Гранд-финал 👑',
        currentStage: 90,
        matchIndexInStage: 1,
        totalMatchesInStage: 1,
        isFinished: false,
      };
    }
  }

  // СТАНДАРТНАЯ СЕТКА И ПРОДВИЖЕНИЕ
  let activePool: string[] = JSON.parse(tournament.activePoolIds || '[]');
  let stageWinners: string[] = [];
  try {
    const parsed = JSON.parse(tournament.stageWinnersIds || '[]');
    stageWinners = Array.isArray(parsed) ? parsed : [];
  } catch {
    stageWinners = [];
  }

  // Добавляем победителя матча в список победителей текущего этапа
  if (winnerId) {
    if (!stageWinners.includes(winnerId)) {
      stageWinners.push(winnerId);
    }
  }

  // Если в текущем пуле раунда есть еще пары
  if (activePool.length >= 2) {
    const nextC1Id = activePool[0];
    const nextC2Id = activePool[1];
    const remainingActivePool = activePool.slice(2);

    await prisma.tournamentSession.update({
      where: { sessionId },
      data: {
        currentPairAId: nextC1Id,
        currentPairBId: nextC2Id,
        activePoolIds: JSON.stringify(remainingActivePool),
        stageWinnersIds: JSON.stringify(stageWinners),
        matchesInStage: tournament.matchesInStage + 1,
      },
    });

    const c1 = contestantsMap.get(nextC1Id)!;
    const c2 = contestantsMap.get(nextC2Id)!;
    const [left, right] = Math.random() > 0.5 ? [c1, c2] : [c2, c1];

    return {
      contestant1: left,
      contestant2: right,
      stageName: tournament.stageName,
      currentStage: tournament.currentStage,
      matchIndexInStage: tournament.matchesInStage + 1,
      totalMatchesInStage: tournament.totalInStage,
      isFinished: false,
    };
  } else if (activePool.length === 1) {
    if (!stageWinners.includes(activePool[0])) {
      stageWinners.push(activePool[0]);
    }
    activePool = [];
  }

  // =========================================================================
  // РАУНД ЗАВЕРШЕН — ПЕРЕХОД К СЛЕДУЮЩЕМУ ЭТАПУ!
  // =========================================================================

  // ЭТАП 1 ЗАВЕРШИЛСЯ -> ПЕРЕХОД ВО 2-Й КРУГ
  // В stageWinners находятся победительницы 1-го круга + сеяные фаворитки (Анастасия, Ралина, Оля)
  if (tournament.currentStage === 1) {
    const pool = stageWinners.map((id) => contestantsMap.get(id)!).filter(Boolean);

    // Достаем ключевых фавориток
    const anastasia = pool.find((c) => c.name.includes('Анастасия Брагина'));
    const ralina = pool.find((c) => c.name.includes('Ралина Валиева'));
    const olya = pool.find((c) => c.name.includes('Оля Нестеренко'));
    const otherWinners = pool.filter((c) => c !== anastasia && c !== ralina && c !== olya);

    // Формируем пары 2-го круга:
    // Фаворитки играют против победительниц 1-го круга, выбивая слабых!
    // Анастасия, Ралина и Оля НЕ пересекаются между собой!
    const r2Pairs: [Contestant, Contestant][] = [];

    if (anastasia && otherWinners.length > 0) {
      r2Pairs.push([anastasia, otherWinners.shift()!]);
    }
    if (ralina && otherWinners.length > 0) {
      r2Pairs.push([ralina, otherWinners.shift()!]);
    }
    if (olya && otherWinners.length > 0) {
      r2Pairs.push([olya, otherWinners.shift()!]);
    }

    // Оставшиеся победительницы 1-го круга играют между собой
    for (let i = 0; i < otherWinners.length - 1; i += 2) {
      r2Pairs.push([otherWinners[i], otherWinners[i + 1]]);
    }
    if (otherWinners.length % 2 !== 0) {
      // Последняя проходит дальше
      stageWinners = [otherWinners[otherWinners.length - 1].id];
    } else {
      stageWinners = [];
    }

    const firstPair = r2Pairs[0];
    const remainingPairs = r2Pairs.slice(1);
    const activePoolIds = remainingPairs.flatMap(([a, b]) => [a.id, b.id]);

    await prisma.tournamentSession.update({
      where: { sessionId },
      data: {
        currentStage: 2,
        stageName: '2-й круг',
        currentPairAId: firstPair[0].id,
        currentPairBId: firstPair[1].id,
        activePoolIds: JSON.stringify(activePoolIds),
        stageWinnersIds: JSON.stringify(stageWinners),
        matchesInStage: 1,
        totalInStage: r2Pairs.length,
      },
    });

    const [left, right] = Math.random() > 0.5 ? [firstPair[0], firstPair[1]] : [firstPair[1], firstPair[0]];

    return {
      contestant1: left,
      contestant2: right,
      stageName: '2-й круг',
      currentStage: 2,
      matchIndexInStage: 1,
      totalMatchesInStage: r2Pairs.length,
      isFinished: false,
    };
  }

  // ЭТАП 2 ЗАВЕРШИЛСЯ -> ПЕРЕХОД В ЧЕТВЕРТЬФИНАЛ (ТОП-8)
  if (tournament.currentStage === 2) {
    const qfPool = stageWinners
      .map((id) => contestantsMap.get(id)!)
      .filter(Boolean);

    // Достаем ключевых фавориток (Анастасия, Ралина, Оля)
    const anastasia = qfPool.find((c) => c.name.includes('Анастасия Брагина'));
    const ralina = qfPool.find((c) => c.name.includes('Ралина Валиева'));
    const olya = qfPool.find((c) => c.name.includes('Оля Нестеренко'));
    const others = qfPool.filter((c) => c !== anastasia && c !== ralina && c !== olya);

    // В Четвертьфинале фаворитки по-прежнему разводятся и играют против остальных!
    const qfPairs: [Contestant, Contestant][] = [];
    if (anastasia && others.length > 0) {
      qfPairs.push([anastasia, others.shift()!]);
    }
    if (ralina && others.length > 0) {
      qfPairs.push([ralina, others.shift()!]);
    }
    if (olya && others.length > 0) {
      qfPairs.push([olya, others.shift()!]);
    }
    for (let i = 0; i < others.length - 1; i += 2) {
      qfPairs.push([others[i], others[i + 1]]);
    }

    if (qfPairs.length === 0) {
      // Защитный фоллбэк
      const pool = allActive.slice(0, 4);
      qfPairs.push([pool[0], pool[1]], [pool[2], pool[3]]);
    }

    const firstPair = qfPairs[0];
    const remainingPairs = qfPairs.slice(1);
    const activePoolIds = remainingPairs.flatMap(([a, b]) => [a.id, b.id]);

    await prisma.tournamentSession.update({
      where: { sessionId },
      data: {
        currentStage: 60,
        stageName: 'Четвертьфинал',
        currentPairAId: firstPair[0].id,
        currentPairBId: firstPair[1].id,
        activePoolIds: JSON.stringify(activePoolIds),
        stageWinnersIds: '[]',
        matchesInStage: 1,
        totalInStage: qfPairs.length,
      },
    });

    const [left, right] = Math.random() > 0.5 ? [firstPair[0], firstPair[1]] : [firstPair[1], firstPair[0]];

    return {
      contestant1: left,
      contestant2: right,
      stageName: 'Четвертьфинал',
      currentStage: 60,
      matchIndexInStage: 1,
      totalMatchesInStage: qfPairs.length,
      isFinished: false,
    };
  }

  // ЭТАП 60 ЗАВЕРШИЛСЯ -> ПЕРЕХОД В ПОЛУФИНАЛ (ТОП-4)
  if (tournament.currentStage === 60) {
    const semiPool = stageWinners
      .map((id) => contestantsMap.get(id)!)
      .filter(Boolean);

    const anastasia = semiPool.find((c) => c.name.includes('Анастасия Брагина')) || semiPool[0];
    const ralina = semiPool.find((c) => c.name.includes('Ралина Валиева')) || semiPool[1];
    const olya = semiPool.find((c) => c.name.includes('Оля Нестеренко')) || semiPool[2];
    const fourth = semiPool.find((c) => c !== anastasia && c !== ralina && c !== olya) || semiPool[3] || semiPool[0];

    // Полуфиналы:
    // ПФ 1: Анастасия против 4-й участницы (например, Марины или Алины)
    // ПФ 2: Ралина против Оли
    const semiPair1: [Contestant, Contestant] = [anastasia, fourth];
    const semiPair2: [Contestant, Contestant] = [ralina, olya];

    await prisma.tournamentSession.update({
      where: { sessionId },
      data: {
        currentStage: 70,
        stageName: 'Полуфинал',
        currentPairAId: semiPair1[0].id,
        currentPairBId: semiPair1[1].id,
        activePoolIds: JSON.stringify([semiPair2[0].id, semiPair2[1].id]),
        stageWinnersIds: '[]',
        matchesInStage: 1,
        totalInStage: 2,
      },
    });

    const [left, right] = Math.random() > 0.5 ? [semiPair1[0], semiPair1[1]] : [semiPair1[1], semiPair1[0]];

    return {
      contestant1: left,
      contestant2: right,
      stageName: 'Полуфинал',
      currentStage: 70,
      matchIndexInStage: 1,
      totalMatchesInStage: 2,
      isFinished: false,
    };
  }

  // ЭТАП 70 ЗАВЕРШИЛСЯ -> ПЕРЕХОД В МАТЧ ЗА 3-Е МЕСТО 🥉
  if (tournament.currentStage === 70) {
    const finalists = stageWinners;
    const semiMatches = await prisma.match.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });
    const semiLosers = semiMatches.map((m) => m.loserId);

    if (semiLosers.length >= 2 && semiLosers[0] !== semiLosers[1]) {
      const bronzeC1 = contestantsMap.get(semiLosers[0])!;
      const bronzeC2 = contestantsMap.get(semiLosers[1])!;

      await prisma.tournamentSession.update({
        where: { sessionId },
        data: {
          currentStage: 80,
          stageName: 'Матч за 3-е место 🥉',
          currentPairAId: bronzeC1.id,
          currentPairBId: bronzeC2.id,
          activePoolIds: JSON.stringify(finalists), // сохраняем финалисток для Гранд-финала
          stageWinnersIds: '[]',
          matchesInStage: 1,
          totalInStage: 1,
        },
      });

      const [left, right] = Math.random() > 0.5 ? [bronzeC1, bronzeC2] : [bronzeC2, bronzeC1];

      return {
        contestant1: left,
        contestant2: right,
        stageName: 'Матч за 3-е место 🥉',
        currentStage: 80,
        matchIndexInStage: 1,
        totalMatchesInStage: 1,
        isFinished: false,
      };
    }
  }

  // Фоллбэк: если осталось 2 девушки — сразу Гранд-финал
  if (stageWinners.length === 2) {
    const finalC1 = contestantsMap.get(stageWinners[0])!;
    const finalC2 = contestantsMap.get(stageWinners[1])!;

    await prisma.tournamentSession.update({
      where: { sessionId },
      data: {
        currentStage: 90,
        stageName: 'Гранд-финал 👑',
        currentPairAId: finalC1.id,
        currentPairBId: finalC2.id,
        activePoolIds: '[]',
        stageWinnersIds: '[]',
        matchesInStage: 1,
        totalInStage: 1,
      },
    });

    const [left, right] = Math.random() > 0.5 ? [finalC1, finalC2] : [finalC2, finalC1];

    return {
      contestant1: left,
      contestant2: right,
      stageName: 'Гранд-финал 👑',
      currentStage: 90,
      matchIndexInStage: 1,
      totalMatchesInStage: 1,
      isFinished: false,
    };
  }

  return null;
}

/**
 * Сбросить турнир для сессии
 */
export async function resetTournamentSession(sessionId: string): Promise<void> {
  await prisma.tournamentSession.deleteMany({
    where: { sessionId },
  });
}
