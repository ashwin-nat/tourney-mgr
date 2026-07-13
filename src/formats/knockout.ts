import {
  BYE_ID,
  TBD_ID,
  type Match,
  type Participant,
  type SlotSource,
  type Tournament,
} from "../types";
import { makeId } from "../utils/id";
import { createTournamentRng } from "../utils/rng";

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

type KnockoutRoundOneOptions = {
  doubleElimination?: boolean;
  upperParticipantIds?: string[];
  lowerParticipantIds?: string[];
  startRound?: number;
};

/**
 * A "slot reference" describes who fills a bracket slot. It is either a concrete
 * participant id (a seeded entrant or BYE) or a source pointing at the winner of
 * an already-created match.
 */
type SlotRef =
  | { kind: "id"; id: string }
  | { kind: "source"; source: SlotSource };

function idRef(id: string): SlotRef {
  return { kind: "id", id };
}

function winnerRef(matchId: string): SlotRef {
  return { kind: "source", source: { fromMatchId: matchId, take: "WINNER" } };
}

function loserRef(matchId: string): SlotRef {
  return { kind: "source", source: { fromMatchId: matchId, take: "LOSER" } };
}

function padRefs(refs: SlotRef[], size: number): SlotRef[] {
  const padded = [...refs];
  while (padded.length < size) padded.push(idRef(BYE_ID));
  return padded;
}

/** Create a match from two slot refs, returning the match and a ref to its winner. */
function makeMatchFromRefs(
  refA: SlotRef,
  refB: SlotRef,
  round: number,
  bracket: Match["knockoutBracket"],
  out: Match[],
): SlotRef {
  const match: Match = {
    id: makeId("match"),
    playerA: refA.kind === "id" ? refA.id : TBD_ID,
    playerB: refB.kind === "id" ? refB.id : TBD_ID,
    played: false,
    round,
    stage: "KNOCKOUT",
    ...(bracket ? { knockoutBracket: bracket } : {}),
    ...(refA.kind === "source" ? { sourceA: refA.source } : {}),
    ...(refB.kind === "source" ? { sourceB: refB.source } : {}),
  };
  out.push(match);
  return winnerRef(match.id);
}

/** Pair an even-length list of refs into a round of matches; returns winner refs. */
function pairRound(
  refs: SlotRef[],
  round: number,
  bracket: Match["knockoutBracket"],
  out: Match[],
): SlotRef[] {
  const winners: SlotRef[] = [];
  for (let i = 0; i < refs.length; i += 2) {
    winners.push(makeMatchFromRefs(refs[i], refs[i + 1], round, bracket, out));
  }
  return winners;
}

/**
 * Build a complete single-elimination tree (all rounds) as a fixed bracket.
 * Round 1 holds the seeded participants; later rounds reference the winners of
 * the prior round so pairings are locked regardless of results.
 */
export function buildSingleEliminationTree(
  seedIds: string[],
  startRound = 1,
  seed?: number,
  bracket?: Match["knockoutBracket"],
): { matches: Match[]; championRef: SlotRef | null } {
  const ids = shuffleWithSeed(
    uniqueIds(seedIds),
    seed,
    `ko_single_${bracket ?? "MAIN"}_${startRound}`,
  );
  if (ids.length < 2) {
    return { matches: [], championRef: ids.length === 1 ? idRef(ids[0]) : null };
  }

  const matches: Match[] = [];
  let round = startRound;
  let current = padRefs(ids.map(idRef), nextPowerOfTwo(ids.length));

  while (current.length > 1) {
    current = pairRound(current, round, bracket, matches);
    round += 1;
  }

  return { matches, championRef: current[0] ?? null };
}

/**
 * Build a complete lower bracket as a fixed tree. The lower bracket is seeded
 * with `lowerSeedIds` (entrants who start with a life already spent) and then
 * merges upper-bracket losers wave by wave (`upperLoserRefs[r]` = losers of
 * upper round r). When there are no lower seeds this reduces to a textbook
 * double-elimination lower bracket starting from the first upper-round losers.
 */
