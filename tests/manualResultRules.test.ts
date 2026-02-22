import { describe, expect, it } from "vitest";
import type { Match } from "../src/types";
import {
  getStageManualEditContext,
  isGroupRoundEditAllowed,
  isManualRoundEditAllowed,
} from "../src/utils/manualResultRules";

function match(round: number, played: boolean): Match {
  return {
    id: `${round}-${played ? "p" : "u"}`,
    playerA: "a",
    playerB: "b",
    played,
    round,
    stage: "KNOCKOUT",
  };
}

describe("manual round edit rules", () => {
  it("allows editing previous round when current round has not started", () => {
    const stageMatches = [match(1, true), match(1, true), match(2, false), match(2, false)];
    const context = getStageManualEditContext(stageMatches);

    expect(context.allowedRound).toBe(2);
    expect(context.currentRoundStarted).toBe(false);
    expect(isManualRoundEditAllowed(stageMatches, 2)).toBe(true);
    expect(isManualRoundEditAllowed(stageMatches, 1)).toBe(true);
    expect(isManualRoundEditAllowed(stageMatches, 0)).toBe(false);
  });

  it("blocks editing previous round once current round has started", () => {
    const stageMatches = [match(1, true), match(1, true), match(2, true), match(2, false)];
    const context = getStageManualEditContext(stageMatches);

    expect(context.allowedRound).toBe(2);
    expect(context.currentRoundStarted).toBe(true);
    expect(isManualRoundEditAllowed(stageMatches, 2)).toBe(true);
    expect(isManualRoundEditAllowed(stageMatches, 1)).toBe(false);
  });

  it("allows editing last group round when knockout exists but has not started", () => {
    const groupMatches = [match(1, true), match(2, true), match(3, true)];
    const knockoutMatches: Match[] = [
      { ...match(4, false), stage: "KNOCKOUT" },
      { ...match(4, false), id: "4-u-2", stage: "KNOCKOUT" },
    ];
    expect(isGroupRoundEditAllowed(groupMatches, knockoutMatches, 3)).toBe(true);
    expect(isGroupRoundEditAllowed(groupMatches, knockoutMatches, 2)).toBe(false);
  });

  it("blocks group editing once knockout has started", () => {
    const groupMatches = [match(1, true), match(2, true), match(3, true)];
    const knockoutMatches: Match[] = [
      { ...match(4, true), stage: "KNOCKOUT" },
      { ...match(4, false), id: "4-u-2", stage: "KNOCKOUT" },
    ];
    expect(isGroupRoundEditAllowed(groupMatches, knockoutMatches, 3)).toBe(false);
  });
});
