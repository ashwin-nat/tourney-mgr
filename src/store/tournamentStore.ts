import { create } from "zustand";
import { buildStandings } from "../engine/standings";
import { simulateMatchResult } from "../engine/simulation";
import { applyEloUpdate, ELO_DEFAULT_RATING } from "../engine/elo";
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
  TBD_ID,
  type MatchStage,
  type Match,
  type NewTournamentInput,
  type Participant,
  type ParticipantHistory,
  type StatsTransferFile,
  type Tournament,
} from "../types";
import { makeId } from "../utils/id";
import {
  getStageManualEditContext,
  isGroupRoundEditAllowed,
  isKnockoutMatchEditable,
  isManualRoundEditAllowed,
} from "../utils/manualResultRules";
import { getTournamentChampionId, getTournamentRunnerUpId } from "../utils/champion";

type Store = {
  tournaments: Tournament[];
  participantHistory: Record<string, ParticipantHistory>;
  deletedParticipantKeys: string[];
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
  updateParticipantOverall: (participantName: string, rating: number) => void;
  renameParticipant: (
    oldName: string,
    newName: string,
  ) => { ok: true } | { ok: false; error: string };
  exportStats: () => StatsTransferFile;
  importStats: (input: unknown) => { ok: true } | { ok: false; error: string };
  deleteParticipantFromHistory: (participantName: string) => void;
  generateFixtures: (id: string) => void;
  simulateMatch: (id: string, matchId: string) => void;
  setMatchResult: (id: string, matchId: string, winnerId: string) => void;
  simulateRound: (id: string, round: number) => void;
  simulateStage: (id: string, stage?: MatchStage) => void;
  simulateAll: (id: string) => void;
  resetTournament: (id: string) => void;
  clearAll: () => void;
};

type PersistedSlice = Pick<
  Store,
  "tournaments" | "participantHistory" | "deletedParticipantKeys" | "currentTournamentId"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStatsTransferFile(input: unknown): StatsTransferFile | null {
  if (!isRecord(input)) return null;
  const tournaments = input.tournaments;
  if (!Array.isArray(tournaments)) return null;
  const currentTournamentId = input.currentTournamentId;
  if (currentTournamentId !== null && typeof currentTournamentId !== "string") return null;
  const participantHistory = input.participantHistory;
  if (!isRecord(participantHistory)) return null;
  const deletedParticipantKeys = input.deletedParticipantKeys;
  if (
    deletedParticipantKeys !== undefined &&
    (!Array.isArray(deletedParticipantKeys) ||
      deletedParticipantKeys.some((key) => typeof key !== "string"))
  ) {
    return null;
  }
  return {
    schemaVersion:
      typeof input.schemaVersion === "number" ? input.schemaVersion : SCHEMA_VERSION,
    exportedAt: typeof input.exportedAt === "string" ? input.exportedAt : "",
    tournaments: tournaments as Tournament[],
    participantHistory: participantHistory as Record<string, ParticipantHistory>,
    deletedParticipantKeys:
      (deletedParticipantKeys as string[] | undefined) ?? [],
    currentTournamentId,
  };
}

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

