import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function participantName(participants, id) {
    if (id === "BYE")
        return "BYE";
    return participants.find((p) => p.id === id)?.name ?? "Unknown";
}
export function BracketView({ participants, matches }) {
    const ko = matches.filter((m) => m.stage === "KNOCKOUT");
    if (!ko.length)
        return null;
    const rounds = [...new Set(ko.map((m) => m.round))].sort((a, b) => a - b);
    return (_jsxs("section", { className: "panel", children: [_jsx("h3", { children: "Bracket" }), _jsx("div", { className: "bracket", children: rounds.map((round) => (_jsxs("div", { className: "roundCol", children: [_jsxs("h4", { children: ["Round ", round] }), ko
                            .filter((m) => m.round === round)
                            .map((m) => (_jsxs("div", { className: "miniCard", children: [_jsx("div", { children: participantName(participants, m.playerA) }), _jsx("div", { children: participantName(participants, m.playerB) }), _jsx("small", { children: m.played
                                        ? `${m.scoreA ?? 0}-${m.scoreB ?? 0}`
                                        : "not played" })] }, m.id)))] }, round))) })] }));
}
