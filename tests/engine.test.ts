import { describe, expect, it } from "vitest";
import { winProbability, simulateMatchResult } from "../src/engine/simulation";
import { maybeGenerateNextKnockoutRound } from "../src/formats/knockout";
import { maybeStartKnockoutAfterGroups } from "../src/formats/groups";
import { maybeGenerateSwissRound } from "../src/formats/swiss";
import type { Tournament } from "../src/types";

describe("simulation", () => {
  it("higher rating should have higher win probability", () => {
    expect(winProbability(80, 20)).toBeGreaterThan(0.5);
    expect(winProbability(20, 80)).toBeLessThan(0.5);
  });

  it("factors Elo into win probability", () => {
    const base = winProbability(50, 50);
    const withForm = winProbability(50, 50, {
      eloA: 80,
      eloB: 20,
      eloMatchesA: 40,
      eloMatchesB: 40,
    });
    expect(base).toBeCloseTo(0.5, 6);
    expect(withForm).toBeGreaterThan(base);
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

  it("routes upper-bracket losers into lower bracket in double elimination", () => {
    const tournament: Tournament = {
      id: "t3",
      name: "double",
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
          knockoutBracket: "UPPER",
        },
        {
          id: "m2",
          playerA: "c",
          playerB: "d",
          played: true,
          winner: "c",
          round: 1,
          stage: "KNOCKOUT",
          knockoutBracket: "UPPER",
        },
      ],
      settings: { doubleElimination: true },
      status: "IN_PROGRESS",
      schemaVersion: 1,
    };

    const next = maybeGenerateNextKnockoutRound(tournament);
    const upperRound2 = next.matches.filter(
      (match) => match.round === 2 && match.knockoutBracket === "UPPER",
    );
    const lowerRound2 = next.matches.filter(
      (match) => match.round === 2 && match.knockoutBracket === "LOWER",
    );

    expect(upperRound2).toHaveLength(1);
    expect(lowerRound2).toHaveLength(1);
    expect([upperRound2[0].playerA, upperRound2[0].playerB].sort()).toEqual(["a", "c"]);
    expect([lowerRound2[0].playerA, lowerRound2[0].playerB].sort()).toEqual(["b", "d"]);
  });
});

describe("group to knockout seeding", () => {
  it("splits qualifiers into upper and lower brackets when double elimination is enabled", () => {
    const tournament: Tournament = {
      id: "g1",
      name: "groups",
      format: "GROUP_KO",
      participants: [
        { id: "a", name: "A", rating: 50 },
        { id: "b", name: "B", rating: 50 },
        { id: "c", name: "C", rating: 50 },
        { id: "d", name: "D", rating: 50 },
      ],
      matches: [
        {
          id: "g1m1",
          playerA: "a",
          playerB: "b",
          played: true,
          winner: "a",
          round: 1,
          stage: "GROUP",
          groupId: "A",
        },
        {
          id: "g2m1",
          playerA: "c",
          playerB: "d",
          played: true,
          winner: "c",
          round: 1,
          stage: "GROUP",
          groupId: "B",
        },
      ],
      groups: [
        { id: "A", participantIds: ["a", "b"] },
        { id: "B", participantIds: ["c", "d"] },
      ],
      settings: { advancePerGroup: 2, doubleElimination: true },
      status: "IN_PROGRESS",
      schemaVersion: 1,
    };

    const next = maybeStartKnockoutAfterGroups(tournament);
    const upper = next.matches.filter((match) => match.knockoutBracket === "UPPER");
    const lower = next.matches.filter((match) => match.knockoutBracket === "LOWER");

    expect(upper).toHaveLength(1);
    expect(lower).toHaveLength(1);
    expect([upper[0].playerA, upper[0].playerB].sort()).toEqual(["a", "c"]);
    expect([lower[0].playerA, lower[0].playerB].sort()).toEqual(["b", "d"]);
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
