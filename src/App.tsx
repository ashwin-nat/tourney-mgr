import { useEffect, useState } from "react";
import { CreateTournamentForm } from "./components/CreateTournamentForm";
import { HistoryPage } from "./components/HistoryPage";
import { TournamentDetail } from "./components/TournamentDetail";
import { TournamentList } from "./components/TournamentList";
import { useTournamentStore } from "./store/tournamentStore";

export default function App() {
  const [page, setPage] = useState<"TOURNAMENTS" | "HISTORY">("TOURNAMENTS");
  const [playAsByTournamentId, setPlayAsByTournamentId] = useState<
    Record<string, string | null>
  >({});
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

  useEffect(() => {
    setPlayAsByTournamentId((currentSelections) => {
      const tournamentIds = new Set(tournaments.map((t) => t.id));
      let didChange = false;
      const nextSelections: Record<string, string | null> = {};

      for (const [tournamentId, participantId] of Object.entries(currentSelections)) {
        if (tournamentIds.has(tournamentId)) {
          nextSelections[tournamentId] = participantId;
        } else {
          didChange = true;
        }
      }

      return didChange ? nextSelections : currentSelections;
    });
  }, [tournaments]);

  const current = tournaments.find((t) => t.id === currentTournamentId) ?? null;
  const currentPlayAsParticipantId = current ? (playAsByTournamentId[current.id] ?? null) : null;

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
              participantHistory={participantHistory}
              previousParticipants={tournaments[0]?.participants ?? []}
              tournaments={tournaments}
            />
            <TournamentList
              tournaments={tournaments}
              currentId={currentTournamentId}
              onSelect={selectTournament}
              onDelete={(id) => {
                deleteTournament(id);
                setPlayAsByTournamentId((currentSelections) => {
                  if (!(id in currentSelections)) return currentSelections;
                  const nextSelections = { ...currentSelections };
                  delete nextSelections[id];
                  return nextSelections;
                });
              }}
            />
          </aside>
          <section>
            {current ? (
              <TournamentDetail
                tournament={current}
                participantHistory={participantHistory}
                playAsParticipantId={currentPlayAsParticipantId}
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
                onPlayAsParticipantChange={(participantId) => {
                  setPlayAsByTournamentId((currentSelections) => {
                    if (currentSelections[current.id] === participantId) {
                      return currentSelections;
                    }
                    return { ...currentSelections, [current.id]: participantId };
                  });
                }}
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
          onClearAll={() => {
            clearAll();
            setPlayAsByTournamentId({});
          }}
          onOpenTournament={(id) => {
            selectTournament(id);
            setPage("TOURNAMENTS");
          }}
        />
      )}
    </main>
  );
}
