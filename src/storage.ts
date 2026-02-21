import type { Tournament } from "./types";

const TOURNAMENTS_KEY = "tm_tournaments";
const CURRENT_KEY = "tm_current_tournament";

type StoredPayload = {
  schemaVersion: number;
  tournaments: Tournament[];
};

export const StorageService = {
  saveTournaments(tournaments: Tournament[]): void {
    const payload: StoredPayload = { schemaVersion: 1, tournaments };
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
