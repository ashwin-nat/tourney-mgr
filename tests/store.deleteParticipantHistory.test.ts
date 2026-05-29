import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tournament } from "../src/types";

vi.mock("../src/storage", () => ({
  StorageService: {
    loadState: vi.fn(async () => ({
      tournaments: [],
      participantHistory: {},
      deletedParticipantKeys: [],
      currentTournamentId: null,
    })),
    saveState: vi.fn(async () => {}),
  },
}));

import { useTournamentStore } from "../src/store/tournamentStore";

function baseLeagueTournament(): Tournament {
  return {
    id: "t-delete",
    name: "history-delete",
    format: "LEAGUE",
    participants: [
      { id: "a", name: "A", rating: 50 },
      { id: "b", name: "B", rating: 50 },
      { id: "c", name: "C", rating: 50 },
    ],
    matches: [
      {
        id: "m1",
        playerA: "a",
        playerB: "b",
        played: true,
        winner: "a",
        round: 1,
        stage: "LEAGUE",
      },
      {
        id: "m2",
        playerA: "b",
        playerB: "c",
        played: true,
        winner: "b",
        round: 2,
        stage: "LEAGUE",
      },
      {
        id: "m3",
        playerA: "a",
        playerB: "c",
        played: true,
        winner: "c",
        round: 3,
        stage: "LEAGUE",
      },
    ],
    settings: { faceOpponentsTwice: false },
    status: "COMPLETED",
    schemaVersion: 1,
  };
}

describe("deleteParticipantFromHistory", () => {
  beforeEach(() => {
    useTournamentStore.setState({
      tournaments: [],
      participantHistory: {},
      deletedParticipantKeys: [],
      currentTournamentId: null,
      isHydrated: true,
    });
  });

  it("removes the participant and purges their match influence from everyone else", () => {
    const tournament = baseLeagueTournament();
    useTournamentStore.setState({
      tournaments: [tournament],
      participantHistory: {},
      deletedParticipantKeys: [],
      currentTournamentId: tournament.id,
    });

    useTournamentStore.getState().deleteParticipantFromHistory("B");

    const { participantHistory, deletedParticipantKeys } = useTournamentStore.getState();
    expect(deletedParticipantKeys).toEqual(["b"]);
    expect(Object.keys(participantHistory).sort()).toEqual(["a", "c"]);

    expect(participantHistory.a.played).toBe(1);
    expect(participantHistory.a.wins).toBe(0);
    expect(participantHistory.a.losses).toBe(1);
    expect(Object.keys(participantHistory.a.opponents)).toEqual(["c"]);

    expect(participantHistory.c.played).toBe(1);
    expect(participantHistory.c.wins).toBe(1);
    expect(participantHistory.c.losses).toBe(0);
    expect(Object.keys(participantHistory.c.opponents)).toEqual(["a"]);
  });
});
