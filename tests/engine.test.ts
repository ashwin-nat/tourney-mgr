import { describe, expect, it } from "vitest";
import { winProbability, simulateMatchResult } from "../src/engine/simulation";
import {
  buildDoubleEliminationTree,
  buildSingleEliminationTree,
  resolveKnockoutBracket,
} from "../src/formats/knockout";
import { maybeStartKnockoutAfterGroups } from "../src/formats/groups";
import { maybeGenerateSwissRound } from "../src/formats/swiss";
import { TBD_ID, type Match, type Tournament } from "../src/types";

function knockoutTournament(matches: Match[]): Tournament {
  return {
    id: "ko",
    name: "ko",
    format: "KNOCKOUT",
    participants: [],
    matches,
    settings: { doubleElimination: matches.some((m) => m.knockoutBracket) },
    status: "IN_PROGRESS",
    schemaVersion: 2,
  };
}

function recordResult(tournament: Tournament, matchId: string, winnerId: string): Tournament {
  const matches = tournament.matches.map((match) =>
    match.id === matchId ? { ...match, played: true, winner: winnerId } : match,
  );
  return resolveKnockoutBracket({ ...tournament, matches });
}

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

describe("knockout fixed bracket", () => {
  it("builds the full single-elimination tree up front with locked pairings", () => {
    const { matches } = buildSingleEliminationTree(["a", "b", "c", "d"], 1, 42);
    const round1 = matches.filter((m) => m.round === 1);
    const round2 = matches.filter((m) => m.round === 2);

    expect(round1).toHaveLength(2);
    expect(round2).toHaveLength(1);
    // The final exists before any result and references the round-1 winners.
    expect(round2[0].playerA).toBe(TBD_ID);
    expect(round2[0].playerB).toBe(TBD_ID);
    expect(round2[0].sourceA).toEqual({ fromMatchId: round1[0].id, take: "WINNER" });
    expect(round2[0].sourceB).toEqual({ fromMatchId: round1[1].id, take: "WINNER" });
  });

  it("enforces winner-of-m1 vs winner-of-m2 and keeps pairings fixed across a reroll", () => {
    const { matches } = buildSingleEliminationTree(["a", "b", "c", "d"], 1, 42);
    const [m1, m2] = matches.filter((m) => m.round === 1);
    const finalId = matches.find((m) => m.round === 2)!.id;

    let tournament = recordResult(knockoutTournament(matches), m1.id, m1.playerA);
    tournament = recordResult(tournament, m2.id, m2.playerA);
    const finalBefore = tournament.matches.find((m) => m.id === finalId)!;
    expect(finalBefore.playerA).toBe(m1.playerA);
    expect(finalBefore.playerB).toBe(m2.playerA);

    // Record the final, then reroll the first round-1 match.
    tournament = recordResult(tournament, finalId, m1.playerA);
    const rerolled = recordResult(tournament, m1.id, m1.playerB);
    const finalAfter = rerolled.matches.find((m) => m.id === finalId)!;

    // Pairing graph is unchanged; only the occupant and the now-stale result move.
    expect(finalAfter.sourceA).toEqual(finalBefore.sourceA);
    expect(finalAfter.sourceB).toEqual(finalBefore.sourceB);
    expect(finalAfter.playerA).toBe(m1.playerB);
    expect(finalAfter.played).toBe(false);
    expect(finalAfter.winner).toBeUndefined();
  });

  it("drops upper-bracket losers into fixed lower-bracket slots", () => {
    const matches = buildDoubleEliminationTree(["a", "b", "c", "d"], [], 1, 42);
    const upper = matches.filter((m) => m.knockoutBracket === "UPPER");
    const lower = matches.filter((m) => m.knockoutBracket === "LOWER");
    const grandFinal = matches.filter((m) => m.knockoutBracket === "GRAND_FINAL");

    expect(upper).toHaveLength(3); // 2 + 1
    expect(grandFinal).toHaveLength(1);
    // At least one lower-bracket slot is fed by an upper-bracket loser.
    expect(
      lower.some(
        (m) => m.sourceA?.take === "LOSER" || m.sourceB?.take === "LOSER",
      ),
    ).toBe(true);
    // Grand final pairs the two bracket winners.
    expect(grandFinal[0].sourceA?.take).toBe("WINNER");
    expect(grandFinal[0].sourceB?.take).toBe("WINNER");
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

    // Top-half qualifiers seed the upper bracket, bottom-half seed the lower
    // bracket as a fixed tree built up front.
    const seededUpper = upper.find((m) => !m.sourceA && !m.sourceB)!;
    const seededLower = lower.find((m) => !m.sourceA && !m.sourceB)!;
    expect([seededUpper.playerA, seededUpper.playerB].sort()).toEqual(["a", "c"]);
    expect([seededLower.playerA, seededLower.playerB].sort()).toEqual(["b", "d"]);
    // A grand final exists in the bracket from the start.
    expect(
      next.matches.filter((m) => m.knockoutBracket === "GRAND_FINAL"),
    ).toHaveLength(1);
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
