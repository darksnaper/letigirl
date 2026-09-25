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
 * Получение победительниц 1-го круга из истории матчей сессии
 */
async function getRound1Winners(sessionId: string, allActive: Contestant[]): Promise<string[]> {
  try {
    const matches = await prisma.match.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    const r1Matches = matches.slice(0, 13);
    const r1LoserIds = new Set(r1Matches.map((m) => m.loserId));

    const winners = allActive
      .filter((c) => !r1LoserIds.has(c.id))
      .map((c) => c.id);

    if (winners.length >= 8) {
      return winners;
    }
  } catch (e) {
    console.error('Error getting R1 winners from matches:', e);
  }

  // Защитный фоллбэк: топ-14 по Elo/победам
  const sorted = [...allActive].sort((a, b) => b.elo - a.elo || b.wins - a.wins);
  return sorted.slice(0, 14).map((c) => c.id);
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
      const cleanStageName = tournament.stageName.includes('Матч за выход')
        ? 'Стыковой раунд'
        : tournament.stageName;

      return {
        contestant1: left,
        contestant2: right,
        stageName: cleanStageName,
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

  // ЭТАП В: Если пользователь находится на этапе 16 (стыковой матч за путевку) — переводим во 2-й круг
  if (tournament.currentStage === 16) {
    const wildcardWinnerId = winnerId || tournament.currentPairAId!;
    const r1Winners = await getRound1Winners(sessionId, allActive);
    return await startRound2(sessionId, r1Winners, wildcardWinnerId, contestantsMap);
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
    const cleanStageName = tournament.stageName.includes('Матч за выход')
      ? 'Стыковой раунд'
      : tournament.stageName;

    return {
      contestant1: left,
      contestant2: right,
      stageName: cleanStageName,
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

  // ЭТАП А: Завершился 1-й круг (13 матчей).
  // 13 проигравших девушек получают шанс в Стыковом раунде!
  if (tournament.currentStage === 1) {
    const allIds = Array.from(contestantsMap.keys());
    const round1Winners = stageWinners;
    const loserIds = allIds.filter((id) => !round1Winners.includes(id));

    if (loserIds.length >= 2) {
      const losersPool = loserIds.map((id) => contestantsMap.get(id)!);
      const { pairs } = createSeededPairs(losersPool);

      if (pairs.length > 0) {
        const firstPair = pairs[0];
        const remainingPairs = pairs.slice(1);
        const activePoolIds = remainingPairs.flatMap(([a, b]) => [a.id, b.id]);

        await prisma.tournamentSession.update({
          where: { sessionId },
          data: {
            currentStage: 15,
            stageName: 'Стыковой раунд',
            currentPairAId: firstPair[0].id,
            currentPairBId: firstPair[1].id,
            activePoolIds: JSON.stringify(activePoolIds),
            stageWinnersIds: '[]',
            matchesInStage: 1,
            totalInStage: pairs.length,
          },
        });

        const [left, right] = Math.random() > 0.5 ? [firstPair[0], firstPair[1]] : [firstPair[1], firstPair[0]];

        return {
          contestant1: left,
          contestant2: right,
          stageName: 'Стыковой раунд',
          currentStage: 15,
          matchIndexInStage: 1,
          totalMatchesInStage: pairs.length,
          isFinished: false,
        };
      }
    }
  }

  // ЭТАП Б: Завершился Стыковой раунд (Stage 15).
  // Победительница стыкового раунда (например, Оля!) получает Wildcard в Топ-8,
  // и мы сразу запускаем 2-й круг!
  if (tournament.currentStage === 15) {
    const sortedConsolation = stageWinners
      .map((id) => contestantsMap.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.elo - a.elo || b.wins - a.wins);

    const wildcardWinnerId = sortedConsolation[0]?.id || stageWinners[0] || allActive[0].id;
    const r1Winners = await getRound1Winners(sessionId, allActive);
    return await startRound2(sessionId, r1Winners, wildcardWinnerId, contestantsMap);
  }

  // ЭТАП Г: Завершился 2-й круг (7 матчей).
  // 7 победительниц 2-го круга + 1 обладательница Wildcard = РОВНО 8 ДЕВУШЕК В ЧЕТВЕРТЬФИНАЛЕ!
  if (tournament.currentStage === 2) {
    const qfPool = stageWinners
      .map((id) => contestantsMap.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.elo - a.elo || b.wins - a.wins);

    // Дополняем до 8, если вдруг меньше
    while (qfPool.length < 8) {
      const existingIds = new Set(qfPool.map((c) => c.id));
      const nextBest = allActive.find((c) => !existingIds.has(c.id));
      if (!nextBest) break;
      qfPool.push(nextBest);
    }

    const { pairs: qfPairs } = createSeededPairs(qfPool.slice(0, 8));
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

  // ЭТАП Д: Завершился Четвертьфинал (было 8 участниц, вышли 4 победительницы).
  // Запускаем ПОЛУФИНАЛ:
  // Полуфинал 1: Seed 1 против Seed 3
  // Полуфинал 2: Seed 2 против Seed 4
  if (tournament.currentStage === 60 && stageWinners.length === 4) {
    const semiPool = stageWinners
      .map((id) => contestantsMap.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.elo - a.elo || b.wins - a.wins);

    const semiPair1: [Contestant, Contestant] = [semiPool[0], semiPool[2]];
    const semiPair2: [Contestant, Contestant] = [semiPool[1], semiPool[3]];

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

  // ЭТАП Е: Завершился Полуфинал (было 4 участницы, вышли 2 финалистки).
  // Запускаем МАТЧ ЗА 3-Е МЕСТО между двумя проигравшими в полуфинале!
  if (tournament.currentStage === 70 && stageWinners.length === 2) {
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

  // ЭТАП Ж: Если осталось 2 девушки — сразу Гранд-финал
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

  // Универсальный фоллбэк: переход к следующему кругу
  const pool = stageWinners.map((id) => contestantsMap.get(id)!).filter(Boolean);
  const { pairs } = createSeededPairs(pool.length >= 2 ? pool : allActive.slice(0, 14));

  const firstPair = pairs[0];
  const remainingPairs = pairs.slice(1);
  const activePoolIds = remainingPairs.flatMap(([a, b]) => [a.id, b.id]);

  const nextStageNum = tournament.currentStage + 1;
  const nextStageName = `${nextStageNum}-й круг`;

  await prisma.tournamentSession.update({
    where: { sessionId },
    data: {
      currentStage: nextStageNum,
      stageName: nextStageName,
      currentPairAId: firstPair[0].id,
      currentPairBId: firstPair[1].id,
      activePoolIds: JSON.stringify(activePoolIds),
      stageWinnersIds: '[]',
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
 * Вспомогательная функция: запуск 2-го круга с добавлением обладательницы Wildcard
 */
async function startRound2(
  sessionId: string,
  r1WinnersIds: string[],
  wildcardWinnerId: string,
  contestantsMap: Map<string, Contestant>
): Promise<NextMatchPair> {
  let r1Pool = r1WinnersIds.map((id) => contestantsMap.get(id)!).filter(Boolean);
  if (r1Pool.length < 2) {
    const all = Array.from(contestantsMap.values());
    r1Pool = all.slice(0, 14);
  }

  const { pairs } = createSeededPairs(r1Pool);

  const firstPair = pairs[0];
  const remainingPairs = pairs.slice(1);
  const activePoolIds = remainingPairs.flatMap(([a, b]) => [a.id, b.id]);

  // В stageWinnersIds сохраняем обладательницу Wildcard, чтобы она гарантированно вошла в Четвертьфинал (Топ-8)
  const initialStageWinners = wildcardWinnerId ? [wildcardWinnerId] : [];

  await prisma.tournamentSession.update({
    where: { sessionId },
    data: {
      currentStage: 2,
      stageName: '2-й круг',
      currentPairAId: firstPair[0].id,
      currentPairBId: firstPair[1].id,
      activePoolIds: JSON.stringify(activePoolIds),
      stageWinnersIds: JSON.stringify(initialStageWinners),
      matchesInStage: 1,
      totalInStage: pairs.length,
    },
  });

  const [left, right] = Math.random() > 0.5 ? [firstPair[0], firstPair[1]] : [firstPair[1], firstPair[0]];

  return {
    contestant1: left,
    contestant2: right,
    stageName: '2-й круг',
    currentStage: 2,
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
