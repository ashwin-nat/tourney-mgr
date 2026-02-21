import { rankParticipants } from "../engine/standings";
import type { Tournament } from "../types";

function championFromKnockout(tournament: Tournament): string | null {
  const knockoutMatches = tournament.matches.filter(
    (match) => match.stage === "KNOCKOUT" && match.played && match.winner,
  );
  if (!knockoutMatches.length) return null;
  const finalRound = Math.max(...knockoutMatches.map((match) => match.round));
  const final = knockoutMatches.find((match) => match.round === finalRound);
  return final?.winner ?? null;
}

function championFromStandings(tournament: Tournament): string | null {
  if (!tournament.standings) return null;
  const ranked = rankParticipants(tournament.participants, tournament.standings);
  return ranked[0]?.id ?? null;
}

export function getTournamentChampionId(tournament: Tournament): string | null {
  if (tournament.status !== "COMPLETED") return null;
  if (tournament.format === "KNOCKOUT" || tournament.format === "GROUP_KO") {
    return championFromKnockout(tournament);
  }
  return championFromStandings(tournament);
}

export function getTournamentChampionName(tournament: Tournament): string | null {
  const championId = getTournamentChampionId(tournament);
  if (!championId) return null;
  const champion = tournament.participants.find((participant) => participant.id === championId);
  return champion?.name ?? null;
}
