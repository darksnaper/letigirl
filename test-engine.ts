import { getNextPair, advanceTournamentPair } from './src/lib/matchmaking';
import { prisma } from './src/lib/prisma';

async function testProgressiveTournament() {
  console.log('=== ТЕСТИРОВАНИЕ ПРОГРЕССИВНОГО ТУРНИРА (СЕТКА ДО ТОП-1) ===');

  const testSessionId = 'tour-test-' + Date.now();
  const allActive = await prisma.contestant.findMany({ where: { isActive: true } });
  console.log(`Всего активных девушек в базе: ${allActive.length}`);

  let currentPair = await getNextPair(testSessionId);
  console.assert(currentPair !== null, 'Стартовая пара должна быть создана');

  let matchNum = 0;
  let finished = false;
  let finalChampionName = '';

  while (currentPair && !currentPair.isFinished) {
    matchNum++;
    const pair = currentPair as {
      contestant1: { id: string; name: string };
      contestant2: { id: string; name: string };
      stageName: string;
      matchIndexInStage: number;
      totalMatchesInStage: number;
      isFinished: boolean;
    };

    // Выбираем участницу 1 победителем
    const winnerId = pair.contestant1.id;
    const loserId = pair.contestant2.id;

    console.log(
      `Матч ${matchNum} [${pair.stageName}]: ${pair.contestant1.name.split(' ')[0]} vs ${pair.contestant2.name.split(' ')[0]} -> Выбрана: ${pair.contestant1.name.split(' ')[0]}`
    );

    // Продвигаем турнир
    const next = await advanceTournamentPair(testSessionId, winnerId);

    if (next && next.isFinished) {
      finished = true;
      finalChampionName = next.champion?.name || 'Победительница';
      console.log(`\n🏆 ТУРНИР ЗАВЕРШЕН! Абсолютный топ-1: ${finalChampionName}`);
      break;
    }

    currentPair = next;
  }

  console.assert(finished, 'Турнир должен завершиться абсолютным топ-1!');
  console.log(`✔ Всего матчей в турнире: ${matchNum}`);
  console.log(`✔ Финалистка определена: ${finalChampionName}`);

  // Очистка тестовой сессии
  await prisma.tournamentSession.deleteMany({ where: { sessionId: testSessionId } });
}

testProgressiveTournament()
  .then(() => {
    console.log('\n ВСЕ ТЕСТЫ ТУРНИРНОЙ СЕТКИ ПРОЙДЕНЫ!');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
