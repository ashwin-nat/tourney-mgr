import type { Tournament } from "../types";
import { BracketView } from "./BracketView";
import { StandingsTable } from "./StandingsTable";

type Props = {
  tournament: Tournament;
  onGenerateFixtures: () => void;
  onSimulateMatch: (matchId: string) => void;
  onSimulateRound: (round: number) => void;
  onSimulateAll: () => void;
  onReset: () => void;
  onRatingChange: (participantId: string, rating: number) => void;
};

function participantName(t: Tournament, id: string): string {
  if (id === "BYE") return "BYE";
  return t.participants.find((p) => p.id === id)?.name ?? "Unknown";
}

export function TournamentDetail({
  tournament,
  onGenerateFixtures,
  onSimulateMatch,
  onSimulateRound,
  onSimulateAll,
  onReset,
  onRatingChange,
}: Props) {
  const rounds = [...new Set(tournament.matches.map((m) => m.round))].sort(
    (a, b) => a - b,
  );
  const nextRound = tournament.matches.find((m) => !m.played)?.round;

  return (
    <section className="panel">
      <h2>{tournament.name}</h2>
      <p>
        {tournament.format} | {tournament.status}
      </p>
      <div className="row">
        <button onClick={onGenerateFixtures}>Generate Fixtures</button>
        <button onClick={onSimulateAll} disabled={!tournament.matches.length}>
          Simulate All
        </button>
        <button
          onClick={() => nextRound && onSimulateRound(nextRound)}
          disabled={!nextRound}
        >
          Simulate Next Round
        </button>
        <button className="danger" onClick={onReset}>
          Reset
        </button>
      </div>

      <h3>Participants</h3>
      <div className="grid">
        {tournament.participants.map((p) => (
          <label key={p.id} className="miniCard">
            {p.name}
            <input
              type="number"
              min={0}
              max={100}
              value={p.rating}
              onChange={(e) => onRatingChange(p.id, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      <h3>Matches</h3>
      {rounds.map((round) => (
        <div key={round} className="panel sub">
          <h4>Round {round}</h4>
          {tournament.matches
            .filter((m) => m.round === round)
            .map((m) => (
              <div className="matchRow" key={m.id}>
                <span>
                  [{m.stage}] {participantName(tournament, m.playerA)} vs{" "}
                  {participantName(tournament, m.playerB)}
                  {m.groupId ? ` (Group ${m.groupId})` : ""}
                </span>
                <span>
                  {m.played
                    ? `${m.scoreA ?? 0}-${m.scoreB ?? 0} | winner: ${
                        m.winner ? participantName(tournament, m.winner) : "draw"
                      }`
                    : "pending"}
                </span>
                {!m.played && (
                  <button onClick={() => onSimulateMatch(m.id)}>Simulate Match</button>
                )}
              </div>
            ))}
        </div>
      ))}

      <StandingsTable
        participants={tournament.participants}
        standings={tournament.standings}
      />
      <BracketView participants={tournament.participants} matches={tournament.matches} />
    </section>
  );
}
