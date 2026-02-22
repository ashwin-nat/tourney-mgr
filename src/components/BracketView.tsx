import { useEffect, useMemo, useState } from "react";
import { BYE_ID, type Match, type Tournament } from "../types";
import {
  getStageManualEditContext,
  isGroupRoundEditAllowed,
  isManualRoundEditAllowed,
} from "../utils/manualResultRules";
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
  if (outcome === "win") return "\u2705";
  if (outcome === "loss") return "\u274C";
  if (outcome === "draw") return "\uD83E\uDD1D";
  return "\u23F3";
}

export function BracketView({
  tournament,
  onSimulateMatch,
  onSetMatchResult,
}: Props) {
  const { format, matches } = tournament;
  const [leagueRoundPage, setLeagueRoundPage] = useState(0);
  const championName = getTournamentChampionName(tournament);
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

    const stageMatches = matches.filter((match) => match.stage === stage);
    const ongoingRound = stageMatches.find((match) => !match.played)?.round;
    const knockoutMatches = matches.filter((match) => match.stage === "KNOCKOUT");
    const knockoutExists = knockoutMatches.length > 0;
    const knockoutStarted = knockoutMatches.some((match) => match.played);
    const { allowedRound, currentRoundStarted } = getStageManualEditContext(stageMatches);

    return (
      <div className="roundsViewport">
        <div className="bracket">
          {visibleRounds.map((round) => (
            <div
              key={`${stage}-${round}`}
              className={`roundCol ${ongoingRound === round ? "ongoingRoundCol" : ""}`}
            >
              <h4>
                {stageLabel(stage)} R{round}
              </h4>
              {matches
                .filter((m) => m.stage === stage && m.round === round)
                .map((m) => {
                  const manualResultDisabled =
                    ((m.stage === "KNOCKOUT" || m.stage === "SWISS") && !isManualRoundEditAllowed(stageMatches, m.round)) ||
                    (m.stage === "GROUP" &&
                      !isGroupRoundEditAllowed(stageMatches, knockoutMatches, m.round));
                  const manualResultReason =
                    m.stage === "GROUP" && manualResultDisabled
                      ? knockoutStarted
                        ? "Group-stage results are locked after knockout starts."
                        : knockoutExists
                          ? "Only the last group round can be edited before knockout starts."
                          : "Manual recording is allowed for group-stage matches."
                      : manualResultDisabled
                        ? currentRoundStarted
                          ? "Manual recording is only allowed for the active round in this stage."
                          : `Manual recording is allowed for round ${allowedRound} and round ${Math.max(1, allowedRound - 1)} until this round starts.`
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
                        {m.groupId ? `\uD83D\uDC65 ${m.groupId}` : ""}
                        {!m.played ? " \u23F3 Pending" : ""}
                        {m.played && !m.winner ? " \uD83E\uDD1D Draw" : ""}
                      </small>
                      <button
                        disabled={m.played}
                        title={m.played ? "Match already has a result." : undefined}
                        onClick={() => onSimulateMatch(m.id)}
                      >
                        {"\uD83C\uDFB2"} Sim
                      </button>
                      {m.playerA !== BYE_ID && m.playerB !== BYE_ID && (
                        <div className="row actionRow">
                          <button
                            disabled={manualResultDisabled}
                            title={manualResultReason}
                            onClick={() => onSetMatchResult(m.id, m.playerA)}
                          >
                            {"\uD83D\uDFE2"} {participantName(tournament, m.playerA)}
                          </button>
                          <button
                            disabled={manualResultDisabled}
                            title={manualResultReason}
                            onClick={() => onSetMatchResult(m.id, m.playerB)}
                          >
                            {"\uD83D\uDFE2"} {participantName(tournament, m.playerB)}
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
