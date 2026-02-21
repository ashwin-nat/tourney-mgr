import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function TournamentList({ tournaments, currentId, onSelect, onDelete, }) {
    return (_jsxs("section", { className: "panel", children: [_jsx("h2", { children: "Tournaments" }), _jsx("div", { className: "stack", children: tournaments.map((t) => (_jsxs("div", { className: `card ${currentId === t.id ? "active" : ""}`, onClick: () => onSelect(t.id), children: [_jsxs("div", { children: [_jsx("strong", { children: t.name }), _jsx("p", { children: t.format }), _jsx("p", { children: t.status })] }), _jsx("button", { className: "danger", onClick: (e) => {
                                e.stopPropagation();
                                onDelete(t.id);
                            }, children: "Delete" })] }, t.id))) })] }));
}
