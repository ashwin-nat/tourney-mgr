import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  MatchStage,
  ParticipantHistory,
  StatsTransferFile,
  Tournament,
  TournamentFormat,
} from "../types";
import {
  getTournamentChampionName,
  getTournamentChampionId,
  getTournamentRunnerUpId,
} from "../utils/champion";
import { SortableTable } from "./SortableTable";

type Props = {
  tournaments: Tournament[];
  participantHistory: Record<string, ParticipantHistory>;
  onOpenTournament: (id: string) => void;
  onClearAll: () => void;
  onExportStats: () => StatsTransferFile;
  onImportStats: (input: unknown) => { ok: true } | { ok: false; error: string };
};

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function winRate(wins: number, played: number): number {
  return played ? (wins / played) * 100 : 0;
}

type StageBucket = {
  played: number;
  wins: number;
  losses: number;
  draws: number;
};

type FormatStatsRow = {
  format: TournamentFormat;
  tournaments: number;
  completedTournaments: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  championships: number;
  runnerUps: number;
  finals: number;
  winRate: number;
  finalConversionRate: number;
  groupWinRate: number;
  knockoutWinRate: number;
  swissWinRate: number;
  leagueWinRate: number;
};

function emptyStageBucket(): StageBucket {
  return { played: 0, wins: 0, losses: 0, draws: 0 };
}

function stageLabel(stage: MatchStage): "group" | "knockout" | "swiss" | "league" {
  if (stage === "GROUP") return "group";
  if (stage === "KNOCKOUT") return "knockout";
  if (stage === "SWISS") return "swiss";
  return "league";
}

