import type { Participant, Standing } from "../types";

type Props = {
  participants: Participant[];
  standings: Record<string, Standing> | undefined;
};

export function StandingsTable({ participants, standings }: Props) {
  if (!standings) return null;
  const rows = [...participants].sort((a, b) => {
    const sa = standings[a.id];
    const sb = standings[b.id];
    if (!sa || !sb) return 0;
    if (sa.points !== sb.points) return sb.points - sa.points;
    return (sb.buchholz ?? 0) - (sa.buchholz ?? 0);
  });

  return (
    <section className="panel">
      <h3>Standings</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>P</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th>Pts</th>
            <th>Buchholz</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const s = standings[p.id];
            return (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{s.played}</td>
                <td>{s.wins}</td>
                <td>{s.draws}</td>
                <td>{s.losses}</td>
                <td>{s.points}</td>
                <td>{s.buchholz ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
