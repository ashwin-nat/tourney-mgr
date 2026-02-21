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
  type ParticipantHistory,
  type Participant,
  type Tournament,
} from "../types";
import { makeId } from "../utils/id";

type Store = {
  tournaments: Tournament[];
  participantHistory: Record<string, ParticipantHistory>;
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
  setMatchResult: (id: string, matchId: string, winnerId: string) => void;
  simulateRound: (id: string, round: number) => void;
  simulateAll: (id: string) => void;
  resetTournament: (id: string) => void;
  clearAll: () => void;
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

function historyKey(name: string): string {
  return name.trim().toLowerCase();
}

function mergeParticipantHistory(
  current: Record<string, ParticipantHistory>,
  tournament: Tournament,
  matches: Match[],
): Record<string, ParticipantHistory> {
  if (!matches.length) return current;

  const idToName = new Map(
    tournament.participants.map((participant) => [participant.id, participant.name]),
  );
  const next = { ...current };

  const ensure = (participantId: string): ParticipantHistory | null => {
    const name = idToName.get(participantId)?.trim();
    if (!name) return null;
    const key = historyKey(name);
    const existing = next[key];
    if (!existing) {
      next[key] = { name, wins: 0, losses: 0, draws: 0, played: 0 };
      return next[key];
    }
    if (existing.name !== name) {
      next[key] = { ...existing, name };
    }
    return next[key];
  };

  for (const match of matches) {
    if (!match.played) continue;
    const a = ensure(match.playerA);
    const b = ensure(match.playerB);
    if (!a || !b) continue;

    a.played += 1;
    b.played += 1;
    if (match.winner === undefined) {
      a.draws += 1;
      b.draws += 1;
      continue;
    }
    if (match.winner === match.playerA) {
      a.wins += 1;
      b.losses += 1;
    } else if (match.winner === match.playerB) {
      b.wins += 1;
      a.losses += 1;
    }
  }

  return next;
}

function persist(
  state: Pick<Store, "tournaments" | "currentTournamentId" | "participantHistory">,
): void {
  StorageService.saveTournaments(state.tournaments, state.participantHistory);
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

function applyManualMatchResult(
  tournament: Tournament,
  matchId: string,
  winnerId: string,
): Tournament {
  const matches = tournament.matches.map((match) => {
    if (match.id !== matchId) return match;
    const winner =
      winnerId === match.playerA || winnerId === match.playerB ? winnerId : undefined;
    return {
      ...match,
      winner,
      played: true,
    };
  });
  return runFormatProgression({ ...tournament, matches, status: "IN_PROGRESS" });
}

function deriveHistoryFromTournaments(
  tournaments: Tournament[],
): Record<string, ParticipantHistory> {
  let history: Record<string, ParticipantHistory> = {};
  for (const tournament of tournaments) {
    history = mergeParticipantHistory(
      history,
      tournament,
      tournament.matches.filter((match) => match.played),
    );
  }
  return history;
}

function initializeTournaments(): Pick<
  Store,
  "tournaments" | "currentTournamentId" | "participantHistory"
> {
  const tournaments = StorageService.loadTournaments().map((t) => ({
    ...t,
    schemaVersion: t.schemaVersion ?? SCHEMA_VERSION,
  }));
  const currentTournamentId = StorageService.loadCurrentTournament();
  const loadedHistory = StorageService.loadParticipantHistory();
  const participantHistory =
    Object.keys(loadedHistory).length > 0
      ? loadedHistory
      : deriveHistoryFromTournaments(tournaments);
  return { tournaments, currentTournamentId, participantHistory };
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
      const next = {
        tournaments,
        currentTournamentId: tournament.id,
        participantHistory: get().participantHistory,
      };
      persist(next);
      set(next);
    },
    deleteTournament(id) {
      const tournaments = get().tournaments.filter((t) => t.id !== id);
      const currentTournamentId =
        get().currentTournamentId === id ? tournaments[0]?.id ?? null : get().currentTournamentId;
      const next = {
        tournaments,
        currentTournamentId,
        participantHistory: get().participantHistory,
      };
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
      const next = {
        tournaments,
        currentTournamentId: get().currentTournamentId,
        participantHistory: get().participantHistory,
      };
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
      const next = {
        tournaments,
        currentTournamentId: get().currentTournamentId,
        participantHistory: get().participantHistory,
      };
      persist(next);
      set({ tournaments });
    },
    simulateMatch(id, matchId) {
      let participantHistory = get().participantHistory;
      const tournaments = get().tournaments.map((t) => {
        if (t.id !== id) return t;
        const nextTournament = applyMatchSimulation(t, [matchId]);
        const beforePlayed = new Set(
          t.matches.filter((match) => match.played).map((match) => match.id),
        );
        const newlyPlayed = nextTournament.matches.filter(
          (match) => match.id === matchId && match.played && !beforePlayed.has(match.id),
        );
        participantHistory = mergeParticipantHistory(
          participantHistory,
          nextTournament,
          newlyPlayed,
        );
        return nextTournament;
      });
      const next = {
        tournaments,
        currentTournamentId: get().currentTournamentId,
        participantHistory,
      };
      persist(next);
      set({ tournaments, participantHistory });
    },
    setMatchResult(id, matchId, winnerId) {
      const tournaments = get().tournaments.map((t) => {
        if (t.id !== id) return t;
        return applyManualMatchResult(t, matchId, winnerId);
      });
      const participantHistory = deriveHistoryFromTournaments(tournaments);
      const next = {
        tournaments,
        currentTournamentId: get().currentTournamentId,
        participantHistory,
      };
      persist(next);
      set({ tournaments, participantHistory });
    },
    simulateRound(id, round) {
      let participantHistory = get().participantHistory;
      const tournaments = get().tournaments.map((t) => {
        if (t.id !== id) return t;
        const matchIds = t.matches
          .filter((m) => !m.played && m.round === round)
          .map((m) => m.id);
        const nextTournament = applyMatchSimulation(t, matchIds);
        const beforePlayed = new Set(
          t.matches.filter((match) => match.played).map((match) => match.id),
        );
        const idSet = new Set(matchIds);
        const newlyPlayed = nextTournament.matches.filter(
          (match) => idSet.has(match.id) && match.played && !beforePlayed.has(match.id),
        );
        participantHistory = mergeParticipantHistory(
          participantHistory,
          nextTournament,
          newlyPlayed,
        );
        return nextTournament;
      });
      const next = {
        tournaments,
        currentTournamentId: get().currentTournamentId,
        participantHistory,
      };
      persist(next);
      set({ tournaments, participantHistory });
    },
    simulateAll(id) {
      let participantHistory = get().participantHistory;
      const tournaments = get().tournaments.map((t) => {
        if (t.id !== id) return t;
        let current = t;
        const beforePlayed = new Set(
          t.matches.filter((match) => match.played).map((match) => match.id),
        );
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
        const newlyPlayed = current.matches.filter(
          (match) => match.played && !beforePlayed.has(match.id),
        );
        participantHistory = mergeParticipantHistory(
          participantHistory,
          current,
          newlyPlayed,
        );
        return current;
      });
      const next = {
        tournaments,
        currentTournamentId: get().currentTournamentId,
        participantHistory,
      };
      persist(next);
      set({ tournaments, participantHistory });
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
      const next = {
        tournaments,
        currentTournamentId: get().currentTournamentId,
        participantHistory: get().participantHistory,
      };
      persist(next);
      set({ tournaments });
    },
    clearAll() {
      const next = {
        tournaments: [],
        currentTournamentId: null,
        participantHistory: {},
      };
      persist(next);
      set(next);
    },
  };
});
