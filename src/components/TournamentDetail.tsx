import { buildStandings } from "../engine/standings";
import type { ParticipantHistory, Tournament } from "../types";
import { BracketView } from "./BracketView";
import { StandingsTable } from "./StandingsTable";

type Props = {
  tournament: Tournament;
  participantHistory: Record<string, ParticipantHistory>;
  onGenerateFixtures: () => void;
  onSimulateMatch: (matchId: string) => void;
  onSetMatchResult: (matchId: string, winnerId: string) => void;
  onSimulateRound: (round: number) => void;
  onSimulateAll: () => void;
  onReset: () => void;
  onRatingChange: (participantId: string, rating: number) => void;
};

export function TournamentDetail({
  tournament,
  participantHistory,
  onGenerateFixtures,
  onSimulateMatch,
  onSetMatchResult,
  onSimulateRound,
  onSimulateAll,
  onReset,
  onRatingChange,
}: Props) {
  const nextRound = tournament.matches.find((m) => !m.played)?.round;
  const groupStageMatches = tournament.matches.filter((m) => m.stage === "GROUP");

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
          <label key={p.id} className="miniCard participantCard">
            {p.name}
            <input
              type="number"
              min={0}
              max={100}
              value={p.rating}
              onChange={(e) => onRatingChange(p.id, Number(e.target.value))}
            />
            {participantHistory[p.name.trim().toLowerCase()] && (
              <small>
                Career W-L-D: {participantHistory[p.name.trim().toLowerCase()].wins}-
                {participantHistory[p.name.trim().toLowerCase()].losses}-
                {participantHistory[p.name.trim().toLowerCase()].draws}
              </small>
            )}
          </label>
        ))}
      </div>

      {tournament.format === "SWISS" && (
        <StandingsTable
          participants={tournament.participants}
          standings={tournament.standings}
        />
      )}
      {tournament.format === "LEAGUE" && (
        <StandingsTable
          participants={tournament.participants}
          standings={tournament.standings}
          title="League Standings"
        />
      )}
      {tournament.format === "GROUP_KO" &&
        (tournament.groups ?? []).map((group) => {
          const groupParticipants = tournament.participants.filter((participant) =>
            group.participantIds.includes(participant.id),
          );
          const standings = buildStandings(
            groupParticipants,
            groupStageMatches.filter((match) => match.groupId === group.id),
          );
          return (
            <StandingsTable
              key={group.id}
              participants={groupParticipants}
              standings={standings}
              title={`Group ${group.id} Standings`}
            />
          );
        })}
      <BracketView
        tournament={tournament}
        onSimulateMatch={onSimulateMatch}
        onSetMatchResult={onSetMatchResult}
      />
    </section>
  );
}
