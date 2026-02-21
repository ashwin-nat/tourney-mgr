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
  const participants = Object.values(participantHistory).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.played !== a.played) return b.played - a.played;
    return a.name.localeCompare(b.name);
  });

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
              <th>Win%</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((entry) => {
              const winRate = entry.played ? (entry.wins / entry.played) * 100 : 0;
              return (
                <tr key={entry.name.toLowerCase()}>
                  <td>{entry.name}</td>
                  <td>{entry.played}</td>
                  <td>{entry.wins}</td>
                  <td>{entry.draws}</td>
                  <td>{entry.losses}</td>
                  <td>{pct(winRate)}</td>
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
    </section>
  );
}
