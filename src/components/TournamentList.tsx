import { useEffect, useState } from "react";
import type { Tournament } from "../types";

const PAGE_SIZE = 10;

type Props = {
  tournaments: Tournament[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

export function TournamentList({
  tournaments,
  currentId,
  onSelect,
  onDelete,
}: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(tournaments.length / PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  const slice = tournaments.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <section className="panel">
      <h2>Tournaments</h2>
      <div className="stack">
        {slice.map((t) => (
          <div
            key={t.id}
            className={`card ${currentId === t.id ? "active" : ""}`}
            onClick={() => onSelect(t.id)}
          >
            <div>
              <strong>{t.name}</strong>
              <p>{t.format}</p>
              <p>{t.status}</p>
            </div>
            <button
              className="danger"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(t.id);
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 10,
            gap: 8,
          }}
        >
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
            style={{ padding: "4px 10px", minWidth: 0 }}
          >
            &lsaquo;
          </button>
          <span style={{ fontSize: "0.82rem", color: "#9fbce4" }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
            style={{ padding: "4px 10px", minWidth: 0 }}
          >
            &rsaquo;
          </button>
        </div>
      )}
    </section>
  );
}
