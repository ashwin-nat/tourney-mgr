import { create } from "zustand";
import { buildStandings } from "../engine/standings";
import { simulateMatchResult } from "../engine/simulation";
import {
  createBalancedGroups,
  generateGroupStageMatches,
  maybeStartKnockoutAfterGroups,
} from "../formats/groups";
import {
  generateKnockoutRoundOne,
  maybeGenerateNextKnockoutRound,
} from "../formats/knockout";
import { maybeGenerateSwissRound } from "../formats/swiss";
import { StorageService } from "../storage";
import {
  SCHEMA_VERSION,
  type Match,
  type NewTournamentInput,
  type Participant,
  type Tournament,
} from "../types";
import { makeId } from "../utils/id";

type Store = {
  tournaments: Tournament[];
  currentTournamentId: string | null;
  selectTournament: (id: string) => void;
  createTournament: (input: NewTournamentInput) => void;
  deleteTournament: (id: string) => void;
  updateParticipantRating: (
    tournamentId: string,
    participantId: string,
    rating: number,
  ) => void;
  generateFixtures: (id: string) => void;
  simulateMatch: (id: string, matchId: string) => void;
  simulateRound: (id: string, round: number) => void;
  simulateAll: (id: string) => void;
  resetTournament: (id: string) => void;
};

function clampRating(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function validateParticipants(participants: Participant[]): Participant[] {
  const seen = new Set<string>();
  return participants.filter((p) => {
    const key = p.name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    p.rating = clampRating(p.rating || 50);
    return true;
  });
}

function persist(state: Pick<Store, "tournaments" | "currentTournamentId">): void {
  StorageService.saveTournaments(state.tournaments);
  StorageService.saveCurrentTournament(state.currentTournamentId);
}

function runFormatProgression(tournament: Tournament): Tournament {
  let next = tournament;
  if (next.format === "GROUP_KO") {
    next = maybeStartKnockoutAfterGroups(next);
    next = maybeGenerateNextKnockoutRound(next);
  } else if (next.format === "KNOCKOUT") {
    next = maybeGenerateNextKnockoutRound(next);
  } else if (next.format === "SWISS") {
    next = maybeGenerateSwissRound(next);
  }

  const stageMatches = next.matches.filter((m) => m.stage !== "KNOCKOUT" || m.played);
  next.standings = buildStandings(next.participants, stageMatches);
  const hasUnplayed = next.matches.some((m) => !m.played);
  if (!hasUnplayed && next.matches.length > 0) next.status = "COMPLETED";
  return next;
}

function applyMatchSimulation(tournament: Tournament, matchIds: string[]): Tournament {
  const set = new Set(matchIds);
  const matches = tournament.matches.map((match) => {
    if (!set.has(match.id) || match.played) return match;
    return { ...match, ...simulateMatchResult(tournament, match) };
  });
  return runFormatProgression({ ...tournament, matches, status: "IN_PROGRESS" });
}

function initializeTournaments(): Pick<Store, "tournaments" | "currentTournamentId"> {
  const tournaments = StorageService.loadTournaments().map((t) => ({
    ...t,
    schemaVersion: t.schemaVersion ?? SCHEMA_VERSION,
  }));
  const currentTournamentId = StorageService.loadCurrentTournament();
  return { tournaments, currentTournamentId };
}

export const useTournamentStore = create<Store>((set, get) => {
  const initial = initializeTournaments();
  return {
    ...initial,
    selectTournament(id) {
      const state = get();
      const next = { ...state, currentTournamentId: id };
      persist(next);
      set({ currentTournamentId: id });
    },
    createTournament(input) {
      const participants = validateParticipants(
        input.participants.map((p) => ({ ...p, id: p.id || makeId("p") })),
      );
      const tournament: Tournament = {
        id: makeId("t"),
        name: input.name.trim() || "Untitled Tournament",
        format: input.format,
        participants,
        matches: [],
        settings: input.settings,
        status: "NOT_STARTED",
        schemaVersion: SCHEMA_VERSION,
      };
      const tournaments = [tournament, ...get().tournaments];
      const next = { tournaments, currentTournamentId: tournament.id };
      persist(next);
      set(next);
    },
    deleteTournament(id) {
      const tournaments = get().tournaments.filter((t) => t.id !== id);
      const currentTournamentId =
        get().currentTournamentId === id ? tournaments[0]?.id ?? null : get().currentTournamentId;
      const next = { tournaments, currentTournamentId };
      persist(next);
      set(next);
    },
    updateParticipantRating(tournamentId, participantId, rating) {
      const tournaments = get().tournaments.map((t) => {
        if (t.id !== tournamentId) return t;
        return {
          ...t,
          participants: t.participants.map((p) =>
            p.id === participantId ? { ...p, rating: clampRating(rating) } : p,
          ),
        };
      });
      const next = { tournaments, currentTournamentId: get().currentTournamentId };
      persist(next);
      set({ tournaments });
    },
    generateFixtures(id) {
      const tournaments = get().tournaments.map((t) => {
        if (t.id !== id) return t;
        let matches: Match[] = [];
        let groups = t.groups;
        if (t.format === "KNOCKOUT") {
          matches = generateKnockoutRoundOne(t.participants, t.settings.randomSeed);
        } else if (t.format === "GROUP_KO") {
          const groupCount = Math.max(2, t.settings.groupCount ?? 2);
          groups = createBalancedGroups(
            t.participants,
            groupCount,
            t.settings.randomSeed,
          );
          matches = generateGroupStageMatches(groups);
        } else {
          const seeded = maybeGenerateSwissRound({ ...t, matches: [] });
          matches = seeded.matches;
        }
        const seeded = runFormatProgression({
          ...t,
          groups,
          matches,
          status: matches.length ? "IN_PROGRESS" : "NOT_STARTED",
        });
        return seeded;
      });
      const next = { tournaments, currentTournamentId: get().currentTournamentId };
      persist(next);
      set({ tournaments });
    },
    simulateMatch(id, matchId) {
      const tournaments = get().tournaments.map((t) =>
        t.id === id ? applyMatchSimulation(t, [matchId]) : t,
      );
      const next = { tournaments, currentTournamentId: get().currentTournamentId };
      persist(next);
      set({ tournaments });
    },
    simulateRound(id, round) {
      const tournaments = get().tournaments.map((t) => {
        if (t.id !== id) return t;
        const matchIds = t.matches
          .filter((m) => !m.played && m.round === round)
          .map((m) => m.id);
        return applyMatchSimulation(t, matchIds);
      });
      const next = { tournaments, currentTournamentId: get().currentTournamentId };
      persist(next);
      set({ tournaments });
    },
    simulateAll(id) {
      const tournaments = get().tournaments.map((t) => {
        if (t.id !== id) return t;
        let current = t;
        for (let guard = 0; guard < 1000; guard += 1) {
          const nextUnplayed = current.matches.find((m) => !m.played);
          if (!nextUnplayed) break;
          const currentRound = nextUnplayed.round;
          const roundIds = current.matches
            .filter((m) => !m.played && m.round === currentRound)
            .map((m) => m.id);
          current = applyMatchSimulation(current, roundIds);
          if (current.status === "COMPLETED") break;
        }
        return current;
      });
      const next = { tournaments, currentTournamentId: get().currentTournamentId };
      persist(next);
      set({ tournaments });
    },
    resetTournament(id) {
      const tournaments = get().tournaments.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          matches: [],
          standings: undefined,
          status: "NOT_STARTED" as const,
        };
      });
      const next = { tournaments, currentTournamentId: get().currentTournamentId };
      persist(next);
      set({ tournaments });
    },
  };
});
