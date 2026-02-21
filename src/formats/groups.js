import { buildStandings, rankParticipants } from "../engine/standings";
import { makeId } from "../utils/id";
import { createTournamentRng } from "../utils/rng";
import { generateKnockoutRoundOne } from "./knockout";
function shuffleWithSeed(items, seed, label) {
    const rng = createTournamentRng(seed, label);
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
export function createBalancedGroups(participants, groupCount, randomSeed) {
    const groups = Array.from({ length: groupCount }).map((_, i) => ({
        id: String.fromCharCode(65 + i),
        participantIds: [],
    }));
    const shuffled = shuffleWithSeed(participants, randomSeed, "groups_seed");
    shuffled.forEach((p, index) => {
        groups[index % groupCount].participantIds.push(p.id);
    });
    return groups;
}
function roundRobinPairings(ids) {
    if (ids.length < 2)
        return [];
    const normalized = [...ids];
    const hasBye = normalized.length % 2 !== 0;
    if (hasBye)
        normalized.push("__ghost__");
    const rounds = [];
    const n = normalized.length;
    const slots = [...normalized];
    for (let round = 0; round < n - 1; round += 1) {
        const pairs = [];
        for (let i = 0; i < n / 2; i += 1) {
            const a = slots[i];
            const b = slots[n - 1 - i];
            if (a !== "__ghost__" && b !== "__ghost__") {
                pairs.push([a, b]);
            }
        }
        rounds.push(pairs);
        const fixed = slots[0];
        const rest = slots.slice(1);
        rest.unshift(rest.pop());
        slots.splice(0, n, fixed, ...rest);
    }
    return rounds;
}
export function generateGroupStageMatches(groups) {
    const matches = [];
    groups.forEach((group) => {
        const rounds = roundRobinPairings(group.participantIds);
        rounds.forEach((roundPairs, idx) => {
            roundPairs.forEach(([playerA, playerB]) => {
                matches.push({
                    id: makeId("match"),
                    playerA,
                    playerB,
                    played: false,
                    round: idx + 1,
                    stage: "GROUP",
                    groupId: group.id,
                });
            });
        });
    });
    return matches;
}
function applyHeadToHeadTieBreak(ordered, groupMatches) {
    if (ordered.length < 2)
        return ordered;
    const a = ordered[0];
    const b = ordered[1];
    const h2h = groupMatches.find((m) => m.played &&
        ((m.playerA === a.id && m.playerB === b.id) ||
            (m.playerA === b.id && m.playerB === a.id)));
    if (!h2h?.winner)
        return ordered;
    if (h2h.winner === a.id)
        return ordered;
    return [b, a, ...ordered.slice(2)];
}
export function maybeStartKnockoutAfterGroups(tournament) {
    if (tournament.format !== "GROUP_KO")
        return tournament;
    const groupMatches = tournament.matches.filter((m) => m.stage === "GROUP");
    const knockoutAlready = tournament.matches.some((m) => m.stage === "KNOCKOUT");
    if (groupMatches.length === 0 || groupMatches.some((m) => !m.played) || knockoutAlready) {
        return tournament;
    }
    const advancePerGroup = tournament.settings.advancePerGroup ?? 2;
    const groups = tournament.groups ?? [];
    const byId = new Map(tournament.participants.map((p) => [p.id, p]));
    const qualifiers = [];
    for (const group of groups) {
        const groupParticipants = group.participantIds
            .map((id) => byId.get(id))
            .filter((p) => Boolean(p));
        const standing = buildStandings(groupParticipants, groupMatches.filter((m) => m.groupId === group.id));
        const ranked = applyHeadToHeadTieBreak(rankParticipants(groupParticipants, standing), groupMatches.filter((m) => m.groupId === group.id));
        qualifiers.push(...ranked.slice(0, advancePerGroup));
    }
    const koMatches = generateKnockoutRoundOne(qualifiers, tournament.settings.randomSeed).map((m) => ({ ...m, round: (Math.max(...groupMatches.map((gm) => gm.round), 0) || 0) + 1 }));
    return {
        ...tournament,
        matches: [...tournament.matches, ...koMatches],
    };
}
