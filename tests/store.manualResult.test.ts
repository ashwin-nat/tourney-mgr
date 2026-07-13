import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSingleEliminationTree } from "../src/formats/knockout";
import { TBD_ID, type Match, type Tournament } from "../src/types";

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

function singleElimTournament(): { tournament: Tournament; matches: Match[] } {
  const matches = buildSingleEliminationTree(["a", "b", "c", "d"], 1, 42).matches;
  const tournament: Tournament = {
    id: "t1",
    name: "single elimination",
    format: "KNOCKOUT",
    participants: [
      { id: "a", name: "A", rating: 50 },
      { id: "b", name: "B", rating: 50 },
      { id: "c", name: "C", rating: 50 },
      { id: "d", name: "D", rating: 50 },
    ],
    matches,
    settings: {},
    status: "IN_PROGRESS",
    schemaVersion: 2,
  };
  return { tournament, matches };
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

  it("propagates results through the fixed tree and re-rolls without re-pairing", () => {
    const { tournament, matches } = singleElimTournament();
    const [m1, m2] = matches.filter((m) => m.round === 1);
    const finalId = matches.find((m) => m.round === 2)!.id;

    useTournamentStore.setState({
      tournaments: [tournament],
      currentTournamentId: tournament.id,
      participantHistory: {},
    });

    const store = useTournamentStore.getState();
    const get = () =>
      useTournamentStore
        .getState()
        .tournaments.find((item) => item.id === tournament.id)!;

    // Play both round-1 matches: the final fills with the winners.
    store.setMatchResult(tournament.id, m1.id, m1.playerA);
    store.setMatchResult(tournament.id, m2.id, m2.playerA);

    const finalBefore = get().matches.find((m) => m.id === finalId)!;
    expect(finalBefore.playerA).toBe(m1.playerA);
    expect(finalBefore.playerB).toBe(m2.playerA);

    // Record the final, then re-roll the first round-1 match.
    store.setMatchResult(tournament.id, finalId, m1.playerA);
    store.setMatchResult(tournament.id, m1.id, m1.playerB);

    const finalAfter = get().matches.find((m) => m.id === finalId)!;
    // Structure stays fixed; only the occupant flowing in changes.
    expect(finalAfter.sourceA).toEqual(finalBefore.sourceA);
    expect(finalAfter.playerA).toBe(m1.playerB);
    expect(finalAfter.playerB).toBe(m2.playerA);
    // The now-impossible final result is invalidated.
    expect(finalAfter.played).toBe(false);
    expect(finalAfter.winner).toBeUndefined();
  });

  it("ignores results for matches whose slots are not yet resolved", () => {
    const { tournament, matches } = singleElimTournament();
    const finalId = matches.find((m) => m.round === 2)!.id;

    useTournamentStore.setState({
      tournaments: [tournament],
      currentTournamentId: tournament.id,
      participantHistory: {},
    });

    // The final still has TBD slots, so a manual result is rejected.
    useTournamentStore.getState().setMatchResult(tournament.id, finalId, TBD_ID);
    const final = useTournamentStore
      .getState()
      .tournaments.find((item) => item.id === tournament.id)!
      .matches.find((m) => m.id === finalId)!;
    expect(final.played).toBe(false);
  });
});