function normalizeDeletedParticipantKeys(keys: string[] | undefined): string[] {
  if (!Array.isArray(keys)) return [];
  return [...new Set(keys.map((key) => historyKey(key)).filter(Boolean))];
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
    if (typeof existing.elo !== "number") existing.elo = ELO_DEFAULT_RATING;
    if (typeof existing.peakElo !== "number") existing.peakElo = existing.elo;
    if (typeof existing.eloMatches !== "number") existing.eloMatches = 0;
    if (typeof existing.currentStreak !== "number") existing.currentStreak = 0;
    if (typeof existing.bestStreak !== "number") existing.bestStreak = 0;
    if (typeof existing.worstStreak !== "number") existing.worstStreak = 0;
    if (!existing.opponents) existing.opponents = {};
    if (typeof existing.tournaments !== "number") existing.tournaments = 0;
    if (typeof existing.completedTournaments !== "number") existing.completedTournaments = 0;
    if (typeof existing.championships !== "number") existing.championships = 0;
    if (typeof existing.runnerUps !== "number") existing.runnerUps = 0;
    if (typeof existing.finals !== "number") existing.finals = 0;
    if (!existing.stageStats) {
      existing.stageStats = {
        group: { played: 0, wins: 0, losses: 0, draws: 0 },
        knockout: { played: 0, wins: 0, losses: 0, draws: 0 },
        swiss: { played: 0, wins: 0, losses: 0, draws: 0 },
        league: { played: 0, wins: 0, losses: 0, draws: 0 },
      };
    }
    return existing;
  }
  const created: ParticipantHistory = {
    name,
    elo: ELO_DEFAULT_RATING,
    peakElo: ELO_DEFAULT_RATING,
    eloMatches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    currentStreak: 0,
    bestStreak: 0,
    worstStreak: 0,
    played: 0,
    tournaments: 0,
    completedTournaments: 0,
    championships: 0,
    runnerUps: 0,
    finals: 0,
    stageStats: {
      group: { played: 0, wins: 0, losses: 0, draws: 0 },
      knockout: { played: 0, wins: 0, losses: 0, draws: 0 },
      swiss: { played: 0, wins: 0, losses: 0, draws: 0 },
      league: { played: 0, wins: 0, losses: 0, draws: 0 },
    },
    opponents: {},
  };
  history[key] = created;
  return created;
}

function updateStreaks(
  entry: ParticipantHistory,
  outcome: "W" | "L" | "D",
): void {
  if (outcome === "D") {
    entry.currentStreak = 0;
    return;
  }
  if (outcome === "W") {
    entry.currentStreak = entry.currentStreak > 0 ? entry.currentStreak + 1 : 1;
    entry.bestStreak = Math.max(entry.bestStreak, entry.currentStreak);
    return;
  }
  entry.currentStreak = entry.currentStreak < 0 ? entry.currentStreak - 1 : -1;
  entry.worstStreak = Math.min(entry.worstStreak, entry.currentStreak);
}

function stageKey(stage: MatchStage): keyof ParticipantHistory["stageStats"] {
  if (stage === "GROUP") return "group";
  if (stage === "KNOCKOUT") return "knockout";
  if (stage === "SWISS") return "swiss";
  return "league";
}

