import type { Tournament } from "../types";

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
  return (
    <section className="panel">
      <h2>Tournaments</h2>
      <div className="stack">
        {tournaments.map((t) => (
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
    </section>
  );
}
