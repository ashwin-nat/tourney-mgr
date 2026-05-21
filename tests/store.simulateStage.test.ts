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

function baseGroupKoTournament(): Tournament {
  return {
    id: "t-stage",
    name: "group stage sim",
    format: "GROUP_KO",
    participants: [
      { id: "a", name: "A", rating: 50 },
      { id: "b", name: "B", rating: 50 },
      { id: "c", name: "C", rating: 50 },
      { id: "d", name: "D", rating: 50 },
    ],
    groups: [
      { id: "A", participantIds: ["a", "b"] },
      { id: "B", participantIds: ["c", "d"] },
    ],
    matches: [
      {
        id: "g1",
        playerA: "a",
        playerB: "b",
        played: false,
        round: 1,
        stage: "GROUP",
        groupId: "A",
      },
      {
        id: "g2",
        playerA: "c",
        playerB: "d",
        played: false,
        round: 1,
        stage: "GROUP",
        groupId: "B",
      },
    ],
    settings: { advancePerGroup: 1, doubleElimination: false },
    status: "IN_PROGRESS",
    schemaVersion: 1,
  };
}

describe("simulateStage", () => {
  beforeEach(() => {
    useTournamentStore.setState({
      tournaments: [],
      participantHistory: {},
      currentTournamentId: null,
      isHydrated: true,
    });
  });

  it("simulates only the active stage and stops before the next stage", () => {
    const tournament = baseGroupKoTournament();
    useTournamentStore.setState({
      tournaments: [tournament],
      currentTournamentId: tournament.id,
      participantHistory: {},
    });

    useTournamentStore.getState().simulateStage(tournament.id);

    const updated = useTournamentStore
      .getState()
      .tournaments.find((item) => item.id === tournament.id);
    expect(updated).toBeDefined();

    const groupMatches = updated!.matches.filter((match) => match.stage === "GROUP");
    const knockoutMatches = updated!.matches.filter((match) => match.stage === "KNOCKOUT");

    expect(groupMatches).toHaveLength(2);
    expect(groupMatches.every((match) => match.played)).toBe(true);

    expect(knockoutMatches.length).toBeGreaterThan(0);
    expect(knockoutMatches.every((match) => !match.played)).toBe(true);
    expect(updated!.matches.find((match) => !match.played)?.stage).toBe("KNOCKOUT");
  });
});
