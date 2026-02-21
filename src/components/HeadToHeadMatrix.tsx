import { useMemo, useState } from "react";
import type { Match, Participant } from "../types";

type Props = {
  title: string;
  participants: Participant[];
  matches: Match[];
};

function shortName(name: string): string {
  return name.length <= 10 ? name : `${name.slice(0, 10)}...`;
}

function cellResult(match: Match, participantId: string): string {
  if (!match.played) return `R${match.round}\u23F3`;
  if (!match.winner) return `R${match.round}\u{1F91D}`;
  return match.winner === participantId ? `R${match.round}\u2705` : `R${match.round}\u274C`;
}

export function HeadToHeadMatrix({ title, participants, matches }: Props) {
  const sortedParticipants = [...participants].sort((a, b) => a.name.localeCompare(b.name));
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [hoveredColId, setHoveredColId] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ rowId: string; colId: string } | null>(null);
  const hasFocus = hoveredRowId !== null || hoveredColId !== null || hoveredCell !== null;

  const matchLookup = useMemo(() => {
    const lookup = new Map<string, Match[]>();
    for (const match of matches) {
      const key = [match.playerA, match.playerB].sort().join("|");
      const existing = lookup.get(key);
      if (existing) existing.push(match);
      else lookup.set(key, [match]);
    }
    for (const fixtureList of lookup.values()) fixtureList.sort((a, b) => a.round - b.round);
    return lookup;
  }, [matches]);

  function isDataCellDimmed(rowId: string, colId: string): boolean {
    if (!hasFocus) return false;
    if (hoveredCell) return rowId !== hoveredCell.rowId && colId !== hoveredCell.colId;
    if (hoveredRowId) return rowId !== hoveredRowId;
    if (hoveredColId) return colId !== hoveredColId;
    return false;
  }

  function isRowHeaderDimmed(rowId: string): boolean {
    if (!hasFocus || hoveredColId) return false;
    if (hoveredCell) return rowId !== hoveredCell.rowId;
    if (hoveredRowId) return rowId !== hoveredRowId;
    return false;
  }

  function isColHeaderDimmed(colId: string): boolean {
    if (!hasFocus || hoveredRowId) return false;
    if (hoveredCell) return colId !== hoveredCell.colId;
    if (hoveredColId) return colId !== hoveredColId;
    return false;
  }

  return (
    <section className="panel compactPanel">
      <h3>{title}</h3>
      <div className="matrixViewport">
        <table
          className={`matrixTable ${hasFocus ? "matrixFocused" : ""}`}
          onMouseLeave={() => {
            setHoveredRowId(null);
            setHoveredColId(null);
            setHoveredCell(null);
          }}
        >
          <thead>
            <tr>
              <th>vs</th>
              {sortedParticipants.map((participant) => (
                <th
                  key={`col-${participant.id}`}
                  title={participant.name}
                  className={isColHeaderDimmed(participant.id) ? "matrixDimmed" : ""}
                  onMouseEnter={() => {
                    setHoveredColId(participant.id);
                    setHoveredRowId(null);
                    setHoveredCell(null);
                  }}
                >
                  {shortName(participant.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedParticipants.map((rowParticipant) => (
              <tr key={`row-${rowParticipant.id}`}>
                <th
                  title={rowParticipant.name}
                  className={isRowHeaderDimmed(rowParticipant.id) ? "matrixDimmed" : ""}
                  onMouseEnter={() => {
                    setHoveredRowId(rowParticipant.id);
                    setHoveredColId(null);
                    setHoveredCell(null);
                  }}
                >
                  {shortName(rowParticipant.name)}
                </th>
                {sortedParticipants.map((colParticipant) => {
                  const key = [rowParticipant.id, colParticipant.id].sort().join("|");
                  const h2hMatches = rowParticipant.id === colParticipant.id ? [] : (matchLookup.get(key) ?? []);
                  const displayed =
                    rowParticipant.id === colParticipant.id
                      ? "-"
                      : [h2hMatches[0], h2hMatches[1]]
                          .map((match) => (match ? cellResult(match, rowParticipant.id) : "."))
                          .join(" ");

                  return (
                    <td
                      key={`${rowParticipant.id}-${colParticipant.id}`}
                      title={displayed}
                      className={`${rowParticipant.id === colParticipant.id ? "diagCell " : ""}${
                        isDataCellDimmed(rowParticipant.id, colParticipant.id) ? "matrixDimmed" : ""
                      }`}
                      onMouseEnter={() => {
                        setHoveredCell({ rowId: rowParticipant.id, colId: colParticipant.id });
                        setHoveredRowId(null);
                        setHoveredColId(null);
                      }}
                    >
                      {displayed}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