function buildLowerBracket(
  lowerSeedIds: string[],
  upperLoserRefs: SlotRef[][],
  startRound: number,
): { matches: Match[]; championRef: SlotRef | null } {
  const matches: Match[] = [];
  const totalUpperWaves = upperLoserRefs.length;
  const seeds = uniqueIds(lowerSeedIds);

  let round = startRound;
  let pending: SlotRef[];
  let nextWave: number;

  if (seeds.length > 0) {
    pending = padRefs(seeds.map(idRef), nextPowerOfTwo(seeds.length));
    nextWave = 1;
  } else if (totalUpperWaves >= 1) {
    pending = [...upperLoserRefs[0]];
    nextWave = 2;
  } else {
    return { matches, championRef: null };
  }

  // Guard against pathological inputs; the tree is finite so this never trips.
  for (let guard = 0; guard < 64; guard += 1) {
    // Minor round: survivors of the lower bracket play each other.
    let survivors: SlotRef[];
    if (pending.length > 1) {
      survivors = pairRound(pending, round, "LOWER", matches);
      round += 1;
    } else {
      survivors = pending;
    }

    if (nextWave > totalUpperWaves) {
      if (survivors.length <= 1) {
        return { matches, championRef: survivors[0] ?? null };
      }
      pending = survivors;
      continue;
    }

    // Major round: survivors face the next wave of upper-bracket losers.
    const wave = upperLoserRefs[nextWave - 1] ?? [];
    nextWave += 1;
    const size = nextPowerOfTwo(Math.max(survivors.length, wave.length, 1));
    const paddedSurvivors = padRefs(survivors, size);
    const paddedWave = padRefs(wave, size);
    const merged: SlotRef[] = [];
    for (let i = 0; i < size; i += 1) {
      merged.push(
        makeMatchFromRefs(paddedSurvivors[i], paddedWave[i], round, "LOWER", matches),
      );
    }
    round += 1;
    pending = merged;
  }

  return { matches, championRef: pending[0] ?? null };
}

/**
 * Build a complete double-elimination tree (upper bracket + lower bracket +
 * grand final) as a fixed bracket. Upper-bracket losers drop into fixed
 * lower-bracket slots; the grand final pairs the two bracket winners.
 */
export function buildDoubleEliminationTree(
  upperSeedIds: string[],
  lowerSeedIds: string[],
  startRound = 1,
  seed?: number,
): Match[] {
  const upperSeeds = uniqueIds(upperSeedIds);
  const lowerSet = new Set(upperSeeds);
  const lowerSeeds = uniqueIds(lowerSeedIds).filter((id) => !lowerSet.has(id));

  // Degenerate cases: not enough to form a real double-elimination bracket.
  if (upperSeeds.length < 2) {
    const all = uniqueIds([...upperSeeds, ...lowerSeeds]);
    return buildSingleEliminationTree(all, startRound, seed).matches;
  }

  const matches: Match[] = [];

  // Upper bracket. Round 1 ordering is shuffled with the seed for fairness;
  // the resulting tree is then fixed.
  const shuffledUpper = shuffleWithSeed(upperSeeds, seed, `ko_upper_${startRound}`);
  let round = startRound;
  let current = padRefs(shuffledUpper.map(idRef), nextPowerOfTwo(shuffledUpper.length));
  const upperLoserRefs: SlotRef[][] = [];
  while (current.length > 1) {
    const roundMatches: Match[] = [];
    const winners = pairRound(current, round, "UPPER", roundMatches);
    upperLoserRefs.push(roundMatches.map((m) => loserRef(m.id)));
    matches.push(...roundMatches);
    current = winners;
    round += 1;
  }
  const upperChampionRef = current[0] ?? null;

  // Lower bracket, seeded and merging the upper-bracket loser waves.
  const shuffledLower = shuffleWithSeed(lowerSeeds, seed, `ko_lower_${startRound}`);
  const lower = buildLowerBracket(shuffledLower, upperLoserRefs, startRound);
  matches.push(...lower.matches);

  // Grand final: upper-bracket winner vs lower-bracket winner.
  if (upperChampionRef && lower.championRef) {
    const grandRound = Math.max(...matches.map((m) => m.round), startRound) + 1;
    makeMatchFromRefs(
      upperChampionRef,
      lower.championRef,
      grandRound,
      "GRAND_FINAL",
      matches,
    );
  }

  return matches;
}

