import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { makeId } from "../utils/id";
function parseParticipants(raw) {
    return raw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
        const [nameRaw, ratingRaw] = line.split(",").map((v) => v.trim());
        const rating = Number.isFinite(Number(ratingRaw)) ? Number(ratingRaw) : 50;
        return { id: makeId("p"), name: nameRaw, rating };
    });
}
export function CreateTournamentForm({ onCreate }) {
    const [name, setName] = useState("");
    const [format, setFormat] = useState("KNOCKOUT");
    const [participantsRaw, setParticipantsRaw] = useState("");
    const [groupCount, setGroupCount] = useState(2);
    const [advancePerGroup, setAdvancePerGroup] = useState(2);
    const [rounds, setRounds] = useState(5);
    const [seed, setSeed] = useState("");
    const participants = useMemo(() => parseParticipants(participantsRaw), [participantsRaw]);
    return (_jsxs("section", { className: "panel", children: [_jsx("h2", { children: "Create Tournament" }), _jsxs("div", { className: "stack", children: [_jsxs("label", { children: ["Name", _jsx("input", { value: name, onChange: (e) => setName(e.target.value) })] }), _jsxs("label", { children: ["Format", _jsxs("select", { value: format, onChange: (e) => setFormat(e.target.value), children: [_jsx("option", { value: "KNOCKOUT", children: "Pure Knockout" }), _jsx("option", { value: "GROUP_KO", children: "Group + Knockout" }), _jsx("option", { value: "SWISS", children: "Swiss" })] })] }), format === "GROUP_KO" && (_jsxs(_Fragment, { children: [_jsxs("label", { children: ["Group Count", _jsx("input", { type: "number", min: 2, value: groupCount, onChange: (e) => setGroupCount(Number(e.target.value)) })] }), _jsxs("label", { children: ["Advance/Group", _jsx("input", { type: "number", min: 1, value: advancePerGroup, onChange: (e) => setAdvancePerGroup(Number(e.target.value)) })] })] })), format === "SWISS" && (_jsxs("label", { children: ["Swiss Rounds", _jsx("input", { type: "number", min: 1, value: rounds, onChange: (e) => setRounds(Number(e.target.value)) })] })), _jsxs("label", { children: ["Random Seed (optional)", _jsx("input", { type: "number", value: seed, onChange: (e) => setSeed(e.target.value), placeholder: "e.g. 42" })] }), _jsxs("label", { children: ["Participants (one per line: ", _jsx("code", { children: "name,rating" }), ")", _jsx("textarea", { rows: 8, value: participantsRaw, onChange: (e) => setParticipantsRaw(e.target.value) })] }), _jsx("button", { onClick: () => {
                            onCreate({
                                name,
                                format,
                                participants,
                                settings: {
                                    groupCount: format === "GROUP_KO" ? groupCount : undefined,
                                    advancePerGroup: format === "GROUP_KO" ? advancePerGroup : undefined,
                                    rounds: format === "SWISS" ? rounds : undefined,
                                    randomSeed: seed === "" ? undefined : Number(seed),
                                },
                            });
                            setName("");
                            setParticipantsRaw("");
                        }, disabled: participants.length < 2, children: "Create" })] })] }));
}
