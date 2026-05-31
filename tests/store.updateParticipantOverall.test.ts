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

function tournament(id: string, name: string, alphaName = "Alpha"): Tournament {
  return {
    id,
    name,
    format: "LEAGUE",
    participants: [
      { id: `${id}-a`, name: alphaName, rating: 55 },
      { id: `${id}-b`, name: "Beta", rating: 40 },
    ],
    matches: [],
    settings: {},
    status: "NOT_STARTED",
    schemaVersion: 1,
  };
}

describe("updateParticipantOverall", () => {
  beforeEach(() => {
    useTournamentStore.setState({
      tournaments: [],
      participantHistory: {},
      deletedParticipantKeys: [],
      currentTournamentId: null,
      isHydrated: true,
    });
  });

  it("updates the participant rating across tournaments by name and clamps range", () => {
    useTournamentStore.setState({
      tournaments: [tournament("t1", "one", "Alpha"), tournament("t2", "two", "ALPHA")],
      participantHistory: {},
      deletedParticipantKeys: [],
      currentTournamentId: "t1",
    });

    useTournamentStore.getState().updateParticipantOverall(" alpha ", 120);

    const updated = useTournamentStore.getState().tournaments;
    expect(updated[0].participants.find((p) => p.name === "Alpha")?.rating).toBe(100);
    expect(updated[1].participants.find((p) => p.name === "ALPHA")?.rating).toBe(100);
    expect(updated[0].participants.find((p) => p.name === "Beta")?.rating).toBe(40);
    expect(updated[1].participants.find((p) => p.name === "Beta")?.rating).toBe(40);
  });
});

