import { describe, expect, it } from "vitest";
import { applyEloUpdate, ELO_DEFAULT_RATING } from "../src/engine/elo";

describe("elo", () => {
  it("rewards an upset more than an expected win", () => {
    const expectedWin = applyEloUpdate(80, 20, 1, 50, 50);
    const upsetWin = applyEloUpdate(20, 80, 1, 50, 50);
    const expectedGain = expectedWin.ratingA - 80;
    const upsetGain = upsetWin.ratingA - 20;
    expect(upsetGain).toBeGreaterThan(expectedGain);
  });

  it("is symmetric for equal ratings and opposite outcomes", () => {
    const aWins = applyEloUpdate(ELO_DEFAULT_RATING, ELO_DEFAULT_RATING, 1, 0, 0);
    const bWins = applyEloUpdate(ELO_DEFAULT_RATING, ELO_DEFAULT_RATING, 0, 0, 0);
    expect(aWins.ratingA - ELO_DEFAULT_RATING).toBeCloseTo(
      ELO_DEFAULT_RATING - bWins.ratingA,
      6,
    );
  });

  it("treats draws as near-zero change for equal ratings", () => {
    const draw = applyEloUpdate(ELO_DEFAULT_RATING, ELO_DEFAULT_RATING, 0.5, 10, 10);
    expect(draw.ratingA).toBeCloseTo(ELO_DEFAULT_RATING, 6);
    expect(draw.ratingB).toBeCloseTo(ELO_DEFAULT_RATING, 6);
  });
});
