/**
 * Elo Rating System with Dynamic K-Factor
 */

export function getKFactor(matchesCount: number): number {
  if (matchesCount < 15) {
    return 32; // Быстрое сведение для новичков
  }
  if (matchesCount < 30) {
    return 24; // Промежуточная калибровка
  }
  return 16; // Высокая стабильность для опытных участниц
}

export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export interface EloMatchResult {
  winnerNewElo: number;
  loserNewElo: number;
  deltaWinner: number;
  deltaLoser: number;
  expectedWinner: number;
  expectedLoser: number;
}

export function calculateElo(
  winnerRating: number,
  loserRating: number,
  winnerMatches: number,
  loserMatches: number
): EloMatchResult {
  const expectedWinner = calculateExpectedScore(winnerRating, loserRating);
  const expectedLoser = 1 - expectedWinner;

  const kWinner = getKFactor(winnerMatches);
  const kLoser = getKFactor(loserMatches);

  const deltaWinner = Math.round(kWinner * (1 - expectedWinner) * 10) / 10;
  const deltaLoser = Math.round(kLoser * (0 - expectedLoser) * 10) / 10;

  const winnerNewElo = Math.round(winnerRating + deltaWinner);
  const loserNewElo = Math.max(100, Math.round(loserRating + deltaLoser));

  return {
    winnerNewElo,
    loserNewElo,
    deltaWinner,
    deltaLoser,
    expectedWinner: Math.round(expectedWinner * 1000) / 1000,
    expectedLoser: Math.round(expectedLoser * 1000) / 1000,
  };
}
