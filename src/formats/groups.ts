import { buildStandings, rankParticipants } from "../engine/standings";
import type { Group, Match, Participant, Tournament } from "../types";
import { makeId } from "../utils/id";
import { createTournamentRng } from "../utils/rng";
import { generateKnockoutRoundOne } from "./knockout";
import { roundRobinPairings } from "./roundRobin";

function shuffleWithSeed<T>(items: T[], seed: number | undefined, label: string): T[] {
  const rng = createTournamentRng(seed, label);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createBalancedGroups(
  participants: Participant[],
  groupCount: number,
  randomSeed?: number,
): Group[] {
  const groups: Group[] = Array.from({ length: groupCount }).map((_, i) => ({
    id: String.fromCharCode(65 + i),
    participantIds: [],
  }));
  const shuffled = shuffleWithSeed(participants, randomSeed, "groups_seed");
  shuffled.forEach((p, index) => {
    groups[index % groupCount].participantIds.push(p.id);
  });
  return groups;
}

export function generateGroupStageMatches(
  groups: Group[],
  faceOpponentsTwice = false,
): Match[] {
  const matches: Match[] = [];
  groups.forEach((group) => {
    const rounds = roundRobinPairings(group.participantIds);
    rounds.forEach((roundPairs, idx) => {
      roundPairs.forEach(([playerA, playerB]) => {
        matches.push({
          id: makeId("match"),
          playerA,
          playerB,
          played: false,
          round: idx + 1,
          stage: "GROUP",
          groupId: group.id,
        });
      });
    });
    if (faceOpponentsTwice) {
      rounds.forEach((roundPairs, idx) => {
        roundPairs.forEach(([playerA, playerB]) => {
          matches.push({
            id: makeId("match"),
            playerA: playerB,
            playerB: playerA,
            played: false,
            round: rounds.length + idx + 1,
            stage: "GROUP",
            groupId: group.id,
          });
        });
      });
    }
  });
  return matches;
}

function applyHeadToHeadTieBreak(
  ordered: Participant[],
  groupMatches: Match[],
): Participant[] {
  if (ordered.length < 2) return ordered;
  const a = ordered[0];
  const b = ordered[1];
  const h2h = groupMatches.find(
    (m) =>
      m.played &&
      ((m.playerA === a.id && m.playerB === b.id) ||
        (m.playerA === b.id && m.playerB === a.id)),
  );
  if (!h2h?.winner) return ordered;
  if (h2h.winner === a.id) return ordered;
  return [b, a, ...ordered.slice(2)];
}

export function maybeStartKnockoutAfterGroups(tournament: Tournament): Tournament {
  if (tournament.format !== "GROUP_KO") return tournament;
  const groupMatches = tournament.matches.filter((m) => m.stage === "GROUP");
  const knockoutAlready = tournament.matches.some((m) => m.stage === "KNOCKOUT");
  if (groupMatches.length === 0 || groupMatches.some((m) => !m.played) || knockoutAlready) {
    return tournament;
  }

  const advancePerGroup = tournament.settings.advancePerGroup ?? 2;
  const groups = tournament.groups ?? [];
  const byId = new Map(tournament.participants.map((p) => [p.id, p]));
  const qualifiers: Participant[] = [];

  for (const group of groups) {
    const groupParticipants = group.participantIds
      .map((id) => byId.get(id))
      .filter((p): p is Participant => Boolean(p));
    const standing = buildStandings(
      groupParticipants,
      groupMatches.filter((m) => m.groupId === group.id),
    );
    const ranked = applyHeadToHeadTieBreak(
      rankParticipants(groupParticipants, standing),
      groupMatches.filter((m) => m.groupId === group.id),
    );
    qualifiers.push(...ranked.slice(0, advancePerGroup));
  }

  const koMatches = generateKnockoutRoundOne(
    qualifiers,
    tournament.settings.randomSeed,
  ).map((m) => ({ ...m, round: (Math.max(...groupMatches.map((gm) => gm.round), 0) || 0) + 1 }));

  return {
    ...tournament,
    matches: [...tournament.matches, ...koMatches],
  };
}
