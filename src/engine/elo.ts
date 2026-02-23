export const ELO_DEFAULT_RATING = 50;
const ELO_SCALE = 20;
const ELO_K_BASE = 24;
const ELO_K_PROVISIONAL = 32;
const ELO_PROVISIONAL_MATCHES = 20;
const ELO_MIN = 0;
const ELO_MAX = 100;

type EloResult = {
  ratingA: number;
  ratingB: number;
};

function clampRating(value: number): number {
  return Math.max(ELO_MIN, Math.min(ELO_MAX, value));
}

function kFactor(matchesPlayed: number): number {
  return matchesPlayed < ELO_PROVISIONAL_MATCHES ? ELO_K_PROVISIONAL : ELO_K_BASE;
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / ELO_SCALE));
}

export function applyEloUpdate(
  ratingA: number,
  ratingB: number,
  scoreA: 0 | 0.5 | 1,
  matchesPlayedA: number,
  matchesPlayedB: number,
): EloResult {
  const expectedA = expectedScore(ratingA, ratingB);
  const expectedB = 1 - expectedA;
  const scoreB = (1 - scoreA) as 0 | 0.5 | 1;
  const nextA = clampRating(ratingA + kFactor(matchesPlayedA) * (scoreA - expectedA));
  const nextB = clampRating(ratingB + kFactor(matchesPlayedB) * (scoreB - expectedB));
  return {
    ratingA: Math.round(nextA * 100) / 100,
    ratingB: Math.round(nextB * 100) / 100,
  };
}
