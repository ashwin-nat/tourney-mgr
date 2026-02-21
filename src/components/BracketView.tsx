import { useEffect, useMemo, useState } from "react";
import { BYE_ID, type Match, type Tournament } from "../types";
import { getTournamentChampionName } from "../utils/champion";

type Props = {
  tournament: Tournament;
  onSimulateMatch: (matchId: string) => void;
  onSetMatchResult: (matchId: string, winnerId: string) => void;
};

function participantName(tournament: Tournament, id: string): string {
  if (id === BYE_ID) return "BYE";
  return tournament.participants.find((p) => p.id === id)?.name ?? "Unknown";
}

function stageLabel(stage: Match["stage"]): string {
  if (stage === "GROUP") return "Group";
  if (stage === "SWISS") return "Swiss";
  if (stage === "LEAGUE") return "League";
  return "Knockout";
}

function outcomeFor(match: Match, participantId: string): "win" | "loss" | "draw" | "pending" {
  if (!match.played) return "pending";
  if (!match.winner) return "draw";
  return match.winner === participantId ? "win" : "loss";
}

function outcomeIcon(outcome: ReturnType<typeof outcomeFor>): string {
  if (outcome === "win") return "✅";
  if (outcome === "loss") return "❌";
  if (outcome === "draw") return "🤝";
  return "⏳";
}

export function BracketView({
  tournament,
  onSimulateMatch,
  onSetMatchResult,
}: Props) {
  const { format, matches } = tournament;
  const [leagueRoundPage, setLeagueRoundPage] = useState(0);
  const championName = getTournamentChampionName(tournament);
  const latestRound = Math.max(...matches.map((match) => match.round), 0);
  const roundsForStage = (stage: Match["stage"]) =>
    [...new Set(matches.filter((match) => match.stage === stage).map((match) => match.round))].sort(
      (a, b) => a - b,
    );

  const leagueRounds = useMemo(() => roundsForStage("LEAGUE"), [matches]);
  const leaguePageSize = 5;
  const leaguePageCount = Math.max(1, Math.ceil(leagueRounds.length / leaguePageSize));

  useEffect(() => {
    setLeagueRoundPage(0);
  }, [tournament.id, tournament.format]);

  useEffect(() => {
    setLeagueRoundPage((current) => Math.min(current, leaguePageCount - 1));
  }, [leaguePageCount]);

  function renderRoundsForStage(stage: Match["stage"], roundsToRender?: number[]) {
    const rounds = roundsForStage(stage);
    const visibleRounds = roundsToRender ?? rounds;
    if (!visibleRounds.length) return null;
    return (
      <div className="roundsViewport">
        <div className="bracket">
          {visibleRounds.map((round) => (
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
                    <div key={m.id} className="miniCard matchCard">
                      <div className="nameRow">
                        <span>{participantName(tournament, m.playerA)}</span>
                        <span
                          className={`resultMark ${outcomeFor(m, m.playerA)}`}
                          title={outcomeFor(m, m.playerA)}
                        >
                          {outcomeIcon(outcomeFor(m, m.playerA))}
                        </span>
                      </div>
                      <div className="nameRow">
                        <span>{participantName(tournament, m.playerB)}</span>
                        <span
                          className={`resultMark ${outcomeFor(m, m.playerB)}`}
                          title={outcomeFor(m, m.playerB)}
                        >
                          {outcomeIcon(outcomeFor(m, m.playerB))}
                        </span>
                      </div>
                      <small className="matchMeta">
                        {m.groupId ? `👥 ${m.groupId}` : ""}
                        {!m.played ? " ⏳ Pending" : ""}
                        {m.played && !m.winner ? " 🤝 Draw" : ""}
                      </small>
                      {!m.played && (
                        <button onClick={() => onSimulateMatch(m.id)}>🎲 Sim</button>
                      )}
                      {m.playerA !== BYE_ID && m.playerB !== BYE_ID && (
                        <div className="row actionRow">
                          <button
                            disabled={manualResultDisabled}
                            title={manualResultReason}
                            onClick={() => onSetMatchResult(m.id, m.playerA)}
                          >
                            🟢 {participantName(tournament, m.playerA)}
                          </button>
                          <button
                            disabled={manualResultDisabled}
                            title={manualResultReason}
                            onClick={() => onSetMatchResult(m.id, m.playerB)}
                          >
                            🟢 {participantName(tournament, m.playerB)}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!matches.length) return null;

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
      ) : format === "LEAGUE" ? (
        <div className="stack">
          <div className="row">
            <button
              onClick={() => setLeagueRoundPage((current) => Math.max(0, current - 1))}
              disabled={leagueRoundPage === 0}
            >
              Prev Rounds
            </button>
            <button
              onClick={() =>
                setLeagueRoundPage((current) =>
                  Math.min(leaguePageCount - 1, current + 1),
                )
              }
              disabled={leagueRoundPage >= leaguePageCount - 1}
            >
              Next Rounds
            </button>
            <small>
              Page {leagueRoundPage + 1}/{leaguePageCount}
            </small>
          </div>
          {renderRoundsForStage(
            "LEAGUE",
            leagueRounds.slice(
              leagueRoundPage * leaguePageSize,
              leagueRoundPage * leaguePageSize + leaguePageSize,
            ),
          )}
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
