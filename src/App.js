import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CreateTournamentForm } from "./components/CreateTournamentForm";
import { TournamentDetail } from "./components/TournamentDetail";
import { TournamentList } from "./components/TournamentList";
import { useTournamentStore } from "./store/tournamentStore";
export default function App() {
    const { tournaments, currentTournamentId, createTournament, selectTournament, deleteTournament, generateFixtures, simulateMatch, simulateRound, simulateAll, resetTournament, updateParticipantRating, } = useTournamentStore();
    const current = tournaments.find((t) => t.id === currentTournamentId) ?? null;
    return (_jsxs("main", { className: "layout", children: [_jsxs("aside", { children: [_jsx(CreateTournamentForm, { onCreate: createTournament }), _jsx(TournamentList, { tournaments: tournaments, currentId: currentTournamentId, onSelect: selectTournament, onDelete: deleteTournament })] }), _jsx("section", { children: current ? (_jsx(TournamentDetail, { tournament: current, onGenerateFixtures: () => generateFixtures(current.id), onSimulateMatch: (matchId) => simulateMatch(current.id, matchId), onSimulateRound: (round) => simulateRound(current.id, round), onSimulateAll: () => simulateAll(current.id), onReset: () => resetTournament(current.id), onRatingChange: (participantId, rating) => updateParticipantRating(current.id, participantId, rating) })) : (_jsxs("section", { className: "panel", children: [_jsx("h2", { children: "No Tournament Selected" }), _jsx("p", { children: "Create and select a tournament to begin." })] })) })] }));
}
