import { buildStandings, rankParticipants } from "../engine/standings";
import { BYE_ID } from "../types";
import { makeId } from "../utils/id";
function pairKey(a, b) {
    return [a, b].sort().join(":");
}
export function maybeGenerateSwissRound(tournament) {
    if (tournament.format !== "SWISS")
        return tournament;
    const maxRounds = tournament.settings.rounds ?? 5;
    const swissMatches = tournament.matches.filter((m) => m.stage === "SWISS");
    const lastRound = Math.max(0, ...swissMatches.map((m) => m.round));
    const hasUnplayed = swissMatches.some((m) => !m.played);
    if (hasUnplayed)
        return tournament;
    if (lastRound >= maxRounds) {
        return { ...tournament, status: "COMPLETED" };
    }
    const standings = buildStandings(tournament.participants, swissMatches);
    const ranked = rankParticipants(tournament.participants, standings);
    const alreadyPlayed = new Set();
    swissMatches.forEach((m) => {
        alreadyPlayed.add(pairKey(m.playerA, m.playerB));
    });
    const hadBye = new Set(swissMatches
        .filter((m) => m.playerA === BYE_ID || m.playerB === BYE_ID)
        .map((m) => (m.playerA === BYE_ID ? m.playerB : m.playerA)));
    const pool = [...ranked];
    const pairs = [];
    if (pool.length % 2 !== 0) {
        const byeIndex = [...pool]
            .reverse()
            .findIndex((p) => !hadBye.has(p.id));
        const resolvedIndex = byeIndex === -1 ? pool.length - 1 : pool.length - 1 - byeIndex;
        const bye = pool.splice(resolvedIndex, 1)[0];
        pairs.push([bye.id, BYE_ID]);
    }
    while (pool.length > 1) {
        const a = pool.shift();
        let idx = pool.findIndex((b) => !alreadyPlayed.has(pairKey(a.id, b.id)));
        if (idx === -1)
            idx = 0;
        const [b] = pool.splice(idx, 1);
        pairs.push([a.id, b.id]);
        alreadyPlayed.add(pairKey(a.id, b.id));
    }
    const newMatches = pairs.map(([playerA, playerB]) => ({
        id: makeId("match"),
        playerA,
        playerB,
        played: false,
        round: lastRound + 1,
        stage: "SWISS",
    }));
    return {
        ...tournament,
        matches: [...tournament.matches, ...newMatches],
        standings,
    };
}
