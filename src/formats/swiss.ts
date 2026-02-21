import { buildStandings, rankParticipants } from "../engine/standings";
import type { Match, Tournament } from "../types";
import { BYE_ID } from "../types";
import { makeId } from "../utils/id";

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

export function maybeGenerateSwissRound(tournament: Tournament): Tournament {
  if (tournament.format !== "SWISS") return tournament;
  const maxRounds = tournament.settings.rounds ?? 5;
  const maxMeetingsPerPair = tournament.settings.faceOpponentsTwice ? 2 : 1;
  const swissMatches = tournament.matches.filter((m) => m.stage === "SWISS");
  const lastRound = Math.max(0, ...swissMatches.map((m) => m.round));
  const hasUnplayed = swissMatches.some((m) => !m.played);
  if (hasUnplayed) return tournament;
  if (lastRound >= maxRounds) {
    return { ...tournament, status: "COMPLETED" };
  }

  const standings = buildStandings(tournament.participants, swissMatches);
  const ranked = rankParticipants(tournament.participants, standings);
  const pairingCounts = new Map<string, number>();
  swissMatches.forEach((m) => {
    const key = pairKey(m.playerA, m.playerB);
    pairingCounts.set(key, (pairingCounts.get(key) ?? 0) + 1);
  });
  const hadBye = new Set(
    swissMatches
      .filter((m) => m.playerA === BYE_ID || m.playerB === BYE_ID)
      .map((m) => (m.playerA === BYE_ID ? m.playerB : m.playerA)),
  );

  const pool = [...ranked];
  const pairs: Array<[string, string]> = [];
  if (pool.length % 2 !== 0) {
    const byeIndex = [...pool]
      .reverse()
      .findIndex((p) => !hadBye.has(p.id));
    const resolvedIndex = byeIndex === -1 ? pool.length - 1 : pool.length - 1 - byeIndex;
    const bye = pool.splice(resolvedIndex, 1)[0];
    pairs.push([bye.id, BYE_ID]);
  }

  while (pool.length > 1) {
    const a = pool.shift()!;
    let idx = pool.findIndex(
      (b) => (pairingCounts.get(pairKey(a.id, b.id)) ?? 0) < maxMeetingsPerPair,
    );
    if (idx === -1) idx = 0;
    const [b] = pool.splice(idx, 1);
    pairs.push([a.id, b.id]);
    const key = pairKey(a.id, b.id);
    pairingCounts.set(key, (pairingCounts.get(key) ?? 0) + 1);
  }

  const newMatches: Match[] = pairs.map(([playerA, playerB]) => ({
    id: makeId("match"),
    playerA,
    playerB,
    played: false,
    round: lastRound + 1,
    stage: "SWISS",
  }));

  return {
    ...tournament,
    matches: [...tournament.matches, ...newMatches],
    standings,
  };
}
