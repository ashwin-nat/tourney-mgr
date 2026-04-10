import { useEffect, useMemo, useState } from "react";
import { buildStandings } from "../engine/standings";
import type { ParticipantHistory, Tournament } from "../types";
import { BracketView } from "./BracketView";
import { HeadToHeadMatrix } from "./HeadToHeadMatrix";
import { StandingsTable } from "./StandingsTable";

type Props = {
  tournament: Tournament;
  participantHistory: Record<string, ParticipantHistory>;
  playAsParticipantId: string | null;
  onGenerateFixtures: () => void;
  onSimulateMatch: (matchId: string) => void;
  onSetMatchResult: (matchId: string, winnerId: string) => void;
  onSimulateRound: (round: number) => void;
  onSimulateAll: () => void;
  onReset: () => void;
  onRatingChange: (participantId: string, rating: number) => void;
  onPlayAsParticipantChange: (participantId: string | null) => void;
};

export function TournamentDetail({
  tournament,
  participantHistory,
  playAsParticipantId,
  onGenerateFixtures,
  onSimulateMatch,
  onSetMatchResult,
  onSimulateRound,
  onSimulateAll,
  onReset,
  onRatingChange,
  onPlayAsParticipantChange,
}: Props) {
  const [isPlayAsModalOpen, setIsPlayAsModalOpen] = useState(false);
  const nextRound = tournament.matches.find((m) => !m.played)?.round;
  const groupStageMatches = tournament.matches.filter((m) => m.stage === "GROUP");
  const playAsParticipant = useMemo(
    () =>
      playAsParticipantId
        ? tournament.participants.find((participant) => participant.id === playAsParticipantId) ??
          null
        : null,
    [playAsParticipantId, tournament.participants],
  );
  const participantsAlphabetical = useMemo(
    () =>
      [...tournament.participants].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [tournament.participants],
  );

  useEffect(() => {
    setIsPlayAsModalOpen(false);
  }, [tournament.id]);

  useEffect(() => {
    if (!playAsParticipantId) return;
    const selectedExists = tournament.participants.some(
      (participant) => participant.id === playAsParticipantId,
    );
    if (!selectedExists) onPlayAsParticipantChange(null);
  }, [onPlayAsParticipantChange, playAsParticipantId, tournament.participants]);

  useEffect(() => {
    if (!isPlayAsModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsPlayAsModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPlayAsModalOpen]);

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
        <button onClick={() => setIsPlayAsModalOpen(true)}>Play As</button>
        <button
          className="danger"
          disabled={!playAsParticipantId}
          onClick={() => onPlayAsParticipantChange(null)}
        >
          Clear Play As
        </button>
      </div>
      {playAsParticipant && (
        <p>
          Playing as: <strong>{playAsParticipant.name}</strong>
        </p>
      )}

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
                Career Elo: {Math.round(participantHistory[p.name.trim().toLowerCase()].elo)} |{" "}
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
        <div className="stack">
          <StandingsTable
            participants={tournament.participants}
            standings={tournament.standings}
            title="League Standings"
          />
          <HeadToHeadMatrix
            title="League Head-to-Head Matrix"
            participants={tournament.participants}
            matches={tournament.matches.filter((match) => match.stage === "LEAGUE")}
          />
        </div>
      )}
      {tournament.format === "GROUP_KO" &&
        <div className="groupsGrid">
          {(tournament.groups ?? []).map((group) => {
            const groupParticipants = tournament.participants.filter((participant) =>
              group.participantIds.includes(participant.id),
            );
            const groupMatches = groupStageMatches.filter((match) => match.groupId === group.id);
            const standings = buildStandings(groupParticipants, groupMatches);

            return (
              <div key={group.id} className="stack">
                <StandingsTable
                  participants={groupParticipants}
                  standings={standings}
                  title={`Group ${group.id} Standings`}
                />
                <HeadToHeadMatrix
                  title={`Group ${group.id} Head-to-Head`}
                  participants={groupParticipants}
                  matches={groupMatches}
                />
              </div>
            );
          })}
        </div>}
      <BracketView
        tournament={tournament}
        onSimulateMatch={onSimulateMatch}
        onSimulateRound={onSimulateRound}
        onSetMatchResult={onSetMatchResult}
        playAsParticipantId={playAsParticipantId}
      />
      {isPlayAsModalOpen && (
        <div
          className="modalOverlay"
          onClick={() => setIsPlayAsModalOpen(false)}
          role="presentation"
        >
          <section
            className="modalCard"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Select play-as participant"
          >
            <div className="row modalHeader">
              <h3>Play As</h3>
              <button
                className="danger"
                onClick={() => setIsPlayAsModalOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="tableViewport">
              <table>
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {participantsAlphabetical.map((participant) => {
                    const selected = participant.id === playAsParticipantId;
                    return (
                      <tr key={participant.id} className={selected ? "selectedRow" : ""}>
                        <td>{participant.name}</td>
                        <td>
                          <button
                            className={selected ? "danger" : undefined}
                            onClick={() => {
                              onPlayAsParticipantChange(selected ? null : participant.id);
                              setIsPlayAsModalOpen(false);
                            }}
                          >
                            {selected ? "Clear" : "Select"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
