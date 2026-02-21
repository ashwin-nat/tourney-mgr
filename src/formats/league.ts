import type { Match, Participant } from "../types";
import { makeId } from "../utils/id";
import { roundRobinPairings } from "./roundRobin";

export function generateLeagueMatches(
  participants: Participant[],
  faceOpponentsTwice = false,
): Match[] {
  const rounds = roundRobinPairings(participants.map((participant) => participant.id));
  const matches: Match[] = [];

  rounds.forEach((roundPairs, idx) => {
    roundPairs.forEach(([playerA, playerB]) => {
      matches.push({
        id: makeId("match"),
        playerA,
        playerB,
        played: false,
        round: idx + 1,
        stage: "LEAGUE",
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
          stage: "LEAGUE",
        });
      });
    });
  }

  return matches;
}
