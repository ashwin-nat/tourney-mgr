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
import { generateLeagueMatches } from "../formats/league";
import { maybeGenerateSwissRound } from "../formats/swiss";
import { StorageService } from "../storage";
import {
  SCHEMA_VERSION,
  type Match,
  type NewTournamentInput,
  type Participant,
  type ParticipantHistory,
  type Tournament,
} from "../types";
import { makeId } from "../utils/id";

type Store = {
  tournaments: Tournament[];
  participantHistory: Record<string, ParticipantHistory>;
  currentTournamentId: string | null;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
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

type PersistedSlice = Pick<
  Store,
  "tournaments" | "participantHistory" | "currentTournamentId"
>;

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

function ensureHistoryEntry(
  history: Record<string, ParticipantHistory>,
  participantName: string,
): ParticipantHistory {
  const name = participantName.trim();
  const key = historyKey(name);
  const existing = history[key];
  if (existing) {
    if (existing.name !== name) existing.name = name;
    if (!existing.opponents) existing.opponents = {};
    if (typeof existing.tournaments !== "number") existing.tournaments = 0;
    return existing;
  }
  const created: ParticipantHistory = {
    name,
    wins: 0,
    losses: 0,
    draws: 0,
    played: 0,
    tournaments: 0,
    opponents: {},
  };
  history[key] = created;
  return created;
}

function deriveHistoryFromTournaments(
  tournaments: Tournament[],
): Record<string, ParticipantHistory> {
  const history: Record<string, ParticipantHistory> = {};

  for (const tournament of tournaments) {
    const idToName = new Map(
      tournament.participants.map((participant) => [participant.id, participant.name.trim()]),
    );
    const seenThisTournament = new Set<string>();
    for (const participant of tournament.participants) {
      const name = participant.name.trim();
      if (!name) continue;
      const key = historyKey(name);
      if (seenThisTournament.has(key)) continue;
      seenThisTournament.add(key);
      const entry = ensureHistoryEntry(history, name);
      entry.tournaments += 1;
    }

    for (const match of tournament.matches) {
      if (!match.played) continue;
      const playerAName = idToName.get(match.playerA);
      const playerBName = idToName.get(match.playerB);
      if (!playerAName || !playerBName) continue;

      const a = ensureHistoryEntry(history, playerAName);
      const b = ensureHistoryEntry(history, playerBName);
      const aVsKey = historyKey(playerBName);
      const bVsKey = historyKey(playerAName);

      a.played += 1;
      b.played += 1;

      const aVs = a.opponents[aVsKey] ?? {
        opponentName: playerBName,
        wins: 0,
        losses: 0,
        draws: 0,
        played: 0,
      };
      const bVs = b.opponents[bVsKey] ?? {
        opponentName: playerAName,
        wins: 0,
        losses: 0,
        draws: 0,
        played: 0,
      };

      aVs.played += 1;
      bVs.played += 1;

      if (match.winner === undefined) {
        a.draws += 1;
        b.draws += 1;
        aVs.draws += 1;
        bVs.draws += 1;
      } else if (match.winner === match.playerA) {
        a.wins += 1;
        b.losses += 1;
        aVs.wins += 1;
        bVs.losses += 1;
      } else if (match.winner === match.playerB) {
        b.wins += 1;
        a.losses += 1;
        bVs.wins += 1;
        aVs.losses += 1;
      }

      a.opponents[aVsKey] = aVs;
      b.opponents[bVsKey] = bVs;
    }
  }

  return history;
}

function runFormatProgression(tournament: Tournament): Tournament {
  const next = { ...tournament };
  if (next.format === "GROUP_KO") {
    const afterGroups = maybeStartKnockoutAfterGroups(next);
    const afterKnockout = maybeGenerateNextKnockoutRound(afterGroups);
    Object.assign(next, afterKnockout);
  } else if (next.format === "KNOCKOUT") {
    Object.assign(next, maybeGenerateNextKnockoutRound(next));
  } else if (next.format === "SWISS") {
    Object.assign(next, maybeGenerateSwissRound(next));
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
  const targetMatch = tournament.matches.find((match) => match.id === matchId);
  if (!targetMatch) return tournament;
  const latestRound = Math.max(...tournament.matches.map((match) => match.round), 0);
  if (targetMatch.round !== latestRound) return tournament;

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

async function persist(state: PersistedSlice): Promise<void> {
  await StorageService.saveState(
    state.tournaments,
    state.participantHistory,
    state.currentTournamentId,
  );
}

function applyAndPersist(
  get: () => Store,
  set: (partial: Partial<Store>) => void,
  update: (state: Store) => PersistedSlice,
): void {
  const state = get();
  const next = update(state);
  set(next);
  void persist(next);
}

export const useTournamentStore = create<Store>((set, get) => ({
  tournaments: [],
  participantHistory: {},
  currentTournamentId: null,
  isHydrated: false,

  async hydrate() {
    if (get().isHydrated) return;
    try {
      const loaded = await StorageService.loadState();
      const tournaments = loaded.tournaments.map((tournament) => ({
        ...tournament,
        schemaVersion: tournament.schemaVersion ?? SCHEMA_VERSION,
      }));
      const derivedHistory = deriveHistoryFromTournaments(tournaments);
      const participantHistory =
        Object.keys(derivedHistory).length > 0 ? derivedHistory : loaded.participantHistory;
      const currentTournamentId = tournaments.some((t) => t.id === loaded.currentTournamentId)
        ? loaded.currentTournamentId
        : tournaments[0]?.id ?? null;
      const next = {
        tournaments,
        participantHistory,
        currentTournamentId,
      };
      set({ ...next, isHydrated: true });
      void persist(next);
    } catch {
      set({ isHydrated: true });
    }
  },

  selectTournament(id) {
    applyAndPersist(get, set, (state) => ({
      tournaments: state.tournaments,
      participantHistory: state.participantHistory,
      currentTournamentId: id,
    }));
  },

  createTournament(input) {
    applyAndPersist(get, set, (state) => {
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
      const tournaments = [tournament, ...state.tournaments];
      return {
        tournaments,
        currentTournamentId: tournament.id,
        participantHistory: deriveHistoryFromTournaments(tournaments),
      };
    });
  },

  deleteTournament(id) {
    applyAndPersist(get, set, (state) => {
      const tournaments = state.tournaments.filter((t) => t.id !== id);
      const currentTournamentId =
        state.currentTournamentId === id
          ? tournaments[0]?.id ?? null
          : state.currentTournamentId;
      return {
        tournaments,
        currentTournamentId,
        participantHistory: deriveHistoryFromTournaments(tournaments),
      };
    });
  },

  updateParticipantRating(tournamentId, participantId, rating) {
    applyAndPersist(get, set, (state) => {
      const tournaments = state.tournaments.map((t) => {
        if (t.id !== tournamentId) return t;
        return {
          ...t,
          participants: t.participants.map((p) =>
            p.id === participantId ? { ...p, rating: clampRating(rating) } : p,
          ),
        };
      });
      return {
        tournaments,
        currentTournamentId: state.currentTournamentId,
        participantHistory: deriveHistoryFromTournaments(tournaments),
      };
    });
  },

  generateFixtures(id) {
    applyAndPersist(get, set, (state) => {
      const tournaments = state.tournaments.map((t) => {
        if (t.id !== id) return t;
        let matches: Match[] = [];
        let groups = t.groups;
        if (t.format === "KNOCKOUT") {
          matches = generateKnockoutRoundOne(t.participants, t.settings.randomSeed);
        } else if (t.format === "GROUP_KO") {
          const groupCount = Math.max(2, t.settings.groupCount ?? 2);
          groups = createBalancedGroups(t.participants, groupCount, t.settings.randomSeed);
          matches = generateGroupStageMatches(
            groups,
            t.settings.faceOpponentsTwice ?? false,
          );
        } else if (t.format === "SWISS") {
          const seeded = maybeGenerateSwissRound({ ...t, matches: [] });
          matches = seeded.matches;
        } else {
          matches = generateLeagueMatches(
            t.participants,
            t.settings.faceOpponentsTwice ?? false,
          );
        }
        return runFormatProgression({
          ...t,
          groups,
          matches,
          status: matches.length ? "IN_PROGRESS" : "NOT_STARTED",
        });
      });
      return {
        tournaments,
        currentTournamentId: state.currentTournamentId,
        participantHistory: deriveHistoryFromTournaments(tournaments),
      };
    });
  },

  simulateMatch(id, matchId) {
    applyAndPersist(get, set, (state) => {
      const tournaments = state.tournaments.map((t) =>
        t.id === id ? applyMatchSimulation(t, [matchId]) : t,
      );
      return {
        tournaments,
        currentTournamentId: state.currentTournamentId,
        participantHistory: deriveHistoryFromTournaments(tournaments),
      };
    });
  },

  setMatchResult(id, matchId, winnerId) {
    applyAndPersist(get, set, (state) => {
      const tournaments = state.tournaments.map((t) =>
        t.id === id ? applyManualMatchResult(t, matchId, winnerId) : t,
      );
      return {
        tournaments,
        currentTournamentId: state.currentTournamentId,
        participantHistory: deriveHistoryFromTournaments(tournaments),
      };
    });
  },

  simulateRound(id, round) {
    applyAndPersist(get, set, (state) => {
      const tournaments = state.tournaments.map((t) => {
        if (t.id !== id) return t;
        const matchIds = t.matches
          .filter((m) => !m.played && m.round === round)
          .map((m) => m.id);
        return applyMatchSimulation(t, matchIds);
      });
      return {
        tournaments,
        currentTournamentId: state.currentTournamentId,
        participantHistory: deriveHistoryFromTournaments(tournaments),
      };
    });
  },

  simulateAll(id) {
    applyAndPersist(get, set, (state) => {
      const tournaments = state.tournaments.map((t) => {
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
      return {
        tournaments,
        currentTournamentId: state.currentTournamentId,
        participantHistory: deriveHistoryFromTournaments(tournaments),
      };
    });
  },

  resetTournament(id) {
    applyAndPersist(get, set, (state) => {
      const tournaments = state.tournaments.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          matches: [],
          standings: undefined,
          status: "NOT_STARTED" as const,
        };
      });
      return {
        tournaments,
        currentTournamentId: state.currentTournamentId,
        participantHistory: deriveHistoryFromTournaments(tournaments),
      };
    });
  },

  clearAll() {
    const next = {
      tournaments: [],
      currentTournamentId: null,
      participantHistory: {},
    };
    set(next);
    void persist(next);
  },
}));
