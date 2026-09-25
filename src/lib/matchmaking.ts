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
 * Формирование пар с классическим турнирным посевом (Olympic Bracket Seeding).
 * Сильнейшие участницы разводятся по двум веткам сетки (A и B),
 * чтобы они не сталкивались на ранних этапах и встретились только в финале.
 */
function createSeededPairs(contestants: Contestant[]): {
  pairs: [Contestant, Contestant][];
  byes: Contestant[];
} {
  // Сортируем по Elo и победам (сильнейшие выше)
  const sorted = [...contestants].sort((a, b) => b.elo - a.elo || b.wins - a.wins);

  const branchA: Contestant[] = [];
  const branchB: Contestant[] = [];

  sorted.forEach((c, idx) => {
    if (idx % 2 === 0) {
      branchA.push(c);
    } else {
      branchB.push(c);
    }
  });

  const pairs: [Contestant, Contestant][] = [];
  const byes: Contestant[] = [];

  const pairBranch = (branch: Contestant[]) => {
    const half = Math.floor(branch.length / 2);
    for (let i = 0; i < half; i++) {
      // 1-я играет с последней, 2-я с предпоследней
      pairs.push([branch[i], branch[branch.length - 1 - i]]);
    }
    if (branch.length % 2 !== 0) {
      // Оставшаяся участница с наивысшим посевом в остатке проходит без боя
      byes.push(branch[half]);
    }
  };

  pairBranch(branchA);
  pairBranch(branchB);

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

  // Если турнирной сессии нет — инициализируем 1-й круг с честным посевом
  if (!tournament) {
    const { pairs, byes } = createSeededPairs(allActive);
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
        stageWinnersIds: JSON.stringify(byesIds),
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

  const tournament = await prisma.tournamentSession.findUnique({
    where: { sessionId },
  });

  if (!tournament) return null;

  // ЭТАП 1: МЫ В ГРАНД-ФИНАЛЕ (РЕШАЮЩИЙ КЛИК ТУРНИРА!) 👑
  if (tournament.currentStage === 90) {
    const championId = winnerId || tournament.currentPairAId!;
    const runnerUpId =
      tournament.currentPairAId === championId
        ? tournament.currentPairBId!
        : tournament.currentPairAId!;

    let thirdPlaceId: string | null = null;
    try {
      const bronzeData = JSON.parse(tournament.activePoolIds || '[]');
      if (bronzeData.length > 0) thirdPlaceId = bronzeData[0];
    } catch {}

    const champion = contestantsMap.get(championId)!;
    const runnerUp = contestantsMap.get(runnerUpId) || null;
    const thirdPlace = thirdPlaceId ? contestantsMap.get(thirdPlaceId) || null : null;

    // Увеличиваем счетчик побед чемпионке
    await prisma.contestant.update({
      where: { id: championId },
      data: { tournamentWins: { increment: 1 } },
    });

    // Завершаем турнир и сохраняем пьедестал в stageWinnersIds
    await prisma.tournamentSession.update({
      where: { sessionId },
      data: {
        isFinished: true,
        championId,
        stageWinnersIds: JSON.stringify({ runnerUpId, thirdPlaceId }),
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
          activePoolIds: JSON.stringify([thirdPlaceId]), // сохраняем бронзовую призёрку
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

  // СТАНДАРТНАЯ СЕТКА
  let activePool: string[] = JSON.parse(tournament.activePoolIds || '[]');
  let stageWinners: string[] = JSON.parse(tournament.stageWinnersIds || '[]');

  if (winnerId) {
    if (!stageWinners.includes(winnerId)) {
      stageWinners.push(winnerId);
    }
  }

  // Если в текущем пуле раунда есть пары
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
    stageWinners.push(activePool[0]);
    activePool = [];
  }

  // РАУНД ЗАВЕРШЕН — ПЕРЕХОД К СЛЕДУЮЩЕМУ ЭТАПУ!
  const winnersCount = stageWinners.length;

  // 1. ЕСЛИ ОСТАЛОСЬ 2 ДЕВУШКИ — СРАЗУ ГРАНД-ФИНАЛ
  if (winnersCount === 2) {
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

  // 2. ЕСЛИ ТОЛЬКО ЧТО ЗАВЕРШИЛСЯ ПОЛУФИНАЛ (было 4 участницы, вышли 2 победительницы)
  if (tournament.currentStage === 70 && winnersCount === 2) {
    // Находим 2 проигравших в полуфинале девушек
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
          activePoolIds: JSON.stringify(finalists), // сохраняем финалисток для следующего шага
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

  // 3. ЕСЛИ ОСТАЛОСЬ 4 ДЕВУШКИ — ЗАПУСКАЕМ ПОЛУФИНАЛ!
  if (winnersCount === 4) {
    const pool = stageWinners.map((id) => contestantsMap.get(id)!);
    const { pairs } = createSeededPairs(pool);

    const firstPair = pairs[0];
    const secondPair = pairs[1];

    await prisma.tournamentSession.update({
      where: { sessionId },
      data: {
        currentStage: 70,
        stageName: 'Полуфинал',
        currentPairAId: firstPair[0].id,
        currentPairBId: firstPair[1].id,
        activePoolIds: JSON.stringify([secondPair[0].id, secondPair[1].id]),
        stageWinnersIds: '[]',
        matchesInStage: 1,
        totalInStage: 2,
      },
    });

    const [left, right] = Math.random() > 0.5 ? [firstPair[0], firstPair[1]] : [firstPair[1], firstPair[0]];

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

  // 4. ОСТАЛОСЬ > 4 ДЕВУШЕК — ЧЕТВЕРТЬФИНАЛ ИЛИ СЛЕДУЮЩИЙ КРУГ
  const pool = stageWinners.map((id) => contestantsMap.get(id)!);
  const { pairs, byes } = createSeededPairs(pool);

  const firstPair = pairs[0];
  const remainingPairs = pairs.slice(1);
  const activePoolIds = remainingPairs.flatMap(([a, b]) => [a.id, b.id]);
  const byesIds = byes.map((b) => b.id);

  const nextStageNum = tournament.currentStage + 1;
  const nextStageName = winnersCount <= 8 ? 'Четвертьфинал' : `${nextStageNum}-й круг`;

  await prisma.tournamentSession.update({
    where: { sessionId },
    data: {
      currentStage: nextStageNum,
      stageName: nextStageName,
      currentPairAId: firstPair[0].id,
      currentPairBId: firstPair[1].id,
      activePoolIds: JSON.stringify(activePoolIds),
      stageWinnersIds: JSON.stringify(byesIds),
      matchesInStage: 1,
      totalInStage: pairs.length,
    },
  });

  const [left, right] = Math.random() > 0.5 ? [firstPair[0], firstPair[1]] : [firstPair[1], firstPair[0]];

  return {
    contestant1: left,
    contestant2: right,
    stageName: nextStageName,
    currentStage: nextStageNum,
    matchIndexInStage: 1,
    totalMatchesInStage: pairs.length,
    isFinished: false,
  };
}

/**
 * Сбросить турнир для сессии
 */
export async function resetTournamentSession(sessionId: string): Promise<void> {
  await prisma.tournamentSession.deleteMany({
    where: { sessionId },
  });
}
