import { useEffect, useMemo, useState } from "react";
import { CreateTournamentForm } from "./components/CreateTournamentForm";
import { HistoryPage } from "./components/HistoryPage";
import { TournamentDetail } from "./components/TournamentDetail";
import { TournamentList } from "./components/TournamentList";
import { useTournamentStore } from "./store/tournamentStore";

export default function App() {
  const [page, setPage] = useState<"TOURNAMENTS" | "HISTORY">("TOURNAMENTS");
  const {
    tournaments,
    participantHistory,
    currentTournamentId,
    createTournament,
    selectTournament,
    deleteTournament,
    exportStats,
    generateFixtures,
    importStats,
    simulateMatch,
    setMatchResult,
    simulateRound,
    simulateAll,
    resetTournament,
    clearAll,
    updateParticipantRating,
    hydrate,
    isHydrated,
  } = useTournamentStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const current = tournaments.find((t) => t.id === currentTournamentId) ?? null;
  const historyNames = useMemo(
    () =>
      Object.values(participantHistory)
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b)),
    [participantHistory],
  );

  if (!isHydrated) {
    return (
      <main className="pageRoot">
        <section className="panel">
          <h2>Loading</h2>
          <p>Reading tournament history...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="pageRoot">
      <section className="panel pageNav">
        <button
          className={page === "TOURNAMENTS" ? "tabButton active" : "tabButton"}
          onClick={() => setPage("TOURNAMENTS")}
        >
          Tournaments
        </button>
        <button
          className={page === "HISTORY" ? "tabButton active" : "tabButton"}
          onClick={() => setPage("HISTORY")}
        >
          History
        </button>
      </section>
      {page === "TOURNAMENTS" ? (
        <section className="layout">
          <aside>
            <CreateTournamentForm
              onCreate={createTournament}
              historyNames={historyNames}
              previousParticipants={tournaments[0]?.participants ?? []}
            />
            <TournamentList
              tournaments={tournaments}
              currentId={currentTournamentId}
              onSelect={selectTournament}
              onDelete={deleteTournament}
            />
          </aside>
          <section>
            {current ? (
              <TournamentDetail
                tournament={current}
                participantHistory={participantHistory}
                onGenerateFixtures={() => generateFixtures(current.id)}
                onSimulateMatch={(matchId) => simulateMatch(current.id, matchId)}
                onSetMatchResult={(matchId, winnerId) =>
                  setMatchResult(current.id, matchId, winnerId)
                }
                onSimulateRound={(round) => simulateRound(current.id, round)}
                onSimulateAll={() => simulateAll(current.id)}
                onReset={() => resetTournament(current.id)}
                onRatingChange={(participantId, rating) =>
                  updateParticipantRating(current.id, participantId, rating)
                }
              />
            ) : (
              <section className="panel">
                <h2>No Tournament Selected</h2>
                <p>Create and select a tournament to begin.</p>
              </section>
            )}
          </section>
        </section>
      ) : (
        <HistoryPage
          tournaments={tournaments}
          participantHistory={participantHistory}
          onExportStats={exportStats}
          onImportStats={importStats}
          onClearAll={clearAll}
          onOpenTournament={(id) => {
            selectTournament(id);
            setPage("TOURNAMENTS");
          }}
        />
      )}
    </main>
  );
}
