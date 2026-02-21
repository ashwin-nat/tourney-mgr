const TOURNAMENTS_KEY = "tm_tournaments";
const CURRENT_KEY = "tm_current_tournament";
export const StorageService = {
    saveTournaments(tournaments) {
        const payload = { schemaVersion: 1, tournaments };
        localStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(payload));
    },
    loadTournaments() {
        try {
            const raw = localStorage.getItem(TOURNAMENTS_KEY);
            if (!raw) {
                return [];
            }
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.tournaments)) {
                return [];
            }
            return parsed.tournaments;
        }
        catch {
            return [];
        }
    },
    saveCurrentTournament(id) {
        if (id === null) {
            localStorage.removeItem(CURRENT_KEY);
            return;
        }
        localStorage.setItem(CURRENT_KEY, id);
    },
    loadCurrentTournament() {
        return localStorage.getItem(CURRENT_KEY);
    },
};
