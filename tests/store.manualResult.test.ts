import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tournament } from "../src/types";

vi.mock("../src/storage", () => ({
  StorageService: {
    loadState: vi.fn(async () => ({
      tournaments: [],
      participantHistory: {},
      currentTournamentId: null,
    })),
    saveState: vi.fn(async () => {}),
  },
}));

import { useTournamentStore } from "../src/store/tournamentStore";

function baseTournament(): Tournament {
  return {
    id: "t1",
    name: "double elimination",
    format: "KNOCKOUT",
    participants: [
      { id: "u", name: "Undefeated", rating: 50 },
      { id: "a", name: "A", rating: 50 },
      { id: "b", name: "B", rating: 50 },
      { id: "c", name: "C", rating: 50 },
    ],
    matches: [
      {
        id: "m1",
        playerA: "u",
        playerB: "a",
        played: true,
        winner: "u",
        round: 1,
        stage: "KNOCKOUT",
        knockoutBracket: "UPPER",
      },
      {
        id: "m2",
        playerA: "b",
        playerB: "c",
        played: true,
        winner: "b",
        round: 1,
        stage: "KNOCKOUT",
        knockoutBracket: "UPPER",
      },
      {
        id: "m3",
        playerA: "u",
        playerB: "b",
        played: true,
        winner: "u",
        round: 2,
        stage: "KNOCKOUT",
        knockoutBracket: "UPPER",
      },
      {
        id: "m4",
        playerA: "a",
        playerB: "c",
        played: true,
        winner: "a",
        round: 2,
        stage: "KNOCKOUT",
        knockoutBracket: "LOWER",
      },
      {
        id: "m5",
        playerA: "a",
        playerB: "b",
        played: true,
        winner: "a",
        round: 3,
        stage: "KNOCKOUT",
        knockoutBracket: "LOWER",
      },
      {
        id: "m6",
        playerA: "u",
        playerB: "a",
        played: false,
        round: 4,
        stage: "KNOCKOUT",
        knockoutBracket: "GRAND_FINAL",
      },
    ],
    settings: { doubleElimination: true },
    status: "IN_PROGRESS",
    schemaVersion: 1,
  };
}

describe("manual knockout corrections", () => {
  beforeEach(() => {
    useTournamentStore.setState({
      tournaments: [],
      participantHistory: {},
      currentTournamentId: null,
      isHydrated: true,
    });
  });

  it("rebuilds grand final participants when lower final winner is corrected", () => {
    const tournament = baseTournament();
    useTournamentStore.setState({
      tournaments: [tournament],
      currentTournamentId: tournament.id,
      participantHistory: {},
    });

    useTournamentStore.getState().setMatchResult(tournament.id, "m5", "b");

    const updated = useTournamentStore
      .getState()
      .tournaments.find((item) => item.id === tournament.id);
    expect(updated).toBeDefined();

    const correctedLowerFinal = updated!.matches.find((match) => match.id === "m5");
    expect(correctedLowerFinal?.winner).toBe("b");

    const grandFinals = updated!.matches.filter(
      (match) => match.knockoutBracket === "GRAND_FINAL",
    );
    expect(grandFinals).toHaveLength(1);
    expect(grandFinals[0].played).toBe(false);
    expect([grandFinals[0].playerA, grandFinals[0].playerB].sort()).toEqual(["b", "u"]);
  });
});
