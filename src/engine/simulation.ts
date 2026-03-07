import {
  BYE_ID,
  type Match,
  type Participant,
  type ParticipantHistory,
  type Tournament,
} from "../types";
import { createTournamentRng } from "../utils/rng";

const DEFAULT_DRAW_CHANCE = 0.05;
const SIMULATION_ROLLOUTS = 25;
const ELO_BLEND_MAX = 0.35;
const ELO_BLEND_MATCHES = 40;

type WinProbabilityInputs = {
  eloA?: number;
  eloB?: number;
  eloMatchesA?: number;
  eloMatchesB?: number;
};

function eloBlendWeight(matchesPlayed: number): number {
  if (matchesPlayed <= 0) return 0;
  return Math.min(ELO_BLEND_MAX, (matchesPlayed / ELO_BLEND_MATCHES) * ELO_BLEND_MAX);
}

function effectiveSimulationRating(rating: number, elo?: number, eloMatches = 0): number {
  if (typeof elo !== "number") return rating;
  const weight = eloBlendWeight(eloMatches);
  return rating * (1 - weight) + elo * weight;
}

export function winProbability(
  ratingA: number,
  ratingB: number,
  inputs: WinProbabilityInputs = {},
): number {
  const effectiveA = effectiveSimulationRating(ratingA, inputs.eloA, inputs.eloMatchesA);
  const effectiveB = effectiveSimulationRating(ratingB, inputs.eloB, inputs.eloMatchesB);
  return 1 / (1 + 10 ** ((effectiveB - effectiveA) / 20));
}

function historyKey(name: string): string {
  return name.trim().toLowerCase();
}

function getParticipantForm(
  participant: Participant,
  participantHistory?: Record<string, ParticipantHistory>,
): { elo?: number; eloMatches: number } {
  if (!participantHistory) return { elo: undefined, eloMatches: 0 };
  const entry = participantHistory[historyKey(participant.name)];
  if (!entry) return { elo: undefined, eloMatches: 0 };
  return { elo: entry.elo, eloMatches: entry.eloMatches };
}

function simulateWinnerOnce(
  tournament: Tournament,
  playerA: Participant,
  playerB: Participant,
  participantHistory: Record<string, ParticipantHistory> | undefined,
  rng: () => number,
): string | undefined {
  const drawChance = tournament.settings.allowDraws ? DEFAULT_DRAW_CHANCE : 0;
  if (rng() < drawChance) return undefined;
  const aForm = getParticipantForm(playerA, participantHistory);
  const bForm = getParticipantForm(playerB, participantHistory);
  const pA = winProbability(playerA.rating, playerB.rating, {
    eloA: aForm.elo,
    eloB: bForm.elo,
    eloMatchesA: aForm.eloMatches,
    eloMatchesB: bForm.eloMatches,
  });
  return rng() < pA ? playerA.id : playerB.id;
}

export function simulateMatchResult(
  tournament: Tournament,
  match: Match,
  participantHistory?: Record<string, ParticipantHistory>,
): Pick<Match, "played" | "winner"> {
  if (match.playerA === BYE_ID && match.playerB === BYE_ID) {
    return { played: true, winner: undefined };
  }
  if (match.playerA === BYE_ID) {
    return { played: true, winner: match.playerB };
  }
  if (match.playerB === BYE_ID) {
    return { played: true, winner: match.playerA };
  }

  const map = new Map<string, Participant>(
    tournament.participants.map((p) => [p.id, p]),
  );
  const a = map.get(match.playerA);
  const b = map.get(match.playerB);
  if (!a || !b) {
    throw new Error("Cannot simulate match with unknown participants.");
  }

  const rng = createTournamentRng(tournament.settings.randomSeed, match.id);
  let aWins = 0;
  let bWins = 0;
  let draws = 0;

  for (let i = 0; i < SIMULATION_ROLLOUTS; i += 1) {
    const winner = simulateWinnerOnce(tournament, a, b, participantHistory, rng);
    if (winner === a.id) aWins += 1;
    else if (winner === b.id) bWins += 1;
    else draws += 1;
  }

  let winner: string | undefined = a.id;
  let maxWins = aWins;
  if (bWins > maxWins) {
    winner = b.id;
    maxWins = bWins;
  }
  if (draws > maxWins) {
    winner = undefined;
  }

  return { played: true, winner };
}
