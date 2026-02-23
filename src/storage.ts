import Dexie, { type EntityTable } from "dexie";
import { ELO_DEFAULT_RATING } from "./engine/elo";
import type { ParticipantHistory, Tournament } from "./types";

const TOURNAMENTS_KEY = "tm_tournaments";
const CURRENT_KEY = "tm_current_tournament";

const DB_NAME = "tourney_mgr_dexie";
const LEGACY_DB_NAME = "tourney_mgr";
const STATE_KEY = "state";

type StoredPayload = {
  schemaVersion: number;
  tournaments: Tournament[];
  participantHistory?: Record<string, ParticipantHistory>;
  currentTournamentId: string | null;
};

type StoredPayloadLegacy = {
  schemaVersion: number;
  tournaments: Tournament[];
  participantHistory?: Record<string, ParticipantHistory>;
};

type LoadedState = {
  tournaments: Tournament[];
  participantHistory: Record<string, ParticipantHistory>;
  currentTournamentId: string | null;
};

type AppStateRow = {
  key: string;
  payload: StoredPayload;
};

class TourneyDb extends Dexie {
  app_state!: EntityTable<AppStateRow, "key">;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      app_state: "key",
    });
  }
}

const db = new TourneyDb();

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function emptyHistory(name: string): ParticipantHistory {
  return {
    name,
    elo: ELO_DEFAULT_RATING,
    peakElo: ELO_DEFAULT_RATING,
    eloMatches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
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
}

function normalizeHistory(
  history: Record<string, ParticipantHistory> | undefined,
): Record<string, ParticipantHistory> {
  if (!history) return {};
  const normalized: Record<string, ParticipantHistory> = {};
  for (const value of Object.values(history)) {
    const key = normalizeNameKey(value.name);
    if (!key) continue;
    const existing = normalized[key] ?? emptyHistory(value.name.trim());
    const existingEloMatches = existing.eloMatches ?? 0;
    const nextEloMatches = value.eloMatches ?? 0;
    const mergedEloMatches = existingEloMatches + nextEloMatches;
    const existingElo =
      typeof existing.elo === "number" ? existing.elo : ELO_DEFAULT_RATING;
    const nextElo = typeof value.elo === "number" ? value.elo : ELO_DEFAULT_RATING;
    const mergedElo =
      mergedEloMatches > 0
        ? (existingElo * existingEloMatches + nextElo * nextEloMatches) / mergedEloMatches
        : nextElo;
    const mergedPeakElo = Math.max(
      typeof existing.peakElo === "number" ? existing.peakElo : existingElo,
      typeof value.peakElo === "number" ? value.peakElo : nextElo,
    );
    const opponents = { ...existing.opponents };
    for (const opponent of Object.values(value.opponents ?? {})) {
      const opponentKey = normalizeNameKey(opponent.opponentName);
      if (!opponentKey) continue;
      const current = opponents[opponentKey];
      if (!current) {
        opponents[opponentKey] = {
          opponentName: opponent.opponentName.trim(),
          wins: opponent.wins,
          losses: opponent.losses,
          draws: opponent.draws,
          played: opponent.played,
        };
        continue;
      }
      opponents[opponentKey] = {
        opponentName: opponent.opponentName.trim(),
        wins: current.wins + opponent.wins,
        losses: current.losses + opponent.losses,
        draws: current.draws + opponent.draws,
        played: current.played + opponent.played,
      };
    }
    normalized[key] = {
      name: value.name.trim(),
      elo: Math.round(mergedElo * 100) / 100,
      peakElo: Math.round(mergedPeakElo * 100) / 100,
      eloMatches: mergedEloMatches,
      wins: existing.wins + value.wins,
      losses: existing.losses + value.losses,
      draws: existing.draws + value.draws,
      played: existing.played + value.played,
      tournaments: existing.tournaments + (value.tournaments ?? 0),
      completedTournaments:
        existing.completedTournaments + (value.completedTournaments ?? 0),
      championships: existing.championships + (value.championships ?? 0),
      runnerUps: existing.runnerUps + (value.runnerUps ?? 0),
      finals: existing.finals + (value.finals ?? 0),
      stageStats: {
        group: {
          played:
            existing.stageStats.group.played + (value.stageStats?.group?.played ?? 0),
          wins: existing.stageStats.group.wins + (value.stageStats?.group?.wins ?? 0),
          losses:
            existing.stageStats.group.losses + (value.stageStats?.group?.losses ?? 0),
          draws: existing.stageStats.group.draws + (value.stageStats?.group?.draws ?? 0),
        },
        knockout: {
          played:
            existing.stageStats.knockout.played +
            (value.stageStats?.knockout?.played ?? 0),
          wins:
            existing.stageStats.knockout.wins + (value.stageStats?.knockout?.wins ?? 0),
          losses:
            existing.stageStats.knockout.losses +
            (value.stageStats?.knockout?.losses ?? 0),
          draws:
            existing.stageStats.knockout.draws + (value.stageStats?.knockout?.draws ?? 0),
        },
        swiss: {
          played:
            existing.stageStats.swiss.played + (value.stageStats?.swiss?.played ?? 0),
          wins: existing.stageStats.swiss.wins + (value.stageStats?.swiss?.wins ?? 0),
          losses:
            existing.stageStats.swiss.losses + (value.stageStats?.swiss?.losses ?? 0),
          draws: existing.stageStats.swiss.draws + (value.stageStats?.swiss?.draws ?? 0),
        },
        league: {
          played:
            existing.stageStats.league.played + (value.stageStats?.league?.played ?? 0),
          wins: existing.stageStats.league.wins + (value.stageStats?.league?.wins ?? 0),
          losses:
            existing.stageStats.league.losses + (value.stageStats?.league?.losses ?? 0),
          draws: existing.stageStats.league.draws + (value.stageStats?.league?.draws ?? 0),
        },
      },
      opponents,
    };
  }
  return normalized;
}

function parseLegacyPayload(): LoadedState | null {
  try {
    const raw = localStorage.getItem(TOURNAMENTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPayloadLegacy>;
    if (!parsed || !Array.isArray(parsed.tournaments)) return null;
    return {
      tournaments: parsed.tournaments,
      participantHistory: normalizeHistory(parsed.participantHistory),
      currentTournamentId: localStorage.getItem(CURRENT_KEY),
    };
  } catch {
    return null;
  }
}

function parseLoadedPayload(payload: StoredPayload): LoadedState {
  return {
    tournaments: payload.tournaments,
    participantHistory: normalizeHistory(payload.participantHistory),
    currentTournamentId: payload.currentTournamentId ?? null,
  };
}

async function loadFromLegacyIndexedDb(): Promise<LoadedState | null> {
  try {
    const legacy = await new Promise<StoredPayload | null>((resolve, reject) => {
      const request = indexedDB.open(LEGACY_DB_NAME);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const legacyDb = request.result;
        if (!legacyDb.objectStoreNames.contains("app_state")) {
          legacyDb.close();
          resolve(null);
          return;
        }
        const tx = legacyDb.transaction("app_state", "readonly");
        const store = tx.objectStore("app_state");
        const getReq = store.get(STATE_KEY);
        getReq.onerror = () => {
          legacyDb.close();
          reject(getReq.error);
        };
        getReq.onsuccess = () => {
          const value = getReq.result as StoredPayload | undefined;
          legacyDb.close();
          resolve(value ?? null);
        };
      };
    });
    if (!legacy) return null;
    return parseLoadedPayload(legacy);
  } catch {
    return null;
  }
}

export const StorageService = {
  async loadState(): Promise<LoadedState> {
    try {
      const fromDb = await db.app_state.get(STATE_KEY);
      if (fromDb?.payload) {
        return parseLoadedPayload(fromDb.payload);
      }
    } catch {
      // fall through to legacy migrations
    }

    const legacyIndexedDb = await loadFromLegacyIndexedDb();
    if (legacyIndexedDb) {
      await this.saveState(
        legacyIndexedDb.tournaments,
        legacyIndexedDb.participantHistory,
        legacyIndexedDb.currentTournamentId,
      );
      return legacyIndexedDb;
    }

    const legacyLocalStorage = parseLegacyPayload();
    if (legacyLocalStorage) {
      await this.saveState(
        legacyLocalStorage.tournaments,
        legacyLocalStorage.participantHistory,
        legacyLocalStorage.currentTournamentId,
      );
      localStorage.removeItem(TOURNAMENTS_KEY);
      localStorage.removeItem(CURRENT_KEY);
      return legacyLocalStorage;
    }

    return {
      tournaments: [],
      participantHistory: {},
      currentTournamentId: null,
    };
  },

  async saveState(
    tournaments: Tournament[],
    participantHistory: Record<string, ParticipantHistory>,
    currentTournamentId: string | null,
  ): Promise<void> {
    const payload: StoredPayload = {
      schemaVersion: 1,
      tournaments,
      participantHistory: normalizeHistory(participantHistory),
      currentTournamentId,
    };
    await db.app_state.put({ key: STATE_KEY, payload });
  },
};
