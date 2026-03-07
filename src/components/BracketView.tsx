import { useEffect, useMemo, useRef, useState } from "react";
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

type BracketLine = {
  key: string;
  d: string;
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

function knockoutBracketLabel(bracket?: Match["knockoutBracket"]): string {
  if (bracket === "LOWER") return "Lower Bracket";
  if (bracket === "GRAND_FINAL") return "Grand Final";
  return "Upper Bracket";
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
  const [knockoutLinesByTrack, setKnockoutLinesByTrack] = useState<
    Record<string, BracketLine[]>
  >({});
  const bracketRootRef = useRef<HTMLElement | null>(null);
  const championName = getTournamentChampionName(tournament);
  const matchesForStage = (
    stage: Match["stage"],
    knockoutBracket?: Match["knockoutBracket"],
  ) =>
    matches.filter((match) => {
      if (match.stage !== stage) return false;
      if (stage !== "KNOCKOUT" || !knockoutBracket) return true;
      if (knockoutBracket === "UPPER") {
        return match.knockoutBracket === undefined || match.knockoutBracket === "UPPER";
      }
      return match.knockoutBracket === knockoutBracket;
    });

  const roundsForStage = (
    stage: Match["stage"],
    knockoutBracket?: Match["knockoutBracket"],
  ) =>
    [...new Set(matchesForStage(stage, knockoutBracket).map((match) => match.round))].sort(
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

  useEffect(() => {
    const root = bracketRootRef.current;
    if (!root) return;

    const allMatchesById = new Map(matches.map((match) => [match.id, match]));

    const recomputeLines = () => {
      const nextByTrack: Record<string, BracketLine[]> = {};
      const canvases = root.querySelectorAll<HTMLElement>(".bracketCanvas[data-stage='KNOCKOUT']");

      canvases.forEach((canvas) => {
        const trackKey = canvas.dataset.trackKey;
        if (!trackKey) return;

        const canvasRect = canvas.getBoundingClientRect();
        const cardEls = [...canvas.querySelectorAll<HTMLElement>(".matchCard[data-match-id]")];
        if (!cardEls.length) {
          nextByTrack[trackKey] = [];
          return;
        }

        const cardPositionById = new Map<
          string,
          { round: number; left: number; right: number; centerY: number }
        >();
        for (const card of cardEls) {
          const matchId = card.dataset.matchId;
          const roundValue = Number(card.dataset.round);
          if (!matchId || !Number.isFinite(roundValue)) continue;
          const rect = card.getBoundingClientRect();
          cardPositionById.set(matchId, {
            round: roundValue,
            left: rect.left - canvasRect.left,
            right: rect.right - canvasRect.left,
            centerY: rect.top - canvasRect.top + rect.height / 2,
          });
        }

        const roundNumbers = [...new Set([...cardPositionById.values()].map((p) => p.round))].sort(
          (a, b) => a - b,
        );
        const lines: BracketLine[] = [];

        for (let i = 0; i < roundNumbers.length - 1; i += 1) {
          const currentRound = roundNumbers[i];
          const nextRound = roundNumbers[i + 1];
          const currentRoundIds = [...cardPositionById.entries()]
            .filter(([, p]) => p.round === currentRound)
            .sort((a, b) => a[1].centerY - b[1].centerY)
            .map(([id]) => id);
          const nextRoundIds = [...cardPositionById.entries()]
            .filter(([, p]) => p.round === nextRound)
            .sort((a, b) => a[1].centerY - b[1].centerY)
            .map(([id]) => id);

          currentRoundIds.forEach((matchId, index) => {
            const sourcePos = cardPositionById.get(matchId);
            const sourceMatch = allMatchesById.get(matchId);
            if (!sourcePos || !sourceMatch || !nextRoundIds.length) return;

            let targetId: string | undefined;
            if (sourceMatch.played && sourceMatch.winner) {
              targetId = nextRoundIds.find((id) => {
                const nextMatch = allMatchesById.get(id);
                if (!nextMatch) return false;
                return (
                  nextMatch.playerA === sourceMatch.winner || nextMatch.playerB === sourceMatch.winner
                );
              });
            }
            if (!targetId) {
              targetId = nextRoundIds[Math.floor(index / 2)];
            }
            if (!targetId) return;

            const targetPos = cardPositionById.get(targetId);
            if (!targetPos) return;

            const x1 = sourcePos.right + 2;
            const y1 = sourcePos.centerY;
            const x2 = targetPos.left - 2;
            const y2 = targetPos.centerY;
            const midX = x1 + (x2 - x1) * 0.5;
            const d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
            lines.push({ key: `${matchId}->${targetId}`, d });
          });
        }

        nextByTrack[trackKey] = lines;
      });

      setKnockoutLinesByTrack(nextByTrack);
    };

    const frame = requestAnimationFrame(recomputeLines);
    window.addEventListener("resize", recomputeLines);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", recomputeLines);
    };
  }, [matches]);
  const availableKoTracks = (["UPPER", "LOWER", "GRAND_FINAL"] as const).filter(
    (track) => roundsForStage("KNOCKOUT", track).length > 0,
  );

  function renderRoundsForStage(
    stage: Match["stage"],
    roundsToRender?: number[],
    knockoutBracket?: Match["knockoutBracket"],
  ) {
    const rounds = roundsForStage(stage, knockoutBracket);
    const visibleRounds = roundsToRender ?? rounds;
    if (!visibleRounds.length) return null;

    const stageMatches = matchesForStage(stage, knockoutBracket);
    const ongoingRound = stageMatches.find((match) => !match.played)?.round;
    const knockoutMatches = matches.filter((match) => match.stage === "KNOCKOUT");
    const knockoutExists = knockoutMatches.length > 0;
    const knockoutStarted = knockoutMatches.some((match) => match.played);
    const { allowedRound, currentRoundStarted } = getStageManualEditContext(stageMatches);
    const trackKey = `${stage}:${knockoutBracket ?? "ALL"}:${visibleRounds.join(",")}`;

    return (
      <div className="roundsViewport">
        <div
          className="bracketCanvas"
          data-stage={stage}
          data-track-key={trackKey}
        >
          {stage === "KNOCKOUT" && (
            <svg className="bracketLines" aria-hidden="true">
              {(knockoutLinesByTrack[trackKey] ?? []).map((line) => (
                <path key={line.key} d={line.d} />
              ))}
            </svg>
          )}
          <div className="bracket">
          {visibleRounds.map((round) => (
            <div
              key={`${stage}-${round}`}
              className={`roundCol ${ongoingRound === round ? "ongoingRoundCol" : ""}`}
            >
              <h4>{stage === "KNOCKOUT" ? `R${round}` : `${stageLabel(stage)} R${round}`}</h4>
              {matches
                .filter((m) => {
                  if (m.stage !== stage || m.round !== round) return false;
                  if (stage !== "KNOCKOUT" || !knockoutBracket) return true;
                  if (knockoutBracket === "UPPER") {
                    return m.knockoutBracket === undefined || m.knockoutBracket === "UPPER";
                  }
                  return m.knockoutBracket === knockoutBracket;
                })
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
                    <div key={m.id} className="miniCard matchCard" data-match-id={m.id} data-round={m.round}>
                      <div className="matchMainGrid">
                        <div className="namePicks">
                          <button
                            className={`namePick ${outcomeFor(m, m.playerA)}`}
                            disabled={
                              m.playerA === BYE_ID || m.playerB === BYE_ID || manualResultDisabled
                            }
                            title={manualResultReason}
                            onClick={() => onSetMatchResult(m.id, m.playerA)}
                          >
                            <span>{participantName(tournament, m.playerA)}</span>
                            <span
                              className={`resultMark ${outcomeFor(m, m.playerA)}`}
                              title={outcomeFor(m, m.playerA)}
                            >
                              {outcomeIcon(outcomeFor(m, m.playerA))}
                            </span>
                          </button>
                          <button
                            className={`namePick ${outcomeFor(m, m.playerB)}`}
                            disabled={
                              m.playerA === BYE_ID || m.playerB === BYE_ID || manualResultDisabled
                            }
                            title={manualResultReason}
                            onClick={() => onSetMatchResult(m.id, m.playerB)}
                          >
                            <span>{participantName(tournament, m.playerB)}</span>
                            <span
                              className={`resultMark ${outcomeFor(m, m.playerB)}`}
                              title={outcomeFor(m, m.playerB)}
                            >
                              {outcomeIcon(outcomeFor(m, m.playerB))}
                            </span>
                          </button>
                        </div>
                        <button
                          className="simButton"
                          disabled={m.played}
                          title={m.played ? "Match already has a result." : undefined}
                          onClick={() => onSimulateMatch(m.id)}
                        >
                          {"\uD83C\uDFB2"} Sim
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          ))}
          </div>
        </div>
      </div>
    );
  }

  if (!matches.length) return null;

  return (
    <section className="panel" ref={bracketRootRef}>
      <h3>{format === "KNOCKOUT" ? "Bracket" : "Rounds"}</h3>
      {format === "GROUP_KO" ? (
        <div className="stack">
          <section>
            <h4>Group Stage</h4>
            {renderRoundsForStage("GROUP")}
          </section>
          <section>
            <h4>Knockout Stage</h4>
            {availableKoTracks.length
              ? availableKoTracks.map((track) => (
                  <div key={track} className="stack">
                    <h4>{knockoutBracketLabel(track)}</h4>
                    {renderRoundsForStage("KNOCKOUT", undefined, track)}
                  </div>
                ))
              : <p>Not started yet.</p>}
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
        <>
          {format === "SWISS" ? (
            renderRoundsForStage("SWISS")
          ) : availableKoTracks.length ? (
            availableKoTracks.map((track) => (
              <div key={track} className="stack">
                <h4>{knockoutBracketLabel(track)}</h4>
                {renderRoundsForStage("KNOCKOUT", undefined, track)}
              </div>
            ))
          ) : (
            <p>No bracket generated yet.</p>
          )}
        </>
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
