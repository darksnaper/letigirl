import { prisma } from './prisma';
import { Contestant } from '@prisma/client';

export interface NextMatchPair {
  contestant1: Contestant;
  contestant2: Contestant;
  stageName: string;
  currentStage: number;
  matchIndexInStage: number;
  totalMatchesInStage: number;
  isFinished: boolean;
  champion?: Contestant | null;
}

export interface FinishedTournament {
  isFinished: true;
  champion: Contestant;
  stageName: string;
}

/**
 * Получить следующую пару в личном турнире пользователя
 */
import { REAL_CONTESTANTS } from './contestants-data';

export async function getNextPair(
  sessionId: string
): Promise<NextMatchPair | FinishedTournament | null> {
  // 1. Получаем всех активных девушек
  let allActive = await prisma.contestant.findMany({
    where: { isActive: true },
  });

  if (allActive.length < 2) {
    // Автоматическое наполнение 27 участницами при пустой базе
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

  if (allActive.length < 2) {
    return null;
  }

  const contestantsMap = new Map(allActive.map((c) => [c.id, c]));

  // 2. Ищем существующую турнирную сессию
  let tournament = await prisma.tournamentSession.findUnique({
    where: { sessionId },
  });

  // Если турнир уже завершен
  if (tournament && tournament.isFinished && tournament.championId) {
    const champion = contestantsMap.get(tournament.championId);
    if (champion) {
      return {
        isFinished: true,
        champion,
        stageName: 'Турнир завершен',
      };
    }
  }

  // 3. Если турнирной сессии нет — инициализируем первый этап (Все участницы)
  if (!tournament) {
    // Балансировка: сортируем участниц по наименьшему числу показов в глобальной БД
    const sorted = [...allActive].sort((a, b) => a.matchesCount - b.matchesCount);

    const c1 = sorted[0];
    // Подбираем c2 с максимально близким Elo среди оставшихся
    const remaining = sorted.slice(1);
    remaining.sort((a, b) => Math.abs(a.elo - c1.elo) - Math.abs(b.elo - c1.elo));
    const c2 = remaining[0];

    const activePoolIds = remaining.slice(1).map((c) => c.id);
    const totalInStage = Math.ceil(allActive.length / 2);

    tournament = await prisma.tournamentSession.create({
      data: {
        sessionId,
        currentStage: 1,
        stageName: '1-й круг (Все участницы)',
        activePoolIds: JSON.stringify(activePoolIds),
        stageWinnersIds: JSON.stringify([]),
        currentPairAId: c1.id,
        currentPairBId: c2.id,
        matchesInStage: 1,
        totalInStage,
        isFinished: false,
      },
    });

    // 50% случайная смена стороны
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

  // 4. Если текущая пара уже выбрана
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

  // Если пара по какой-то причине отсутствует, восстанавливаем следующую
  return await advanceTournamentPair(tournament.sessionId, null);
}

/**
 * Продвижение по турнирной сетке после голоса
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

  // Если мы уже в раунде определения призовых мест (repechage ladder)
  if (tournament.currentStage >= 90) {
    let queue: string[] = JSON.parse(tournament.activePoolIds || '[]');

    if (queue.length > 0) {
      const nextOpponentId = queue.shift()!;
      // Победитель предыдущего матча остается за столом и играет со следующим претендентом
      const nextC1Id = winnerId || tournament.currentPairAId!;
      const nextC2Id = nextOpponentId;

      await prisma.tournamentSession.update({
        where: { sessionId },
        data: {
          currentPairAId: nextC1Id,
          currentPairBId: nextC2Id,
          activePoolIds: JSON.stringify(queue),
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
    } else {
      // Все призовые матчи завершены! Турнир полностью окончен.
      const championId = tournament.championId || winnerId!;
      const champion = contestantsMap.get(championId)!;

      await prisma.tournamentSession.update({
        where: { sessionId },
        data: {
          isFinished: true,
          currentPairAId: null,
          currentPairBId: null,
          activePoolIds: '[]',
        },
      });

      return {
        isFinished: true,
        champion,
        stageName: 'Турнир завершен',
      };
    }
  }

  let activePool: string[] = JSON.parse(tournament.activePoolIds || '[]');
  let stageWinners: string[] = JSON.parse(tournament.stageWinnersIds || '[]');

  // Если передан победитель матча, добавляем его в пул победителей этапа
  if (winnerId) {
    if (!stageWinners.includes(winnerId)) {
      stageWinners.push(winnerId);
    }
  }

  let nextStage = tournament.currentStage;
  let nextStageName = tournament.stageName;
  let matchesInStage = tournament.matchesInStage;
  let totalInStage = tournament.totalInStage;
  let nextC1Id: string | null = null;
  let nextC2Id: string | null = null;

  // Проверяем: есть ли еще пары в текущем активном пуле этого раунда?
  if (activePool.length >= 2) {
    // Подбираем следующую пару из текущего пула
    const c1 = contestantsMap.get(activePool[0])!;
    const remaining = activePool.slice(1).map((id) => contestantsMap.get(id)!);
    remaining.sort((a, b) => Math.abs(a.elo - c1.elo) - Math.abs(b.elo - c1.elo));
    const c2 = remaining[0];

    nextC1Id = c1.id;
    nextC2Id = c2.id;
    activePool = activePool.filter((id) => id !== c1.id && id !== c2.id);
    matchesInStage += 1;
  } else if (activePool.length === 1) {
    // 1 нечетная участница получает автоматический проход (bye) в победители
    stageWinners.push(activePool[0]);
    activePool = [];
  }

  // Если активный пул исчерпан — текущий раунд завершен!
  if (!nextC1Id || !nextC2Id) {
    // Проверяем количество победителей, вышедших в следующий раунд:
    if (stageWinners.length === 1) {
      // ГРАНД-ФИНАЛ ЗАВЕРШЕН — ЧЕМПИОНКА ОПРЕДЕЛЕНА! 👑
      const championId = stageWinners[0];
      const champion = contestantsMap.get(championId)!;

      // Увеличиваем счетчик выигранных турниров чемпионке
      await prisma.contestant.update({
        where: { id: championId },
        data: { tournamentWins: { increment: 1 } },
      });

      // Находим всех соперниц, которых победила чемпионка в этой сессии (в хронологическом порядке)
      const defeatedByChampion = await prisma.match.findMany({
        where: { sessionId, winnerId: championId },
        orderBy: { createdAt: 'asc' },
      });

      if (defeatedByChampion.length >= 2) {
        // Последняя проигравшая чемпионке — финалистка
        const finalistId = defeatedByChampion[defeatedByChampion.length - 1].loserId;

        // Ранее выбитые чемпионкой участницы (с 1-го раунда до полуфинала)
        const championEarlyLoserIds = defeatedByChampion.slice(0, -1).map((m) => m.loserId);

        // Находим вторую полуфиналистку (которая проиграла финалистке в полуфинале)
        const otherSfMatch = await prisma.match.findFirst({
          where: { sessionId, winnerId: finalistId },
          orderBy: { createdAt: 'desc' },
        });
        const otherSfId = otherSfMatch?.loserId;

        // Формируем список кандидаток на призовые места:
        // 1. Девушки, уступившие только чемпионке (начиная с самых ранних раундов, чтобы дать им шанс)
        // 2. Вторая полуфиналистка
        // 3. Финалистка турнира
        const candidatesList: string[] = [];
        const seen = new Set<string>();

        for (const id of championEarlyLoserIds) {
          if (id && contestantsMap.has(id) && !seen.has(id)) {
            candidatesList.push(id);
            seen.add(id);
          }
        }
        if (otherSfId && contestantsMap.has(otherSfId) && !seen.has(otherSfId)) {
          candidatesList.push(otherSfId);
          seen.add(otherSfId);
        }
        if (finalistId && contestantsMap.has(finalistId) && !seen.has(finalistId)) {
          candidatesList.push(finalistId);
          seen.add(finalistId);
        }

        if (candidatesList.length >= 2) {
          const c1Id = candidatesList[0];
          const c2Id = candidatesList[1];
          const queue = candidatesList.slice(2);
          const totalMatches = 1 + queue.length;

          await prisma.tournamentSession.update({
            where: { sessionId },
            data: {
              currentStage: 99,
              stageName: 'Матч за призовые места',
              championId,
              activePoolIds: JSON.stringify(queue),
              stageWinnersIds: '[]',
              currentPairAId: c1Id,
              currentPairBId: c2Id,
              matchesInStage: 1,
              totalInStage: totalMatches,
              isFinished: false,
            },
          });

          const c1 = contestantsMap.get(c1Id)!;
          const c2 = contestantsMap.get(c2Id)!;
          const [left, right] = Math.random() > 0.5 ? [c1, c2] : [c2, c1];

          return {
            contestant1: left,
            contestant2: right,
            stageName: 'Матч за призовые места',
            currentStage: 99,
            matchIndexInStage: 1,
            totalMatchesInStage: totalMatches,
            isFinished: false,
          };
        }
      }

      // Если кандидаток недостаточно, сразу завершаем турнир
      await prisma.tournamentSession.update({
        where: { sessionId },
        data: {
          isFinished: true,
          championId,
          activePoolIds: '[]',
          stageWinnersIds: JSON.stringify(stageWinners),
          currentPairAId: null,
          currentPairBId: null,
        },
      });

      return {
        isFinished: true,
        champion,
        stageName: 'Финал',
      };
    }

    if (stageWinners.length === 2) {
      // ГРАНД-ФИНАЛ
      nextStage += 1;
      nextStageName = 'Гранд-финал 👑';
      nextC1Id = stageWinners[0];
      nextC2Id = stageWinners[1];
      activePool = [];
      stageWinners = [];
      matchesInStage = 1;
      totalInStage = 1;
    } else if (stageWinners.length === 3) {
      // Полуфинал: двое играют, третья ждет в финале
      nextStage += 1;
      nextStageName = 'Полуфинал';
      nextC1Id = stageWinners[0];
      nextC2Id = stageWinners[1];
      activePool = [stageWinners[2]]; // третья ждет
      stageWinners = [];
      matchesInStage = 1;
      totalInStage = 2;
    } else {
      // Новый раунд на выбывание
      nextStage += 1;
      if (stageWinners.length <= 4) {
        nextStageName = 'Полуфинал';
      } else if (stageWinners.length <= 8) {
        nextStageName = 'Четвертьфинал';
      } else {
        nextStageName = `Раунд ${nextStage}`;
      }

      // Формируем следующую пару из победителей
      const poolContestants = stageWinners.map((id) => contestantsMap.get(id)!);
      poolContestants.sort((a, b) => b.elo - a.elo);
      const c1 = poolContestants[0];
      const remaining = poolContestants.slice(1);
      remaining.sort((a, b) => Math.abs(a.elo - c1.elo) - Math.abs(b.elo - c1.elo));
      const c2 = remaining[0];

      nextC1Id = c1.id;
      nextC2Id = c2.id;
      activePool = stageWinners.filter((id) => id !== c1.id && id !== c2.id);
      stageWinners = [];
      matchesInStage = 1;
      totalInStage = Math.ceil((poolContestants.length) / 2);
    }
  }

  // Обновляем состояние турнира в БД
  await prisma.tournamentSession.update({
    where: { sessionId },
    data: {
      currentStage: nextStage,
      stageName: nextStageName,
      activePoolIds: JSON.stringify(activePool),
      stageWinnersIds: JSON.stringify(stageWinners),
      currentPairAId: nextC1Id,
      currentPairBId: nextC2Id,
      matchesInStage,
      totalInStage,
    },
  });

  const c1 = contestantsMap.get(nextC1Id!)!;
  const c2 = contestantsMap.get(nextC2Id!)!;
  const [left, right] = Math.random() > 0.5 ? [c1, c2] : [c2, c1];

  return {
    contestant1: left,
    contestant2: right,
    stageName: nextStageName,
    currentStage: nextStage,
    matchIndexInStage: matchesInStage,
    totalMatchesInStage: totalInStage,
    isFinished: false,
  };
}

/**
 * Сбросить турнир для сессии, чтобы пользователь мог пройти новый турнир
 */
export async function resetTournamentSession(sessionId: string): Promise<void> {
  await prisma.tournamentSession.deleteMany({
    where: { sessionId },
  });
}
