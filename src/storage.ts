import Dexie, { type EntityTable } from "dexie";
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
    wins: 0,
    losses: 0,
    draws: 0,
    played: 0,
    tournaments: 0,
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
      wins: existing.wins + value.wins,
      losses: existing.losses + value.losses,
      draws: existing.draws + value.draws,
      played: existing.played + value.played,
      tournaments: existing.tournaments + (value.tournaments ?? 0),
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