function deriveHistoryFromTournaments(
  tournaments: Tournament[],
  deletedParticipantKeys: string[] = [],
): Record<string, ParticipantHistory> {
  const history: Record<string, ParticipantHistory> = {};
  const deletedKeySet = new Set(normalizeDeletedParticipantKeys(deletedParticipantKeys));

  for (const tournament of [...tournaments].reverse()) {
    const idToName = new Map(
      tournament.participants.map((participant) => [participant.id, participant.name.trim()]),
    );
    const seenThisTournament = new Set<string>();
    for (const participant of tournament.participants) {
      const name = participant.name.trim();
      if (!name) continue;
      const key = historyKey(name);
      if (deletedKeySet.has(key)) continue;
      if (seenThisTournament.has(key)) continue;
      seenThisTournament.add(key);
      const entry = ensureHistoryEntry(history, name);
      entry.tournaments += 1;
      if (tournament.status === "COMPLETED") {
        entry.completedTournaments += 1;
      }
    }

    const playedMatches = tournament.matches
      .map((match, index) => ({ match, index }))
      .filter(({ match }) => match.played)
      .sort((a, b) => {
        if (a.match.round !== b.match.round) {
          return a.match.round - b.match.round;
        }
        return a.index - b.index;
      })
      .map(({ match }) => match);

    for (const match of playedMatches) {
      const playerAName = idToName.get(match.playerA);
      const playerBName = idToName.get(match.playerB);
      if (!playerAName || !playerBName) continue;
      const playerAKey = historyKey(playerAName);
      const playerBKey = historyKey(playerBName);
      if (deletedKeySet.has(playerAKey) || deletedKeySet.has(playerBKey)) continue;

      const a = ensureHistoryEntry(history, playerAName);
      const b = ensureHistoryEntry(history, playerBName);
      const aVsKey = historyKey(playerBName);
      const bVsKey = historyKey(playerAName);
      const stage = stageKey(match.stage);

      a.played += 1;
      b.played += 1;
      a.stageStats[stage].played += 1;
      b.stageStats[stage].played += 1;

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
        updateStreaks(a, "D");
        updateStreaks(b, "D");
        a.stageStats[stage].draws += 1;
        b.stageStats[stage].draws += 1;
        aVs.draws += 1;
        bVs.draws += 1;
      } else if (match.winner === match.playerA) {
        a.wins += 1;
        b.losses += 1;
        updateStreaks(a, "W");
        updateStreaks(b, "L");
        a.stageStats[stage].wins += 1;
        b.stageStats[stage].losses += 1;
        aVs.wins += 1;
        bVs.losses += 1;
      } else if (match.winner === match.playerB) {
        b.wins += 1;
        a.losses += 1;
        updateStreaks(b, "W");
        updateStreaks(a, "L");
        b.stageStats[stage].wins += 1;
        a.stageStats[stage].losses += 1;
        bVs.wins += 1;
        aVs.losses += 1;
      }

      const scoreA: 0 | 0.5 | 1 =
        match.winner === undefined ? 0.5 : match.winner === match.playerA ? 1 : 0;
      const next = applyEloUpdate(a.elo, b.elo, scoreA, a.eloMatches, b.eloMatches);
      a.elo = next.ratingA;
      b.elo = next.ratingB;
      a.eloMatches += 1;
      b.eloMatches += 1;
      a.peakElo = Math.max(a.peakElo, a.elo);
      b.peakElo = Math.max(b.peakElo, b.elo);

      a.opponents[aVsKey] = aVs;
      b.opponents[bVsKey] = bVs;
    }

    if (tournament.status === "COMPLETED") {
      const championId = getTournamentChampionId(tournament);
      if (championId) {
        const championName = idToName.get(championId);
        if (championName && !deletedKeySet.has(historyKey(championName))) {
          const championEntry = ensureHistoryEntry(history, championName);
          championEntry.championships += 1;
          championEntry.finals += 1;
        }
      }

      const runnerUpId = getTournamentRunnerUpId(tournament);
      if (runnerUpId) {
        const runnerUpName = idToName.get(runnerUpId);
        if (runnerUpName && !deletedKeySet.has(historyKey(runnerUpName))) {
          const runnerUpEntry = ensureHistoryEntry(history, runnerUpName);
          runnerUpEntry.runnerUps += 1;
          runnerUpEntry.finals += 1;
        }
      }
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

/** A match can be simulated only once both of its slots hold real participants. */
function isPlayable(match: Match): boolean {
  return !match.played && match.playerA !== TBD_ID && match.playerB !== TBD_ID;
}

function applyMatchSimulation(
  tournament: Tournament,
  matchIds: string[],
  participantHistory: Record<string, ParticipantHistory>,
): Tournament {
  const set = new Set(matchIds);
  const matches = tournament.matches.map((match) => {
    if (!set.has(match.id) || match.played) return match;
    return { ...match, ...simulateMatchResult(tournament, match, participantHistory) };
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

  // Knockout results flow through the fixed bracket tree: record (or re-roll)
  // the result in place and let resolveKnockoutBracket propagate it. Future
  // rounds are never deleted or re-paired.
  if (targetMatch.stage === "KNOCKOUT") {
    if (!isKnockoutMatchEditable(targetMatch)) return tournament;
    const matches = tournament.matches.map((match) => {
      if (match.id !== matchId) return match;
      const winner =
        winnerId === match.playerA || winnerId === match.playerB ? winnerId : undefined;
      return { ...match, winner, played: true };
    });
    return runFormatProgression({ ...tournament, matches, status: "IN_PROGRESS" });
  }

  let shouldRebuildFutureRounds = false;
  if (targetMatch.stage === "SWISS") {
    const stageMatches = tournament.matches.filter(
      (match) => match.stage === targetMatch.stage,
    );
    if (!isManualRoundEditAllowed(stageMatches, targetMatch.round)) return tournament;
    const { allowedRound } = getStageManualEditContext(stageMatches);
    shouldRebuildFutureRounds = targetMatch.round < allowedRound;
  }

  if (targetMatch.stage === "GROUP") {
    const groupMatches = tournament.matches.filter((match) => match.stage === "GROUP");
    const knockoutMatches = tournament.matches.filter((match) => match.stage === "KNOCKOUT");
    if (!isGroupRoundEditAllowed(groupMatches, knockoutMatches, targetMatch.round)) {
      return tournament;
    }
    shouldRebuildFutureRounds = knockoutMatches.length > 0;
  }

  const sourceMatches = shouldRebuildFutureRounds
    ? tournament.matches.filter(
        (match) =>
          targetMatch.stage === "GROUP"
            ? match.stage !== "KNOCKOUT"
            : !(match.stage === targetMatch.stage && match.round > targetMatch.round),
      )
    : tournament.matches;

  const matches = sourceMatches.map((match) => {
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
    state.deletedParticipantKeys,
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
  deletedParticipantKeys: [],
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
      const deletedParticipantKeys = normalizeDeletedParticipantKeys(
        loaded.deletedParticipantKeys,
      );
      const derivedHistory = deriveHistoryFromTournaments(
        tournaments,
        deletedParticipantKeys,
      );
      const participantHistory =
        Object.keys(derivedHistory).length > 0 ? derivedHistory : loaded.participantHistory;
      const currentTournamentId = tournaments.some((t) => t.id === loaded.currentTournamentId)
        ? loaded.currentTournamentId
        : tournaments[0]?.id ?? null;
      const next = {
        tournaments,
        participantHistory,
        deletedParticipantKeys,
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
      deletedParticipantKeys: state.deletedParticipantKeys,
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
        createdAt: new Date().toISOString(),
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
        deletedParticipantKeys: state.deletedParticipantKeys,
        participantHistory: deriveHistoryFromTournaments(
          tournaments,
          state.deletedParticipantKeys,
        ),
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
        deletedParticipantKeys: state.deletedParticipantKeys,
        participantHistory: deriveHistoryFromTournaments(
          tournaments,
          state.deletedParticipantKeys,
        ),
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
        deletedParticipantKeys: state.deletedParticipantKeys,
        participantHistory: deriveHistoryFromTournaments(
          tournaments,
          state.deletedParticipantKeys,
        ),
      };
    });
  },

  updateParticipantOverall(participantName, rating) {
    applyAndPersist(get, set, (state) => {
      const key = historyKey(participantName);
      if (!key) {
        return {
          tournaments: state.tournaments,
          participantHistory: state.participantHistory,
          deletedParticipantKeys: state.deletedParticipantKeys,
          currentTournamentId: state.currentTournamentId,
        };
      }
      const nextRating = clampRating(rating);
      const tournaments = state.tournaments.map((tournament) => ({
        ...tournament,
        participants: tournament.participants.map((participant) =>
          historyKey(participant.name) === key
            ? { ...participant, rating: nextRating }
            : participant,
        ),
      }));
      return {
        tournaments,
        currentTournamentId: state.currentTournamentId,
        deletedParticipantKeys: state.deletedParticipantKeys,
        participantHistory: deriveHistoryFromTournaments(
          tournaments,
          state.deletedParticipantKeys,
        ),
      };
    });
  },

  renameParticipant(oldName, rawNewName) {
    const state = get();
    const oldKey = historyKey(oldName);
    if (!oldKey) {
      return { ok: false, error: "Participant not found." };
    }
    const hasParticipant = state.tournaments.some((t) =>
      t.participants.some((p) => historyKey(p.name) === oldKey),
    );
    if (!hasParticipant) {
      return { ok: false, error: "Participant not found." };
    }
    const newName = rawNewName.trim();
    if (!newName) {
      return { ok: false, error: "Name cannot be empty." };
    }
    const newKey = historyKey(newName);
    if (oldKey === newKey) {
      return { ok: true };
    }

    for (const t of state.tournaments) {
      const seenKeys = new Set<string>();
      for (const p of t.participants) {
        const key = historyKey(p.name) === oldKey ? newKey : historyKey(p.name);
        if (seenKeys.has(key)) {
          return {
            ok: false,
            error: `"${newName}" already exists in tournament "${t.name}".`,
          };
        }
        seenKeys.add(key);
      }
    }

    const tournaments = state.tournaments.map((t) => ({
      ...t,
      participants: t.participants.map((p) =>
        historyKey(p.name) === oldKey ? { ...p, name: newName } : p,
      ),
    }));

    applyAndPersist(get, set, (s) => ({
      tournaments,
      currentTournamentId: s.currentTournamentId,
      deletedParticipantKeys: s.deletedParticipantKeys,
      participantHistory: deriveHistoryFromTournaments(tournaments, s.deletedParticipantKeys),
    }));
    return { ok: true };
  },

  exportStats() {
    const state = get();
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      tournaments: state.tournaments,
      participantHistory: state.participantHistory,
      deletedParticipantKeys: state.deletedParticipantKeys,
      currentTournamentId: state.currentTournamentId,
    };
  },

  importStats(input) {
    const parsed = parseStatsTransferFile(input);
    if (!parsed) return { ok: false, error: "Invalid stats file format." };
    const tournaments = parsed.tournaments.map((tournament) => ({
      ...tournament,
      schemaVersion: tournament.schemaVersion ?? SCHEMA_VERSION,
    }));
    const deletedParticipantKeys = normalizeDeletedParticipantKeys(
      parsed.deletedParticipantKeys,
    );
    const participantHistoryFromTournaments = deriveHistoryFromTournaments(
      tournaments,
      deletedParticipantKeys,
    );
    const participantHistory =
      Object.keys(participantHistoryFromTournaments).length > 0
        ? participantHistoryFromTournaments
        : parsed.participantHistory;
    const currentTournamentId = tournaments.some(
      (tournament) => tournament.id === parsed.currentTournamentId,
    )
      ? parsed.currentTournamentId
      : tournaments[0]?.id ?? null;
    const next = {
      tournaments,
      participantHistory,
      deletedParticipantKeys,
      currentTournamentId,
    };
    set(next);
    void persist(next);
    return { ok: true };
  },

  deleteParticipantFromHistory(participantName) {
    applyAndPersist(get, set, (state) => {
      const deletedParticipantKey = historyKey(participantName);
      if (!deletedParticipantKey) {
        return {
          tournaments: state.tournaments,
          participantHistory: state.participantHistory,
          deletedParticipantKeys: state.deletedParticipantKeys,
          currentTournamentId: state.currentTournamentId,
        };
      }
      const deletedParticipantKeys = normalizeDeletedParticipantKeys([
        ...state.deletedParticipantKeys,
        deletedParticipantKey,
      ]);
      return {
        tournaments: state.tournaments,
        currentTournamentId: state.currentTournamentId,
        deletedParticipantKeys,
        participantHistory: deriveHistoryFromTournaments(
          state.tournaments,
          deletedParticipantKeys,
        ),
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
          matches = generateKnockoutRoundOne(t.participants, t.settings.randomSeed, {
            doubleElimination: t.settings.doubleElimination ?? false,
          });
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
        deletedParticipantKeys: state.deletedParticipantKeys,
        participantHistory: deriveHistoryFromTournaments(
          tournaments,
          state.deletedParticipantKeys,
        ),
      };
    });
  },

  simulateMatch(id, matchId) {
    applyAndPersist(get, set, (state) => {
      const tournaments = state.tournaments.map((t) =>
        t.id === id ? applyMatchSimulation(t, [matchId], state.participantHistory) : t,
      );
      return {
        tournaments,
        currentTournamentId: state.currentTournamentId,
        deletedParticipantKeys: state.deletedParticipantKeys,
        participantHistory: deriveHistoryFromTournaments(
          tournaments,
          state.deletedParticipantKeys,
        ),
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
        deletedParticipantKeys: state.deletedParticipantKeys,
        participantHistory: deriveHistoryFromTournaments(
          tournaments,
          state.deletedParticipantKeys,
        ),
      };
    });
  },

  simulateRound(id, round) {
    applyAndPersist(get, set, (state) => {
      const tournaments = state.tournaments.map((t) => {
        if (t.id !== id) return t;
        const matchIds = t.matches
          .filter((m) => isPlayable(m) && m.round === round)
          .map((m) => m.id);
        return applyMatchSimulation(t, matchIds, state.participantHistory);
      });
      return {
        tournaments,
        currentTournamentId: state.currentTournamentId,
        deletedParticipantKeys: state.deletedParticipantKeys,
        participantHistory: deriveHistoryFromTournaments(
          tournaments,
          state.deletedParticipantKeys,
        ),
      };
    });
  },

  simulateStage(id, stage) {
    applyAndPersist(get, set, (state) => {
      const indexById = new Map(state.tournaments.map((tournament, index) => [tournament.id, index]));
      const tournaments = state.tournaments.map((t) => {
        if (t.id !== id) return t;
        let current = t;
        let history = state.participantHistory;
        const targetStage = stage ?? current.matches.find((match) => !match.played)?.stage;
        if (!targetStage) return current;

        for (let guard = 0; guard < 1000; guard += 1) {
          const nextUnplayedInTargetStage = current.matches.find(
            (match) => isPlayable(match) && match.stage === targetStage,
          );
          if (!nextUnplayedInTargetStage) break;
          const currentRound = nextUnplayedInTargetStage.round;
          const roundIds = current.matches
            .filter(
              (match) =>
                isPlayable(match) &&
                match.stage === targetStage &&
                match.round === currentRound,
            )
            .map((match) => match.id);
          current = applyMatchSimulation(current, roundIds, history);
          const tournamentsWithCurrent = [...state.tournaments];
          const currentIndex = indexById.get(current.id);
          if (currentIndex !== undefined) {
            tournamentsWithCurrent[currentIndex] = current;
            history = deriveHistoryFromTournaments(
              tournamentsWithCurrent,
              state.deletedParticipantKeys,
            );
          }
          if (current.status === "COMPLETED") break;
        }

        return current;
      });
      return {
        tournaments,
        currentTournamentId: state.currentTournamentId,
        deletedParticipantKeys: state.deletedParticipantKeys,
        participantHistory: deriveHistoryFromTournaments(
          tournaments,
          state.deletedParticipantKeys,
        ),
      };
    });
  },

  simulateAll(id) {
    applyAndPersist(get, set, (state) => {
      const indexById = new Map(state.tournaments.map((tournament, index) => [tournament.id, index]));
      const tournaments = state.tournaments.map((t) => {
        if (t.id !== id) return t;
        let current = t;
        let history = state.participantHistory;
        for (let guard = 0; guard < 1000; guard += 1) {
          const nextUnplayed = current.matches.find((m) => isPlayable(m));
          if (!nextUnplayed) break;
          const currentRound = nextUnplayed.round;
          const roundIds = current.matches
            .filter((m) => isPlayable(m) && m.round === currentRound)
            .map((m) => m.id);
          current = applyMatchSimulation(current, roundIds, history);
          const tournamentsWithCurrent = [...state.tournaments];
          const currentIndex = indexById.get(current.id);
          if (currentIndex !== undefined) {
            tournamentsWithCurrent[currentIndex] = current;
            history = deriveHistoryFromTournaments(
              tournamentsWithCurrent,
              state.deletedParticipantKeys,
            );
          }
          if (current.status === "COMPLETED") break;
        }
        return current;
      });
      return {
        tournaments,
        currentTournamentId: state.currentTournamentId,
        deletedParticipantKeys: state.deletedParticipantKeys,
        participantHistory: deriveHistoryFromTournaments(
          tournaments,
          state.deletedParticipantKeys,
        ),
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
        deletedParticipantKeys: state.deletedParticipantKeys,
        participantHistory: deriveHistoryFromTournaments(
          tournaments,
          state.deletedParticipantKeys,
        ),
      };
    });
  },

  clearAll() {
    const next = {
      tournaments: [],
      currentTournamentId: null,
      participantHistory: {},
      deletedParticipantKeys: [],
    };
    set(next);
    void persist(next);
  },
}));
