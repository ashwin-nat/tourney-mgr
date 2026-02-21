import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Participant, Standing } from "../types";
import { SortableTable } from "./SortableTable";

type Props = {
  participants: Participant[];
  standings: Record<string, Standing> | undefined;
  title?: string;
};

export function StandingsTable({ participants, standings, title = "Standings" }: Props) {
  if (!standings) return null;
  const rows = participants
    .map((participant) => ({
      id: participant.id,
      name: participant.name,
      rating: participant.rating,
      ...(standings[participant.id] ?? {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
      }),
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.rating - a.rating;
    });
  const columns = useMemo<ColumnDef<(typeof rows)[number]>[]>(
    () => [
      { header: "Name", accessorKey: "name" },
      { header: "P", accessorKey: "played" },
      { header: "W", accessorKey: "wins" },
      { header: "D", accessorKey: "draws" },
      { header: "L", accessorKey: "losses" },
      { header: "Pts", accessorKey: "points" },
    ],
    [],
  );

  return (
    <section className="panel compactPanel">
      <h3>{title}</h3>
      <div className="tableViewport">
        <SortableTable data={rows} columns={columns} className="standingsTable" />
      </div>
    </section>
  );
}
