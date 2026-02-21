import { useMemo } from "react";
import { CreateTournamentForm } from "./components/CreateTournamentForm";
import { TournamentDetail } from "./components/TournamentDetail";
import { TournamentList } from "./components/TournamentList";
import { useTournamentStore } from "./store/tournamentStore";

export default function App() {
  const {
    tournaments,
    participantHistory,
    currentTournamentId,
    createTournament,
    selectTournament,
    deleteTournament,
    generateFixtures,
    simulateMatch,
    simulateRound,
    simulateAll,
    resetTournament,
    updateParticipantRating,
  } = useTournamentStore();

  const current = tournaments.find((t) => t.id === currentTournamentId) ?? null;
  const historyNames = useMemo(
    () =>
      Object.values(participantHistory)
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b)),
    [participantHistory],
  );

  return (
    <main className="layout">
      <aside>
        <CreateTournamentForm onCreate={createTournament} historyNames={historyNames} />
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
    </main>
  );
}
