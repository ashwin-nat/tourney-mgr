import type { Match, Participant } from "../types";

type Props = {
  participants: Participant[];
  matches: Match[];
};

function participantName(participants: Participant[], id: string): string {
  if (id === "BYE") return "BYE";
  return participants.find((p) => p.id === id)?.name ?? "Unknown";
}

export function BracketView({ participants, matches }: Props) {
  const ko = matches.filter((m) => m.stage === "KNOCKOUT");
  if (!ko.length) return null;
  const rounds = [...new Set(ko.map((m) => m.round))].sort((a, b) => a - b);
  return (
    <section className="panel">
      <h3>Bracket</h3>
      <div className="bracket">
        {rounds.map((round) => (
          <div key={round} className="roundCol">
            <h4>Round {round}</h4>
            {ko
              .filter((m) => m.round === round)
              .map((m) => (
                <div key={m.id} className="miniCard">
                  <div>{participantName(participants, m.playerA)}</div>
                  <div>{participantName(participants, m.playerB)}</div>
                  <small>
                    {m.played
                      ? `${m.scoreA ?? 0}-${m.scoreB ?? 0}`
                      : "not played"}
                  </small>
                </div>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
