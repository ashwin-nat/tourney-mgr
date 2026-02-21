import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ParticipantHistory, Tournament } from "../types";
import { getTournamentChampionName } from "../utils/champion";
import { SortableTable } from "./SortableTable";

type Props = {
  tournaments: Tournament[];
  participantHistory: Record<string, ParticipantHistory>;
  onOpenTournament: (id: string) => void;
  onClearAll: () => void;
};

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function HistoryPage({
  tournaments,
  participantHistory,
  onOpenTournament,
  onClearAll,
}: Props) {
  const [selectedParticipantKey, setSelectedParticipantKey] = useState<string | null>(
    null,
  );
  const participants = Object.values(participantHistory).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.played !== a.played) return b.played - a.played;
    return a.name.localeCompare(b.name);
  });
  const selectedParticipant = useMemo(
    () =>
      participants.find(
        (entry) => entry.name.trim().toLowerCase() === selectedParticipantKey,
      ) ?? null,
    [participants, selectedParticipantKey],
  );
  const selectedOpponents = useMemo(
    () =>
      Object.values(selectedParticipant?.opponents ?? {}).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.played !== a.played) return b.played - a.played;
        return a.opponentName.localeCompare(b.opponentName);
      }),
    [selectedParticipant],
  );

  useEffect(() => {
    if (!selectedParticipant) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedParticipantKey(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedParticipant]);

  const completed = tournaments.filter((tournament) => tournament.status === "COMPLETED").length;
  const totalMatches = tournaments.reduce(
    (count, tournament) => count + tournament.matches.length,
    0,
  );
  const playedMatches = tournaments.reduce(
    (count, tournament) =>
      count + tournament.matches.filter((match) => match.played).length,
    0,
  );
  const participantRows = participants.map((entry) => {
    const key = entry.name.trim().toLowerCase();
    const winRate = entry.played ? (entry.wins / entry.played) * 100 : 0;
    return {
      key,
      player: entry.name,
      played: entry.played,
      wins: entry.wins,
      draws: entry.draws,
      losses: entry.losses,
      tournaments: entry.tournaments,
      winRate,
      opponents: Object.keys(entry.opponents ?? {}).length,
      selected: key === selectedParticipantKey,
    };
  });
  const participantColumns = useMemo<ColumnDef<(typeof participantRows)[number]>[]>(
    () => [
      {
        header: "Player",
        accessorKey: "player",
        cell: (ctx) => {
          const row = ctx.row.original;
          return (
            <button
              className={row.selected ? "linkButton selectedLinkButton" : "linkButton"}
              onClick={() =>
                setSelectedParticipantKey((current) => (current === row.key ? null : row.key))
              }
            >
              {row.player}
            </button>
          );
        },
      },
      { header: "P", accessorKey: "played" },
      { header: "W", accessorKey: "wins" },
      { header: "D", accessorKey: "draws" },
      { header: "L", accessorKey: "losses" },
      { header: "T", accessorKey: "tournaments" },
      { header: "Win%", accessorKey: "winRate", cell: (ctx) => pct(ctx.getValue<number>()) },
      { header: "Opponents", accessorKey: "opponents" },
    ],
    [setSelectedParticipantKey],
  );
  const tournamentRows = tournaments.map((tournament) => ({
    id: tournament.id,
    name: tournament.name,
    format: tournament.format,
    status: tournament.status,
    matchesPlayed: tournament.matches.filter((match) => match.played).length,
    matchesTotal: tournament.matches.length,
    champion: getTournamentChampionName(tournament) ?? "-",
  }));
  const tournamentColumns = useMemo<ColumnDef<(typeof tournamentRows)[number]>[]>(
    () => [
      {
        header: "Name",
        accessorKey: "name",
        cell: (ctx) => {
          const row = ctx.row.original;
          return (
            <button className="linkButton" onClick={() => onOpenTournament(row.id)}>
              {row.name}
            </button>
          );
        },
      },
      { header: "Format", accessorKey: "format" },
      { header: "Status", accessorKey: "status" },
      {
        header: "Matches",
        accessorKey: "matchesPlayed",
        cell: (ctx) => {
          const row = ctx.row.original;
          return `${row.matchesPlayed}/${row.matchesTotal}`;
        },
      },
      { header: "Champion", accessorKey: "champion" },
    ],
    [onOpenTournament],
  );
  const opponentRows = selectedOpponents.map((opponent) => ({
    opponent: opponent.opponentName,
    played: opponent.played,
    wins: opponent.wins,
    losses: opponent.losses,
    draws: opponent.draws,
    winRate: opponent.played ? (opponent.wins / opponent.played) * 100 : 0,
  }));
  const opponentColumns = useMemo<ColumnDef<(typeof opponentRows)[number]>[]>(
    () => [
      { header: "Opponent", accessorKey: "opponent" },
      { header: "P", accessorKey: "played" },
      { header: "W", accessorKey: "wins" },
      { header: "L", accessorKey: "losses" },
      { header: "D", accessorKey: "draws" },
      { header: "Win%", accessorKey: "winRate", cell: (ctx) => pct(ctx.getValue<number>()) },
    ],
    [],
  );

  return (
    <section className="panel">
      <div className="row">
        <h2>History & Stats</h2>
        <button
          className="danger"
          onClick={() => {
            if (
              window.confirm(
                "Clear all tournaments and participant history? This cannot be undone.",
              )
            ) {
              onClearAll();
            }
          }}
        >
          Clear All
        </button>
      </div>
      <div className="historySummary">
        <article className="miniCard">
          <strong>{tournaments.length}</strong>
          <small>Total tournaments</small>
        </article>
        <article className="miniCard">
          <strong>{completed}</strong>
          <small>Completed tournaments</small>
        </article>
        <article className="miniCard">
          <strong>
            {playedMatches}/{totalMatches}
          </strong>
          <small>Matches played</small>
        </article>
        <article className="miniCard">
          <strong>{participants.length}</strong>
          <small>Participants tracked</small>
        </article>
      </div>

      <h3>Player Career Stats</h3>
      {participants.length ? (
        <SortableTable data={participantRows} columns={participantColumns} />
      ) : (
        <p>No participant history yet.</p>
      )}
      <h3>Tournament History</h3>
      {tournaments.length ? (
        <SortableTable data={tournamentRows} columns={tournamentColumns} className="historyTable" />
      ) : (
        <p>No tournaments created yet.</p>
      )}
      {selectedParticipant && (
        <div
          className="modalOverlay"
          onClick={() => setSelectedParticipantKey(null)}
          role="presentation"
        >
          <section
            className="modalCard"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedParticipant.name} detailed stats`}
          >
            <div className="row modalHeader">
              <h3>{selectedParticipant.name} Detailed Stats</h3>
              <button
                className="danger"
                onClick={() => setSelectedParticipantKey(null)}
              >
                Close
              </button>
            </div>
            <div className="historySummary">
              <article className="miniCard">
                <strong>{selectedParticipant.played}</strong>
                <small>Matches played</small>
              </article>
              <article className="miniCard">
                <strong>{selectedParticipant.wins}</strong>
                <small>Wins</small>
              </article>
              <article className="miniCard">
                <strong>{selectedParticipant.losses}</strong>
                <small>Losses</small>
              </article>
              <article className="miniCard">
                <strong>{selectedParticipant.draws}</strong>
                <small>Draws</small>
              </article>
            </div>
            <h4>Head-to-head</h4>
            {selectedOpponents.length ? (
              <SortableTable data={opponentRows} columns={opponentColumns} />
            ) : (
              <p>No opponent history yet for this participant.</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
