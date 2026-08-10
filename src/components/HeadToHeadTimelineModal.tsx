import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Tournament } from "../types";
import { getAllResultsVsOpponent, type RecentResult } from "./HistoryPage";
import { SortableTable } from "./SortableTable";

type Props = {
  participantName: string;
  opponentName: string;
  tournaments: Tournament[];
  onClose: () => void;
};

type EncounterPoint = RecentResult & {
  index: number;
  cumulative: number;
  streak: number;
};

const OUTCOME_COLOR: Record<RecentResult["outcome"], string> = {
  W: "#63d187",
  L: "#d4576b",
  D: "#a4b5ca",
};

const OUTCOME_LABEL: Record<RecentResult["outcome"], string> = {
  W: "Win",
  L: "Loss",
  D: "Draw",
};

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const MARGIN = { top: 16, right: 16, bottom: 16, left: 32 };

export function HeadToHeadTimelineModal({
  participantName,
  opponentName,
  tournaments,
  onClose,
}: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Computed only when this modal is mounted (i.e. on demand, when a name is clicked).
  const encounters = useMemo<EncounterPoint[]>(() => {
    const results = getAllResultsVsOpponent(tournaments, participantName, opponentName);
    let cumulative = 0;
    let streak = 0;
    return results.map((result, index) => {
      cumulative += result.outcome === "W" ? 1 : result.outcome === "L" ? -1 : 0;
      if (result.outcome === "D") streak = 0;
      else if (result.outcome === "W") streak = streak > 0 ? streak + 1 : 1;
      else streak = streak < 0 ? streak - 1 : -1;
      return { ...result, index, cumulative, streak };
    });
  }, [tournaments, participantName, opponentName]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const record = useMemo(
    () => ({
      wins: encounters.filter((e) => e.outcome === "W").length,
      losses: encounters.filter((e) => e.outcome === "L").length,
      draws: encounters.filter((e) => e.outcome === "D").length,
    }),
    [encounters],
  );

  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

  const maxAbs = Math.max(1, ...encounters.map((e) => Math.abs(e.cumulative)));
  const yScale = (value: number) => plotHeight / 2 - (value / maxAbs) * (plotHeight / 2);
  const xScale = (index: number) =>
    encounters.length > 1 ? (index / (encounters.length - 1)) * plotWidth : plotWidth / 2;

  const linePath = encounters
    .map((point, i) => `${i === 0 ? "M" : "L"} ${xScale(point.index)} ${yScale(point.cumulative)}`)
    .join(" ");

  const tableColumns = useMemo<ColumnDef<EncounterPoint>[]>(
    () => [
      { header: "#", accessorKey: "index", cell: (ctx) => ctx.getValue<number>() + 1 },
      { header: "Tournament", accessorKey: "tournamentName" },
      { header: "Round", accessorKey: "round" },
      {
        header: "Result",
        accessorKey: "outcome",
        cell: (ctx) => {
          const outcome = ctx.getValue<RecentResult["outcome"]>();
          return (
            <span
              className={
                outcome === "W"
                  ? "recentBadge recentBadgeWin"
                  : outcome === "L"
                    ? "recentBadge recentBadgeLoss"
                    : "recentBadge recentBadgeDraw"
              }
            >
              {outcome}
            </span>
          );
        },
      },
      { header: "Net", accessorKey: "cumulative" },
    ],
    [],
  );

  const hovered = hoveredIndex !== null ? encounters[hoveredIndex] : null;
  const hoveredPosition = hovered
    ? {
        leftPct: Math.min(
          92,
          Math.max(8, ((MARGIN.left + xScale(hovered.index)) / CHART_WIDTH) * 100),
        ),
        topPct: ((MARGIN.top + yScale(hovered.cumulative)) / CHART_HEIGHT) * 100,
      }
    : null;

  return (
    <div className="modalOverlay" onClick={onClose} role="presentation">
      <section
        className="modalCard timelineModalCard"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${participantName} vs ${opponentName} timeline`}
      >
        <div className="row modalHeader timelineFixed">
          <h3>
            {participantName} vs {opponentName}
          </h3>
          <button onClick={onClose}>Close</button>
        </div>

        {encounters.length === 0 ? (
          <p>No encounters yet.</p>
        ) : (
          <>
            <div className="row timelineLegend timelineFixed">
              <span className="recentBadge recentBadgeWin">W</span>
              <small>{record.wins} wins</small>
              <span className="recentBadge recentBadgeLoss">L</span>
              <small>{record.losses} losses</small>
              <span className="recentBadge recentBadgeDraw">D</span>
              <small>{record.draws} draws</small>
            </div>

            <div className="timelineChartWrap timelineFixed">
              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                className="timelineChart"
                role="img"
                aria-label="Cumulative head-to-head net record over time"
              >
                <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
                  <line
                    x1={0}
                    x2={plotWidth}
                    y1={yScale(0)}
                    y2={yScale(0)}
                    className="timelineBaseline"
                  />
                  <text x={-6} y={yScale(0)} className="timelineAxisLabel" textAnchor="end" dy="0.32em">
                    0
                  </text>
                  <text
                    x={-6}
                    y={yScale(maxAbs)}
                    className="timelineAxisLabel"
                    textAnchor="end"
                    dy="0.32em"
                  >
                    +{maxAbs}
                  </text>
                  <text
                    x={-6}
                    y={yScale(-maxAbs)}
                    className="timelineAxisLabel"
                    textAnchor="end"
                    dy="0.32em"
                  >
                    -{maxAbs}
                  </text>

                  <path d={linePath} className="timelineLine" fill="none" />

                  {encounters.map((point) => (
                    <circle
                      key={point.index}
                      cx={xScale(point.index)}
                      cy={yScale(point.cumulative)}
                      r={hoveredIndex === point.index ? 6 : 5}
                      fill={OUTCOME_COLOR[point.outcome]}
                      className="timelineMarker"
                      onMouseEnter={() => setHoveredIndex(point.index)}
                      onMouseLeave={() => setHoveredIndex((current) => (current === point.index ? null : current))}
                    >
                      <title>
                        {`Match ${point.index + 1}: ${OUTCOME_LABEL[point.outcome]} vs ${point.opponentName} (${point.tournamentName}, R${point.round}) — net ${point.cumulative > 0 ? `+${point.cumulative}` : point.cumulative}`}
                      </title>
                    </circle>
                  ))}
                </g>
              </svg>
              {hovered && hoveredPosition && (
                <div
                  className="timelineTooltip"
                  style={{ left: `${hoveredPosition.leftPct}%`, top: `${hoveredPosition.topPct}%` }}
                >
                  <strong>
                    Match {hovered.index + 1}: {OUTCOME_LABEL[hovered.outcome]}
                  </strong>
                  <span>
                    {hovered.tournamentName} · Round {hovered.round}
                  </span>
                  <span>Net record: {hovered.cumulative > 0 ? `+${hovered.cumulative}` : hovered.cumulative}</span>
                  <span>
                    Current streak: {hovered.streak > 0 ? `+${hovered.streak}` : hovered.streak}
                  </span>
                </div>
              )}
            </div>

            <div className="tableViewport timelineTableViewport">
              <SortableTable data={encounters} columns={tableColumns} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
