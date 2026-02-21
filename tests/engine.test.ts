import { describe, expect, it } from "vitest";
import { winProbability, simulateMatchResult } from "../src/engine/simulation";
import { maybeGenerateNextKnockoutRound } from "../src/formats/knockout";
import { maybeGenerateSwissRound } from "../src/formats/swiss";
import type { Tournament } from "../src/types";

describe("simulation", () => {
  it("higher rating should have higher win probability", () => {
    expect(winProbability(80, 20)).toBeGreaterThan(0.5);
    expect(winProbability(20, 80)).toBeLessThan(0.5);
  });

  it("is deterministic with seed + match id", () => {
    const tournament: Tournament = {
      id: "t1",
      name: "det",
      format: "KNOCKOUT",
      participants: [
        { id: "a", name: "A", rating: 70 },
        { id: "b", name: "B", rating: 30 },
      ],
      matches: [],
      settings: { randomSeed: 42 },
      status: "IN_PROGRESS",
      schemaVersion: 1,
    };
    const match = {
      id: "m1",
      playerA: "a",
      playerB: "b",
      played: false,
      round: 1,
      stage: "KNOCKOUT" as const,
    };
    expect(simulateMatchResult(tournament, match)).toEqual(
      simulateMatchResult(tournament, match),
    );
  });
});

describe("knockout progression", () => {
  it("creates next round from completed round winners", () => {
    const tournament: Tournament = {
      id: "t2",
      name: "ko",
      format: "KNOCKOUT",
      participants: [],
      matches: [
        {
          id: "m1",
          playerA: "a",
          playerB: "b",
          played: true,
          winner: "a",
          round: 1,
          stage: "KNOCKOUT",
        },
        {
          id: "m2",
          playerA: "c",
          playerB: "d",
          played: true,
          winner: "c",
          round: 1,
          stage: "KNOCKOUT",
        },
      ],
      settings: {},
      status: "IN_PROGRESS",
      schemaVersion: 1,
    };
    const next = maybeGenerateNextKnockoutRound(tournament);
    const round2 = next.matches.filter((m) => m.round === 2);
    expect(round2).toHaveLength(1);
    expect(round2[0].playerA).toBe("a");
    expect(round2[0].playerB).toBe("c");
  });
});

describe("swiss pairing", () => {
  it("avoids duplicate pairings when alternatives exist", () => {
    const tournament: Tournament = {
      id: "sw1",
      name: "swiss",
      format: "SWISS",
      participants: [
        { id: "a", name: "A", rating: 50 },
        { id: "b", name: "B", rating: 50 },
        { id: "c", name: "C", rating: 50 },
        { id: "d", name: "D", rating: 50 },
      ],
      matches: [
        {
          id: "m1",
          playerA: "a",
          playerB: "b",
          played: true,
          winner: "a",
          round: 1,
          stage: "SWISS",
        },
        {
          id: "m2",
          playerA: "c",
          playerB: "d",
          played: true,
          winner: "c",
          round: 1,
          stage: "SWISS",
        },
      ],
      settings: { rounds: 3 },
      status: "IN_PROGRESS",
      schemaVersion: 1,
    };
    const next = maybeGenerateSwissRound(tournament);
    const r2 = next.matches.filter((m) => m.round === 2);
    const pairs = r2.map((m) => [m.playerA, m.playerB].sort().join(":"));
    expect(pairs).not.toContain("a:b");
    expect(pairs).not.toContain("c:d");
  });
});
