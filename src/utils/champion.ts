import { rankParticipants } from "../engine/standings";
import { BYE_ID } from "../types";
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

function runnerUpFromKnockout(tournament: Tournament): string | null {
  const knockoutMatches = tournament.matches.filter(
    (match) => match.stage === "KNOCKOUT" && match.played && match.winner,
  );
  if (!knockoutMatches.length) return null;
  const finalRound = Math.max(...knockoutMatches.map((match) => match.round));
  const final = knockoutMatches.find((match) => match.round === finalRound);
  if (!final?.winner) return null;
  const loser = final.winner === final.playerA ? final.playerB : final.playerA;
  return loser === BYE_ID ? null : loser;
}

function runnerUpFromStandings(tournament: Tournament): string | null {
  if (!tournament.standings) return null;
  const ranked = rankParticipants(tournament.participants, tournament.standings);
  return ranked[1]?.id ?? null;
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

export function getTournamentRunnerUpId(tournament: Tournament): string | null {
  if (tournament.status !== "COMPLETED") return null;
  if (tournament.format === "KNOCKOUT" || tournament.format === "GROUP_KO") {
    return runnerUpFromKnockout(tournament);
  }
  return runnerUpFromStandings(tournament);
}
