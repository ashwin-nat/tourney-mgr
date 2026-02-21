import type { ParticipantHistory, Tournament } from "./types";

const TOURNAMENTS_KEY = "tm_tournaments";
const CURRENT_KEY = "tm_current_tournament";

type StoredPayload = {
  schemaVersion: number;
  tournaments: Tournament[];
  participantHistory?: Record<string, ParticipantHistory>;
};

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeHistory(
  history: Record<string, ParticipantHistory> | undefined,
): Record<string, ParticipantHistory> {
  if (!history) return {};
  const normalized: Record<string, ParticipantHistory> = {};
  for (const value of Object.values(history)) {
    const key = normalizeNameKey(value.name);
    if (!key) continue;
    const existing = normalized[key];
    if (!existing) {
      normalized[key] = { ...value, name: value.name.trim() };
      continue;
    }
    normalized[key] = {
      name: value.name.trim(),
      wins: existing.wins + value.wins,
      losses: existing.losses + value.losses,
      draws: existing.draws + value.draws,
      played: existing.played + value.played,
    };
  }
  return normalized;
}

export const StorageService = {
  saveTournaments(
    tournaments: Tournament[],
    participantHistory?: Record<string, ParticipantHistory>,
  ): void {
    const payload: StoredPayload = {
      schemaVersion: 1,
      tournaments,
      participantHistory: normalizeHistory(participantHistory),
    };
    localStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(payload));
  },
  loadTournaments(): Tournament[] {
    try {
      const raw = localStorage.getItem(TOURNAMENTS_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as Partial<StoredPayload>;
      if (!parsed || !Array.isArray(parsed.tournaments)) {
        return [];
      }
      return parsed.tournaments;
    } catch {
      return [];
    }
  },
  loadParticipantHistory(): Record<string, ParticipantHistory> {
    try {
      const raw = localStorage.getItem(TOURNAMENTS_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as Partial<StoredPayload>;
      if (!parsed || !parsed.participantHistory) {
        return {};
      }
      return normalizeHistory(parsed.participantHistory);
    } catch {
      return {};
    }
  },
  saveCurrentTournament(id: string | null): void {
    if (id === null) {
      localStorage.removeItem(CURRENT_KEY);
      return;
    }
    localStorage.setItem(CURRENT_KEY, id);
  },
  loadCurrentTournament(): string | null {
    return localStorage.getItem(CURRENT_KEY);
  },
};
