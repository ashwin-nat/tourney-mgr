import { BYE_ID, type Match, type Tournament } from "../types";
import { getTournamentChampionName } from "../utils/champion";

type Props = {
  tournament: Tournament;
  onSimulateMatch: (matchId: string) => void;
  onSetMatchResult: (matchId: string, winnerId: string) => void;
};

function participantName(tournament: Tournament, id: string): string {
  if (id === "BYE") return "BYE";
  return tournament.participants.find((p) => p.id === id)?.name ?? "Unknown";
}

function stageLabel(stage: Match["stage"]): string {
  if (stage === "GROUP") return "Group";
  if (stage === "SWISS") return "Swiss";
  return "Knockout";
}

function outcomeFor(match: Match, participantId: string): "win" | "loss" | "draw" | "pending" {
  if (!match.played) return "pending";
  if (!match.winner) return "draw";
  return match.winner === participantId ? "win" : "loss";
}

export function BracketView({
  tournament,
  onSimulateMatch,
  onSetMatchResult,
}: Props) {
  const { format, matches } = tournament;
  if (!matches.length) return null;
  const championName = getTournamentChampionName(tournament);
  const latestRound = Math.max(...matches.map((match) => match.round), 0);
  const roundsForStage = (stage: Match["stage"]) =>
    [...new Set(matches.filter((match) => match.stage === stage).map((match) => match.round))].sort(
      (a, b) => a - b,
    );

  function renderRoundsForStage(stage: Match["stage"]) {
    const rounds = roundsForStage(stage);
    if (!rounds.length) return null;
    return (
      <div className="bracket">
        {rounds.map((round) => (
          <div key={`${stage}-${round}`} className="roundCol">
            <h4>
              {stageLabel(stage)} R{round}
            </h4>
            {matches
              .filter((m) => m.stage === stage && m.round === round)
              .map((m) => {
                const manualResultDisabled = m.round !== latestRound;
                const manualResultReason = manualResultDisabled
                  ? "Manual recording is only allowed for matches in the latest round."
                  : undefined;

                return (
                  <div key={m.id} className="miniCard">
                    <div className="nameRow">
                      <span>{participantName(tournament, m.playerA)}</span>
                      {outcomeFor(m, m.playerA) === "win" && (
                        <span className="resultMark win">[W]</span>
                      )}
                      {outcomeFor(m, m.playerA) === "loss" && (
                        <span className="resultMark loss">[L]</span>
                      )}
                    </div>
                    <div className="nameRow">
                      <span>{participantName(tournament, m.playerB)}</span>
                      {outcomeFor(m, m.playerB) === "win" && (
                        <span className="resultMark win">[W]</span>
                      )}
                      {outcomeFor(m, m.playerB) === "loss" && (
                        <span className="resultMark loss">[L]</span>
                      )}
                    </div>
                    {m.groupId && <small>Group {m.groupId}</small>}
                    {!m.played && <small>Pending</small>}
                    {m.played && !m.winner && <small>Draw</small>}
                    {!m.played && (
                      <button onClick={() => onSimulateMatch(m.id)}>Simulate</button>
                    )}
                    {m.playerA !== BYE_ID && m.playerB !== BYE_ID && (
                      <div className="row">
                        <button
                          disabled={manualResultDisabled}
                          title={manualResultReason}
                          onClick={() => onSetMatchResult(m.id, m.playerA)}
                        >
                          {m.played ? "Set Winner" : "Record"} {participantName(tournament, m.playerA)}
                        </button>
                        <button
                          disabled={manualResultDisabled}
                          title={manualResultReason}
                          onClick={() => onSetMatchResult(m.id, m.playerB)}
                        >
                          {m.played ? "Set Winner" : "Record"} {participantName(tournament, m.playerB)}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="panel">
      <h3>{format === "KNOCKOUT" ? "Bracket" : "Rounds"}</h3>
      {format === "GROUP_KO" ? (
        <div className="stack">
          <section>
            <h4>Group Stage</h4>
            {renderRoundsForStage("GROUP")}
          </section>
          <section>
            <h4>Knockout Stage</h4>
            {renderRoundsForStage("KNOCKOUT") ?? <p>Not started yet.</p>}
          </section>
        </div>
      ) : (
        renderRoundsForStage(format === "SWISS" ? "SWISS" : "KNOCKOUT")
      )}
      {tournament.status === "COMPLETED" && (
        <div className="championBlock">
          <h4>Champion</h4>
          <p>{championName ?? "No champion determined"}</p>
        </div>
      )}
    </section>
  );
}
