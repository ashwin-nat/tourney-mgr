import { BYE_ID } from "../types";
import { createTournamentRng } from "../utils/rng";
const DEFAULT_DRAW_CHANCE = 0.05;
export function winProbability(ratingA, ratingB) {
    return 1 / (1 + 10 ** ((ratingB - ratingA) / 20));
}
function chooseScore(isDraw, aWon, rng) {
    if (isDraw) {
        return { scoreA: 1, scoreB: 1 };
    }
    const outcomes = aWon
        ? [
            [1, 0],
            [2, 1],
            [3, 1],
        ]
        : [
            [0, 1],
            [1, 2],
            [1, 3],
        ];
    const [scoreA, scoreB] = outcomes[Math.floor(rng() * outcomes.length)];
    return { scoreA, scoreB };
}
export function simulateMatchResult(tournament, match) {
    if (match.playerA === BYE_ID && match.playerB === BYE_ID) {
        return { played: true, winner: undefined, scoreA: 0, scoreB: 0 };
    }
    if (match.playerA === BYE_ID) {
        return { played: true, winner: match.playerB, scoreA: 0, scoreB: 1 };
    }
    if (match.playerB === BYE_ID) {
        return { played: true, winner: match.playerA, scoreA: 1, scoreB: 0 };
    }
    const map = new Map(tournament.participants.map((p) => [p.id, p]));
    const a = map.get(match.playerA);
    const b = map.get(match.playerB);
    if (!a || !b) {
        throw new Error("Cannot simulate match with unknown participants.");
    }
    const rng = createTournamentRng(tournament.settings.randomSeed, match.id);
    const drawChance = tournament.settings.allowDraws ? DEFAULT_DRAW_CHANCE : 0;
    const drawRoll = rng();
    if (drawRoll < drawChance) {
        const drawScore = chooseScore(true, false, rng);
        return { played: true, winner: undefined, ...drawScore };
    }
    const pA = winProbability(a.rating, b.rating);
    const aWon = rng() < pA;
    const score = chooseScore(false, aWon, rng);
    return { played: true, winner: aWon ? a.id : b.id, ...score };
}
