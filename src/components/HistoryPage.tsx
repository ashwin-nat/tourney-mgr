import { useEffect, useMemo, useState } from "react";
import type { ParticipantHistory, Tournament } from "../types";
import { getTournamentChampionName } from "../utils/champion";

type Props = {
  tournaments: Tournament[];
  participantHistory: Record<string, ParticipantHistory>;
  onOpenTournament: (id: string) => void;
  onClearAll: () => void;
};

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function HistoryPage({
  tournaments,
  participantHistory,
  onOpenTournament,
  onClearAll,
}: Props) {
  const [selectedParticipantKey, setSelectedParticipantKey] = useState<string | null>(
    null,
  );
  const participants = Object.values(participantHistory).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.played !== a.played) return b.played - a.played;
    return a.name.localeCompare(b.name);
  });
  const selectedParticipant = useMemo(
    () =>
      participants.find(
        (entry) => entry.name.trim().toLowerCase() === selectedParticipantKey,
      ) ?? null,
    [participants, selectedParticipantKey],
  );
  const selectedOpponents = useMemo(
    () =>
      Object.values(selectedParticipant?.opponents ?? {}).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.played !== a.played) return b.played - a.played;
        return a.opponentName.localeCompare(b.opponentName);
      }),
    [selectedParticipant],
  );

  useEffect(() => {
    if (!selectedParticipant) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedParticipantKey(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedParticipant]);

  const completed = tournaments.filter((tournament) => tournament.status === "COMPLETED").length;
  const totalMatches = tournaments.reduce(
    (count, tournament) => count + tournament.matches.length,
    0,
  );
  const playedMatches = tournaments.reduce(
    (count, tournament) =>
      count + tournament.matches.filter((match) => match.played).length,
    0,
  );

  return (
    <section className="panel">
      <div className="row">
        <h2>History & Stats</h2>
        <button
          className="danger"
          onClick={() => {
            if (
              window.confirm(
                "Clear all tournaments and participant history? This cannot be undone.",
              )
            ) {
              onClearAll();
            }
          }}
        >
          Clear All
        </button>
      </div>
      <div className="historySummary">
        <article className="miniCard">
          <strong>{tournaments.length}</strong>
          <small>Total tournaments</small>
        </article>
        <article className="miniCard">
          <strong>{completed}</strong>
          <small>Completed tournaments</small>
        </article>
        <article className="miniCard">
          <strong>
            {playedMatches}/{totalMatches}
          </strong>
          <small>Matches played</small>
        </article>
        <article className="miniCard">
          <strong>{participants.length}</strong>
          <small>Participants tracked</small>
        </article>
      </div>

      <h3>Player Career Stats</h3>
      {participants.length ? (
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>T</th>
              <th>Win%</th>
              <th>Opponents</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((entry) => {
              const winRate = entry.played ? (entry.wins / entry.played) * 100 : 0;
              const key = entry.name.trim().toLowerCase();
              const isSelected = key === selectedParticipantKey;
              return (
                <tr key={entry.name.toLowerCase()} className={isSelected ? "selectedRow" : ""}>
                  <td>
                    <button
                      className="linkButton"
                      onClick={() =>
                        setSelectedParticipantKey((current) =>
                          current === key ? null : key,
                        )
                      }
                    >
                      {entry.name}
                    </button>
                  </td>
                  <td>{entry.played}</td>
                  <td>{entry.wins}</td>
                  <td>{entry.draws}</td>
                  <td>{entry.losses}</td>
                  <td>{entry.tournaments}</td>
                  <td>{pct(winRate)}</td>
                  <td>{Object.keys(entry.opponents ?? {}).length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p>No participant history yet.</p>
      )}
      <h3>Tournament History</h3>
      {tournaments.length ? (
        <table className="historyTable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Format</th>
              <th>Status</th>
              <th>Matches</th>
              <th>Champion</th>
            </tr>
          </thead>
          <tbody>
            {tournaments.map((tournament) => (
              <tr key={tournament.id} onClick={() => onOpenTournament(tournament.id)}>
                <td>{tournament.name}</td>
                <td>{tournament.format}</td>
                <td>{tournament.status}</td>
                <td>
                  {tournament.matches.filter((match) => match.played).length}/
                  {tournament.matches.length}
                </td>
                <td>{getTournamentChampionName(tournament) ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No tournaments created yet.</p>
      )}
      {selectedParticipant && (
        <div
          className="modalOverlay"
          onClick={() => setSelectedParticipantKey(null)}
          role="presentation"
        >
          <section
            className="modalCard"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedParticipant.name} detailed stats`}
          >
            <div className="row modalHeader">
              <h3>{selectedParticipant.name} Detailed Stats</h3>
              <button
                className="danger"
                onClick={() => setSelectedParticipantKey(null)}
              >
                Close
              </button>
            </div>
            <div className="historySummary">
              <article className="miniCard">
                <strong>{selectedParticipant.played}</strong>
                <small>Matches played</small>
              </article>
              <article className="miniCard">
                <strong>{selectedParticipant.wins}</strong>
                <small>Wins</small>
              </article>
              <article className="miniCard">
                <strong>{selectedParticipant.losses}</strong>
                <small>Losses</small>
              </article>
              <article className="miniCard">
                <strong>{selectedParticipant.draws}</strong>
                <small>Draws</small>
              </article>
            </div>
            <h4>Head-to-head</h4>
            {selectedOpponents.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Opponent</th>
                    <th>P</th>
                    <th>W</th>
                    <th>L</th>
                    <th>D</th>
                    <th>Win%</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOpponents.map((opponent) => (
                    <tr
                      key={`${selectedParticipant.name.toLowerCase()}-${opponent.opponentName.toLowerCase()}`}
                    >
                      <td>{opponent.opponentName}</td>
                      <td>{opponent.played}</td>
                      <td>{opponent.wins}</td>
                      <td>{opponent.losses}</td>
                      <td>{opponent.draws}</td>
                      <td>{pct(opponent.played ? (opponent.wins / opponent.played) * 100 : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No opponent history yet for this participant.</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
