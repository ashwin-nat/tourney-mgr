import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BracketView } from "./BracketView";
import { StandingsTable } from "./StandingsTable";
function participantName(t, id) {
    if (id === "BYE")
        return "BYE";
    return t.participants.find((p) => p.id === id)?.name ?? "Unknown";
}
export function TournamentDetail({ tournament, onGenerateFixtures, onSimulateMatch, onSimulateRound, onSimulateAll, onReset, onRatingChange, }) {
    const rounds = [...new Set(tournament.matches.map((m) => m.round))].sort((a, b) => a - b);
    const nextRound = tournament.matches.find((m) => !m.played)?.round;
    return (_jsxs("section", { className: "panel", children: [_jsx("h2", { children: tournament.name }), _jsxs("p", { children: [tournament.format, " | ", tournament.status] }), _jsxs("div", { className: "row", children: [_jsx("button", { onClick: onGenerateFixtures, children: "Generate Fixtures" }), _jsx("button", { onClick: onSimulateAll, disabled: !tournament.matches.length, children: "Simulate All" }), _jsx("button", { onClick: () => nextRound && onSimulateRound(nextRound), disabled: !nextRound, children: "Simulate Next Round" }), _jsx("button", { className: "danger", onClick: onReset, children: "Reset" })] }), _jsx("h3", { children: "Participants" }), _jsx("div", { className: "grid", children: tournament.participants.map((p) => (_jsxs("label", { className: "miniCard", children: [p.name, _jsx("input", { type: "number", min: 0, max: 100, value: p.rating, onChange: (e) => onRatingChange(p.id, Number(e.target.value)) })] }, p.id))) }), _jsx("h3", { children: "Matches" }), rounds.map((round) => (_jsxs("div", { className: "panel sub", children: [_jsxs("h4", { children: ["Round ", round] }), tournament.matches
                        .filter((m) => m.round === round)
                        .map((m) => (_jsxs("div", { className: "matchRow", children: [_jsxs("span", { children: ["[", m.stage, "] ", participantName(tournament, m.playerA), " vs", " ", participantName(tournament, m.playerB), m.groupId ? ` (Group ${m.groupId})` : ""] }), _jsx("span", { children: m.played
                                    ? `${m.scoreA ?? 0}-${m.scoreB ?? 0} | winner: ${m.winner ? participantName(tournament, m.winner) : "draw"}`
                                    : "pending" }), !m.played && (_jsx("button", { onClick: () => onSimulateMatch(m.id), children: "Simulate Match" }))] }, m.id)))] }, round))), _jsx(StandingsTable, { participants: tournament.participants, standings: tournament.standings }), _jsx(BracketView, { participants: tournament.participants, matches: tournament.matches })] }));
}
