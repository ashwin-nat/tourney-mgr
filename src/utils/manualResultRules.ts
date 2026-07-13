import { BYE_ID, TBD_ID, type Match } from "../types";

/**
 * A knockout match in the fixed bracket can be recorded or re-rolled whenever
 * both of its slots hold real participants. Unresolved (TBD) or BYE slots are
 * not editable; results propagate through the tree automatically.
 */
export function isKnockoutMatchEditable(match: Match): boolean {
  return (
    match.playerA !== BYE_ID &&
    match.playerA !== TBD_ID &&
    match.playerB !== BYE_ID &&
    match.playerB !== TBD_ID
  );
}

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
