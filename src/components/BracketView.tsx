import type { Match, Participant, TournamentFormat } from "../types";

type Props = {
  format: TournamentFormat;
  participants: Participant[];
  matches: Match[];
  onSimulateMatch: (matchId: string) => void;
};

function participantName(participants: Participant[], id: string): string {
  if (id === "BYE") return "BYE";
  return participants.find((p) => p.id === id)?.name ?? "Unknown";
}

function stageLabel(stage: Match["stage"]): string {
  if (stage === "GROUP") return "Group";
  if (stage === "SWISS") return "Swiss";
  return "Knockout";
}

function outcomeFor(match: Match, participantId: string): "win" | "loss" | "draw" | "pending" {
  if (!match.played) return "pending";
  if (!match.winner) return "draw";
  return match.winner === participantId ? "win" : "loss";
}

export function BracketView({ format, participants, matches, onSimulateMatch }: Props) {
  if (!matches.length) return null;
  const stages: Match["stage"][] = ["GROUP", "SWISS", "KNOCKOUT"];
  const stageGroups = stages
    .map((stage) => ({
      stage,
      rounds: [...new Set(matches.filter((m) => m.stage === stage).map((m) => m.round))].sort(
        (a, b) => a - b,
      ),
    }))
    .filter((group) => group.rounds.length > 0);

  return (
    <section className="panel">
      <h3>{format === "KNOCKOUT" ? "Bracket" : "Rounds"}</h3>
      <div className="bracket">
        {stageGroups.map((group) =>
          group.rounds.map((round) => (
            <div key={`${group.stage}-${round}`} className="roundCol">
              <h4>
                {stageLabel(group.stage)} R{round}
              </h4>
              {matches
                .filter((m) => m.stage === group.stage && m.round === round)
                .map((m) => (
                  <div key={m.id} className="miniCard">
                    <div className="nameRow">
                      <span>{participantName(participants, m.playerA)}</span>
                      {outcomeFor(m, m.playerA) === "win" && (
                        <span className="resultMark win">✔</span>
                      )}
                      {outcomeFor(m, m.playerA) === "loss" && (
                        <span className="resultMark loss">✖</span>
                      )}
                    </div>
                    <div className="nameRow">
                      <span>{participantName(participants, m.playerB)}</span>
                      {outcomeFor(m, m.playerB) === "win" && (
                        <span className="resultMark win">✔</span>
                      )}
                      {outcomeFor(m, m.playerB) === "loss" && (
                        <span className="resultMark loss">✖</span>
                      )}
                    </div>
                    {m.groupId && <small>Group {m.groupId}</small>}
                    {!m.played && <small>Pending</small>}
                    {m.played && !m.winner && <small>Draw</small>}
                    {!m.played && (
                      <button onClick={() => onSimulateMatch(m.id)}>Simulate</button>
                    )}
                  </div>
                ))}
            </div>
          )),
        )}
      </div>
    </section>
  );
}
