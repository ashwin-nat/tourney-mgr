import { BYE_ID, type Match, type Participant, type Tournament } from "../types";
import { createTournamentRng } from "../utils/rng";

const DEFAULT_DRAW_CHANCE = 0.05;
const SIMULATION_ROLLOUTS = 25;

export function winProbability(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 20));
}

function simulateWinnerOnce(
  tournament: Tournament,
  playerA: Participant,
  playerB: Participant,
  rng: () => number,
): string | undefined {
  const drawChance = tournament.settings.allowDraws ? DEFAULT_DRAW_CHANCE : 0;
  if (rng() < drawChance) return undefined;
  const pA = winProbability(playerA.rating, playerB.rating);
  return rng() < pA ? playerA.id : playerB.id;
}

export function simulateMatchResult(
  tournament: Tournament,
  match: Match,
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
    const winner = simulateWinnerOnce(tournament, a, b, rng);
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
