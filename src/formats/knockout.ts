import { BYE_ID, type Match, type Participant, type Tournament } from "../types";
import { makeId } from "../utils/id";
import { createTournamentRng } from "../utils/rng";

function isPowerOfTwo(v: number): boolean {
  return (v & (v - 1)) === 0;
}

function nextPowerOfTwo(v: number): number {
  let n = 1;
  while (n < v) n *= 2;
  return n;
}

function shuffleWithSeed<T>(items: T[], seed: number | undefined, label: string): T[] {
  const rng = createTournamentRng(seed, label);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateKnockoutRoundOne(
  participants: Participant[],
  seed?: number,
): Match[] {
  if (participants.length < 2) {
    return [];
  }
  const shuffled = shuffleWithSeed(participants, seed, "ko_round_1");
  const bracketSize = isPowerOfTwo(shuffled.length)
    ? shuffled.length
    : nextPowerOfTwo(shuffled.length);
  const ids = shuffled.map((p) => p.id);
  while (ids.length < bracketSize) ids.push(BYE_ID);

  const matches: Match[] = [];
  for (let i = 0; i < ids.length; i += 2) {
    matches.push({
      id: makeId("match"),
      playerA: ids[i],
      playerB: ids[i + 1],
      played: false,
      round: 1,
      stage: "KNOCKOUT",
    });
  }
  return matches;
}

export function maybeGenerateNextKnockoutRound(tournament: Tournament): Tournament {
  const koMatches = tournament.matches.filter((m) => m.stage === "KNOCKOUT");
  if (koMatches.length === 0) return tournament;

  const maxRound = Math.max(...koMatches.map((m) => m.round));
  const currentRound = koMatches.filter((m) => m.round === maxRound);
  const nextRoundExists = koMatches.some((m) => m.round === maxRound + 1);
  if (nextRoundExists || currentRound.some((m) => !m.played)) {
    return tournament;
  }

  const winners = currentRound
    .map((m) => m.winner)
    .filter((w): w is string => Boolean(w));
  if (winners.length <= 1) {
    return {
      ...tournament,
      status: winners.length === 1 ? "COMPLETED" : tournament.status,
    };
  }

  const nextMatches: Match[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    nextMatches.push({
      id: makeId("match"),
      playerA: winners[i],
      playerB: winners[i + 1] ?? BYE_ID,
      played: false,
      round: maxRound + 1,
      stage: "KNOCKOUT",
    });
  }
  return {
    ...tournament,
    matches: [...tournament.matches, ...nextMatches],
  };
}
