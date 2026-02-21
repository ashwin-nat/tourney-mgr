import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function StandingsTable({ participants, standings }) {
    if (!standings)
        return null;
    const rows = [...participants].sort((a, b) => {
        const sa = standings[a.id];
        const sb = standings[b.id];
        if (!sa || !sb)
            return 0;
        if (sa.points !== sb.points)
            return sb.points - sa.points;
        return (sb.buchholz ?? 0) - (sa.buchholz ?? 0);
    });
    return (_jsxs("section", { className: "panel", children: [_jsx("h3", { children: "Standings" }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Name" }), _jsx("th", { children: "P" }), _jsx("th", { children: "W" }), _jsx("th", { children: "D" }), _jsx("th", { children: "L" }), _jsx("th", { children: "Pts" }), _jsx("th", { children: "Buchholz" })] }) }), _jsx("tbody", { children: rows.map((p) => {
                            const s = standings[p.id];
                            return (_jsxs("tr", { children: [_jsx("td", { children: p.name }), _jsx("td", { children: s.played }), _jsx("td", { children: s.wins }), _jsx("td", { children: s.draws }), _jsx("td", { children: s.losses }), _jsx("td", { children: s.points }), _jsx("td", { children: s.buchholz ?? 0 })] }, p.id));
                        }) })] })] }));
}
