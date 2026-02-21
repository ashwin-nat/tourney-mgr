import type { Match, Participant, Standing } from "../types";

function emptyStanding(): Standing {
  return { played: 0, wins: 0, losses: 0, draws: 0, points: 0, buchholz: 0 };
}

export function buildStandings(
  participants: Participant[],
  matches: Match[],
): Record<string, Standing> {
  const table: Record<string, Standing> = {};
  for (const p of participants) {
    table[p.id] = emptyStanding();
  }

  const playedMatches = matches.filter((m) => m.played);
  for (const match of playedMatches) {
    const a = table[match.playerA];
    const b = table[match.playerB];
    if (!a || !b) {
      continue;
    }
    a.played += 1;
    b.played += 1;
    if (match.winner === undefined) {
      a.draws += 1;
      b.draws += 1;
      a.points += 1;
      b.points += 1;
      continue;
    }
    if (match.winner === match.playerA) {
      a.wins += 1;
      b.losses += 1;
      a.points += 3;
    } else if (match.winner === match.playerB) {
      b.wins += 1;
      a.losses += 1;
      b.points += 3;
    }
  }

  for (const p of participants) {
    const opponents = playedMatches
      .filter((m) => m.playerA === p.id || m.playerB === p.id)
      .map((m) => (m.playerA === p.id ? m.playerB : m.playerA));
    table[p.id].buchholz = opponents.reduce(
      (acc, id) => acc + (table[id]?.points ?? 0),
      0,
    );
  }

  return table;
}

export function rankParticipants(
  participants: Participant[],
  standings: Record<string, Standing>,
): Participant[] {
  return [...participants].sort((a, b) => {
    const sa = standings[a.id];
    const sb = standings[b.id];
    if (sa.points !== sb.points) return sb.points - sa.points;
    if ((sa.buchholz ?? 0) !== (sb.buchholz ?? 0))
      return (sb.buchholz ?? 0) - (sa.buchholz ?? 0);
    return b.rating - a.rating;
  });
}
