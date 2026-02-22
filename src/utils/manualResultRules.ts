import type { Match } from "../types";

type ManualEditContext = {
  allowedRound: number;
  currentRoundStarted: boolean;
};

export function getStageManualEditContext(stageMatches: Match[]): ManualEditContext {
  const currentUnplayedRound = stageMatches.find((match) => !match.played)?.round;
  const stageLatestRound = Math.max(...stageMatches.map((match) => match.round), 0);
  const allowedRound = currentUnplayedRound ?? stageLatestRound;
  const currentRoundStarted = stageMatches
    .filter((match) => match.round === allowedRound)
    .some((match) => match.played);
  return { allowedRound, currentRoundStarted };
}

export function isManualRoundEditAllowed(
  stageMatches: Match[],
  targetRound: number,
): boolean {
  const { allowedRound, currentRoundStarted } = getStageManualEditContext(stageMatches);
  return (
    targetRound === allowedRound ||
    (targetRound === allowedRound - 1 && !currentRoundStarted)
  );
}

export function isGroupRoundEditAllowed(
  groupMatches: Match[],
  knockoutMatches: Match[],
  targetRound: number,
): boolean {
  if (knockoutMatches.length === 0) return true;
  if (knockoutMatches.some((match) => match.played)) return false;
  const lastGroupRound = Math.max(...groupMatches.map((match) => match.round), 0);
  return targetRound === lastGroupRound;
}