/**
 * Build the initial knockout matches as a complete fixed bracket tree.
 * (Name kept for call-site compatibility; this now produces every round.)
 */
export function generateKnockoutRoundOne(
  participants: Participant[],
  seed?: number,
  options: KnockoutRoundOneOptions = {},
): Match[] {
  if (participants.length < 2) {
    return [];
  }

  const startRound = Math.max(1, options.startRound ?? 1);
  const allIds = participants.map((p) => p.id);

  if (!options.doubleElimination) {
    return buildSingleEliminationTree(allIds, startRound, seed).matches;
  }

  const upperIds = options.upperParticipantIds
    ? uniqueIds(options.upperParticipantIds)
    : uniqueIds(allIds);
  const upperSet = new Set(upperIds);
  const lowerIds = uniqueIds(
    (options.lowerParticipantIds ?? allIds).filter((id) => !upperSet.has(id)),
  );

  return buildDoubleEliminationTree(upperIds, lowerIds, startRound, seed);
}

/** Resolve the value of a bracket slot fed from a source match. */
function slotValue(source: Match | undefined, take: SlotSource["take"]): string {
  if (!source || !source.played) return TBD_ID;
  if (take === "WINNER") {
    // A played match with no winner is a dead (BYE-vs-BYE) match.
    return source.winner ?? BYE_ID;
  }
  // LOSER
  if (!source.winner) return BYE_ID;
  return source.winner === source.playerA ? source.playerB : source.playerA;
}

/**
 * Propagate results through the fixed knockout tree. This is deterministic and
 * idempotent: it fills each derived slot from its source match, auto-resolves
 * byes, and invalidates any recorded result whose participants have changed
 * (e.g. after an upstream reroll). It never alters the bracket structure.
 */
export function resolveKnockoutBracket(tournament: Tournament): Tournament {
  const koMatches = tournament.matches.filter((m) => m.stage === "KNOCKOUT");
  if (koMatches.length === 0) return tournament;

  // Work on shallow clones keyed by id so sources see resolved upstream state.
  const clones = new Map<string, Match>();
  for (const match of koMatches) clones.set(match.id, { ...match });

  const resolved = new Set<string>();
  const resolveMatch = (match: Match): void => {
    if (resolved.has(match.id)) return;
    resolved.add(match.id);

    // Fill derived slots from their source matches (seeded slots are left as-is).
    if (match.sourceA) {
      const src = clones.get(match.sourceA.fromMatchId);
      if (src) resolveMatch(src);
      match.playerA = slotValue(src, match.sourceA.take);
    }
    if (match.sourceB) {
      const src = clones.get(match.sourceB.fromMatchId);
      if (src) resolveMatch(src);
      match.playerB = slotValue(src, match.sourceB.take);
    }

    const aTbd = match.playerA === TBD_ID;
    const bTbd = match.playerB === TBD_ID;
    if (aTbd || bTbd) {
      match.played = false;
      match.winner = undefined;
      return;
    }

    const aReal = match.playerA !== BYE_ID;
    const bReal = match.playerB !== BYE_ID;
    if (aReal && bReal) {
      // Both occupants known: keep an existing valid result, drop a stale one.
      if (
        match.winner !== undefined &&
        match.winner !== match.playerA &&
        match.winner !== match.playerB
      ) {
        match.played = false;
        match.winner = undefined;
      }
      return;
    }
    if (aReal) {
      match.played = true;
      match.winner = match.playerA;
    } else if (bReal) {
      match.played = true;
      match.winner = match.playerB;
    } else {
      // BYE vs BYE: a dead match with no winner.
      match.played = true;
      match.winner = undefined;
    }
  };

  for (const match of clones.values()) resolveMatch(match);

  const matches = tournament.matches.map((match) =>
    match.stage === "KNOCKOUT" ? clones.get(match.id) ?? match : match,
  );
  return { ...tournament, matches };
}

/**
 * Backwards-compatible entry point used by the store. The fixed tree is created
 * up front, so progression is now just propagation through that tree.
 */
export function maybeGenerateNextKnockoutRound(tournament: Tournament): Tournament {
  return resolveKnockoutBracket(tournament);
}
