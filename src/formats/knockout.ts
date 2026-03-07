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

type KnockoutRoundOneOptions = {
  doubleElimination?: boolean;
  upperParticipantIds?: string[];
  lowerParticipantIds?: string[];
  startRound?: number;
};

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  return unique;
}

function buildSingleEliminationRound(
  participantIds: string[],
  round: number,
): Match[] {
  if (participantIds.length < 2) {
    return [];
  }

  const bracketSize = isPowerOfTwo(participantIds.length)
    ? participantIds.length
    : nextPowerOfTwo(participantIds.length);
  const ids = [...participantIds];
  while (ids.length < bracketSize) ids.push(BYE_ID);

  const matches: Match[] = [];
  for (let i = 0; i < ids.length; i += 2) {
    matches.push({
      id: makeId("match"),
      playerA: ids[i],
      playerB: ids[i + 1],
      played: false,
      round,
      stage: "KNOCKOUT",
    });
  }
  return matches;
}

function buildDoubleEliminationBracketRound(
  participantIds: string[],
  round: number,
  bracket: NonNullable<Match["knockoutBracket"]>,
): Match[] {
  if (participantIds.length < 2) return [];

  const matches: Match[] = [];
  for (let i = 0; i < participantIds.length; i += 2) {
    matches.push({
      id: makeId("match"),
      playerA: participantIds[i],
      playerB: participantIds[i + 1] ?? BYE_ID,
      played: false,
      round,
      stage: "KNOCKOUT",
      knockoutBracket: bracket,
    });
  }
  return matches;
}

function knockoutParticipants(matches: Match[]): string[] {
  return uniqueIds(
    matches
      .filter((match) => match.stage === "KNOCKOUT")
      .flatMap((match) => [match.playerA, match.playerB])
      .filter((id) => id !== BYE_ID),
  );
}

function calculateLossCounts(koMatches: Match[]): Map<string, number> | null {
  const losses = new Map<string, number>();
  const participants = knockoutParticipants(koMatches);
  for (const participantId of participants) {
    losses.set(participantId, 0);
  }

  for (const match of koMatches) {
    if (!match.played) continue;
    if (!match.winner) {
      return null;
    }
    const loser = match.winner === match.playerA ? match.playerB : match.playerA;
    if (loser === BYE_ID) continue;
    losses.set(loser, (losses.get(loser) ?? 0) + 1);
  }

  return losses;
}

function maybeGenerateNextDoubleEliminationRound(tournament: Tournament): Tournament {
  const koMatches = tournament.matches.filter((m) => m.stage === "KNOCKOUT");
  if (koMatches.length === 0) return tournament;
  if (koMatches.some((match) => !match.played)) return tournament;

  const grandFinal = koMatches.find((match) => match.knockoutBracket === "GRAND_FINAL");
  if (grandFinal?.played && grandFinal.winner) {
    return { ...tournament, status: "COMPLETED" };
  }

  const losses = calculateLossCounts(koMatches);
  if (!losses) return tournament;

  const active = [...losses.entries()]
    .filter(([, lossCount]) => lossCount < 2)
    .map(([participantId]) => participantId);
  const undefeated = active.filter((participantId) => (losses.get(participantId) ?? 0) === 0);
  const lowerBracket = active.filter((participantId) => (losses.get(participantId) ?? 0) === 1);

  if (
    (undefeated.length === 1 && lowerBracket.length === 0) ||
    (undefeated.length === 0 && lowerBracket.length === 1)
  ) {
    return { ...tournament, status: "COMPLETED" };
  }

  const nextRound = Math.max(...koMatches.map((match) => match.round), 0) + 1;

  if (undefeated.length === 1 && lowerBracket.length === 1 && !grandFinal) {
    return {
      ...tournament,
      matches: [
        ...tournament.matches,
        {
          id: makeId("match"),
          playerA: undefeated[0],
          playerB: lowerBracket[0],
          played: false,
          round: nextRound,
          stage: "KNOCKOUT",
          knockoutBracket: "GRAND_FINAL",
        },
      ],
    };
  }

  const nextMatches: Match[] = [];
  if (undefeated.length > 1) {
    nextMatches.push(
      ...buildDoubleEliminationBracketRound(
        shuffleWithSeed(
          undefeated,
          tournament.settings.randomSeed,
          `ko_upper_round_${nextRound}`,
        ),
        nextRound,
        "UPPER",
      ),
    );
  }
  if (lowerBracket.length > 1) {
    nextMatches.push(
      ...buildDoubleEliminationBracketRound(
        shuffleWithSeed(
          lowerBracket,
          tournament.settings.randomSeed,
          `ko_lower_round_${nextRound}`,
        ),
        nextRound,
        "LOWER",
      ),
    );
  }

  if (nextMatches.length === 0) {
    return tournament;
  }

  return {
    ...tournament,
    matches: [...tournament.matches, ...nextMatches],
  };
}

export function generateKnockoutRoundOne(
  participants: Participant[],
  seed?: number,
  options: KnockoutRoundOneOptions = {},
): Match[] {
  if (participants.length < 2) {
    return [];
  }

  const startRound = Math.max(1, options.startRound ?? 1);
  const shuffled = shuffleWithSeed(participants, seed, "ko_round_1");
  const shuffledIds = shuffled.map((p) => p.id);

  if (!options.doubleElimination) {
    return buildSingleEliminationRound(shuffledIds, startRound);
  }

  const resolvedUpperIds = options.upperParticipantIds
    ? uniqueIds(options.upperParticipantIds)
    : shuffledIds;
  const upperSet = new Set(resolvedUpperIds);
  const resolvedLowerIds = uniqueIds(
    options.lowerParticipantIds
      ? options.lowerParticipantIds.filter((participantId) => !upperSet.has(participantId))
      : shuffledIds.filter((participantId) => !upperSet.has(participantId)),
  );

  const upperMatches = buildDoubleEliminationBracketRound(
    shuffleWithSeed(resolvedUpperIds, seed, `ko_round_1_upper_${startRound}`),
    startRound,
    "UPPER",
  );
  const lowerMatches = buildDoubleEliminationBracketRound(
    shuffleWithSeed(resolvedLowerIds, seed, `ko_round_1_lower_${startRound}`),
    startRound,
    "LOWER",
  );

  return [...upperMatches, ...lowerMatches];
}

function maybeGenerateNextSingleEliminationRound(tournament: Tournament): Tournament {
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

export function maybeGenerateNextKnockoutRound(tournament: Tournament): Tournament {
  if (!tournament.settings.doubleElimination) {
    return maybeGenerateNextSingleEliminationRound(tournament);
  }
  return maybeGenerateNextDoubleEliminationRound(tournament);
}