export function HistoryPage({
  tournaments,
  participantHistory,
  onOpenTournament,
  onClearAll,
  onExportStats,
  onImportStats,
}: Props) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string>("");
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
  const selectedByFormat = useMemo<FormatStatsRow[]>(() => {
    if (!selectedParticipant) return [];
    const participantKey = selectedParticipant.name.trim().toLowerCase();
    const byFormat = new Map<
      TournamentFormat,
      {
        format: TournamentFormat;
        tournaments: number;
        completedTournaments: number;
        played: number;
        wins: number;
        draws: number;
        losses: number;
        championships: number;
        runnerUps: number;
        finals: number;
        stageStats: Record<"group" | "knockout" | "swiss" | "league", StageBucket>;
      }
    >();

    for (const tournament of tournaments) {
      const selectedParticipantInTournament = tournament.participants.find(
        (participant) => participant.name.trim().toLowerCase() === participantKey,
      );
      if (!selectedParticipantInTournament) continue;

      const stats = byFormat.get(tournament.format) ?? {
        format: tournament.format,
        tournaments: 0,
        completedTournaments: 0,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        championships: 0,
        runnerUps: 0,
        finals: 0,
        stageStats: {
          group: emptyStageBucket(),
          knockout: emptyStageBucket(),
          swiss: emptyStageBucket(),
          league: emptyStageBucket(),
        },
      };

      stats.tournaments += 1;
      if (tournament.status === "COMPLETED") stats.completedTournaments += 1;

      for (const match of tournament.matches) {
        if (!match.played) continue;
        if (
          match.playerA !== selectedParticipantInTournament.id &&
          match.playerB !== selectedParticipantInTournament.id
        ) {
          continue;
        }

        const stage = stageLabel(match.stage);
        stats.played += 1;
        stats.stageStats[stage].played += 1;

        if (match.winner === undefined) {
          stats.draws += 1;
          stats.stageStats[stage].draws += 1;
        } else if (match.winner === selectedParticipantInTournament.id) {
          stats.wins += 1;
          stats.stageStats[stage].wins += 1;
        } else {
          stats.losses += 1;
          stats.stageStats[stage].losses += 1;
        }
      }

      if (tournament.status === "COMPLETED") {
        const championId = getTournamentChampionId(tournament);
        const runnerUpId = getTournamentRunnerUpId(tournament);
        if (championId === selectedParticipantInTournament.id) {
          stats.championships += 1;
          stats.finals += 1;
        }
        if (runnerUpId === selectedParticipantInTournament.id) {
          stats.runnerUps += 1;
          stats.finals += 1;
        }
      }

      byFormat.set(tournament.format, stats);
    }

    return [...byFormat.values()]
      .map((stats) => ({
        format: stats.format,
        tournaments: stats.tournaments,
        completedTournaments: stats.completedTournaments,
        played: stats.played,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        championships: stats.championships,
        runnerUps: stats.runnerUps,
        finals: stats.finals,
        winRate: winRate(stats.wins, stats.played),
        finalConversionRate: winRate(stats.championships, stats.finals),
        groupWinRate: winRate(stats.stageStats.group.wins, stats.stageStats.group.played),
        knockoutWinRate: winRate(
          stats.stageStats.knockout.wins,
          stats.stageStats.knockout.played,
        ),
        swissWinRate: winRate(stats.stageStats.swiss.wins, stats.stageStats.swiss.played),
        leagueWinRate: winRate(stats.stageStats.league.wins, stats.stageStats.league.played),
      }))
      .sort((a, b) => a.format.localeCompare(b.format));
  }, [selectedParticipant, tournaments]);

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
    return {
      key,
      player: entry.name,
      played: entry.played,
      wins: entry.wins,
      draws: entry.draws,
      losses: entry.losses,
      tournaments: entry.tournaments,
      completedTournaments: entry.completedTournaments,
      championships: entry.championships,
      runnerUps: entry.runnerUps,
      finals: entry.finals,
      finalConversionRate: winRate(entry.championships, entry.finals),
      winRate: winRate(entry.wins, entry.played),
      groupWinRate: winRate(entry.stageStats.group.wins, entry.stageStats.group.played),
      knockoutWinRate: winRate(
        entry.stageStats.knockout.wins,
        entry.stageStats.knockout.played,
      ),
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
      { header: "CT", accessorKey: "completedTournaments" },
      { header: "Titles", accessorKey: "championships" },
      { header: "RU", accessorKey: "runnerUps" },
      { header: "Finals", accessorKey: "finals" },
      {
        header: "Final Conv%",
        accessorKey: "finalConversionRate",
        cell: (ctx) => pct(ctx.getValue<number>()),
      },
      { header: "Win%", accessorKey: "winRate", cell: (ctx) => pct(ctx.getValue<number>()) },
      {
        header: "Group Win%",
        accessorKey: "groupWinRate",
        cell: (ctx) => pct(ctx.getValue<number>()),
      },
      {
        header: "KO Win%",
        accessorKey: "knockoutWinRate",
        cell: (ctx) => pct(ctx.getValue<number>()),
      },
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
  const formatColumns = useMemo<ColumnDef<FormatStatsRow>[]>(
    () => [
      { header: "Format", accessorKey: "format" },
      { header: "T", accessorKey: "tournaments" },
      { header: "CT", accessorKey: "completedTournaments" },
      { header: "P", accessorKey: "played" },
      { header: "W", accessorKey: "wins" },
      { header: "D", accessorKey: "draws" },
      { header: "L", accessorKey: "losses" },
      { header: "Titles", accessorKey: "championships" },
      { header: "RU", accessorKey: "runnerUps" },
      { header: "Finals", accessorKey: "finals" },
      {
        header: "Final Conv%",
        accessorKey: "finalConversionRate",
        cell: (ctx) => pct(ctx.getValue<number>()),
      },
      { header: "Win%", accessorKey: "winRate", cell: (ctx) => pct(ctx.getValue<number>()) },
      {
        header: "Group Win%",
        accessorKey: "groupWinRate",
        cell: (ctx) => pct(ctx.getValue<number>()),
      },
      {
        header: "KO Win%",
        accessorKey: "knockoutWinRate",
        cell: (ctx) => pct(ctx.getValue<number>()),
      },
      {
        header: "Swiss Win%",
        accessorKey: "swissWinRate",
        cell: (ctx) => pct(ctx.getValue<number>()),
      },
      {
        header: "League Win%",
        accessorKey: "leagueWinRate",
        cell: (ctx) => pct(ctx.getValue<number>()),
      },
    ],
    [],
  );

  const downloadStats = () => {
    const payload = onExportStats();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tourney-stats-${stamp}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const importStats = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const result = onImportStats(parsed);
      setImportMessage(result.ok ? "Stats imported." : result.error);
    } catch {
      setImportMessage("Failed to read the selected file.");
    }
  };

  return (
    <section className="panel">
      <div className="row">
        <h2>History & Stats</h2>
        <div className="row">
          <button onClick={downloadStats}>Export Stats</button>
          <button onClick={() => importInputRef.current?.click()}>Import Stats</button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                void importStats(file);
              }
              event.currentTarget.value = "";
            }}
          />
          <button
            className="danger"
            onClick={() => {
              if (
                window.confirm(
                  "Clear all tournaments and participant history? This cannot be undone.",
                )
              ) {
                onClearAll();
                setImportMessage("");
              }
            }}
          >
            Clear All
          </button>
        </div>
      </div>
      {importMessage && <p>{importMessage}</p>}
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
              <article className="miniCard">
                <strong>{selectedParticipant.championships}</strong>
                <small>Championships</small>
              </article>
              <article className="miniCard">
                <strong>{selectedParticipant.runnerUps}</strong>
                <small>Runner-ups</small>
              </article>
              <article className="miniCard">
                <strong>{selectedParticipant.finals}</strong>
                <small>Finals</small>
              </article>
              <article className="miniCard">
                <strong>{pct(winRate(selectedParticipant.championships, selectedParticipant.finals))}</strong>
                <small>Final Conversion</small>
              </article>
              <article className="miniCard">
                <strong>{pct(winRate(selectedParticipant.wins, selectedParticipant.played))}</strong>
                <small>Overall Win Rate</small>
              </article>
              <article className="miniCard">
                <strong>
                  {pct(
                    winRate(
                      selectedParticipant.stageStats.group.wins,
                      selectedParticipant.stageStats.group.played,
                    ),
                  )}
                </strong>
                <small>Group Stage Win Rate</small>
              </article>
              <article className="miniCard">
                <strong>
                  {pct(
                    winRate(
                      selectedParticipant.stageStats.knockout.wins,
                      selectedParticipant.stageStats.knockout.played,
                    ),
                  )}
                </strong>
                <small>Knockout Win Rate</small>
              </article>
              <article className="miniCard">
                <strong>
                  {pct(
                    winRate(
                      selectedParticipant.stageStats.swiss.wins,
                      selectedParticipant.stageStats.swiss.played,
                    ),
                  )}
                </strong>
                <small>Swiss Win Rate</small>
              </article>
              <article className="miniCard">
                <strong>
                  {pct(
                    winRate(
                      selectedParticipant.stageStats.league.wins,
                      selectedParticipant.stageStats.league.played,
                    ),
                  )}
                </strong>
                <small>League Win Rate</small>
              </article>
            </div>
            <h4>Head-to-head</h4>
            {selectedOpponents.length ? (
              <SortableTable data={opponentRows} columns={opponentColumns} />
            ) : (
              <p>No opponent history yet for this participant.</p>
            )}
            <h4>By Tournament Type</h4>
            {selectedByFormat.length ? (
              <SortableTable data={selectedByFormat} columns={formatColumns} />
            ) : (
              <p>No tournament-type breakdown available yet.</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
