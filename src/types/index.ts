export const BYE_ID = "BYE";
export const SCHEMA_VERSION = 1;

export type TournamentFormat = "GROUP_KO" | "KNOCKOUT" | "SWISS" | "LEAGUE";
export type TournamentStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type MatchStage = "GROUP" | "KNOCKOUT" | "SWISS" | "LEAGUE";

export type Participant = {
  id: string;
  name: string;
  rating: number;
};

export type ParticipantHistory = {
  name: string;
  wins: number;
  losses: number;
  draws: number;
  played: number;
  tournaments: number;
  completedTournaments: number;
  championships: number;
  runnerUps: number;
  finals: number;
  stageStats: ParticipantStageStats;
  opponents: Record<string, HeadToHeadHistory>;
};

export type StagePerformance = {
  played: number;
  wins: number;
  losses: number;
  draws: number;
};

export type ParticipantStageStats = {
  group: StagePerformance;
  knockout: StagePerformance;
  swiss: StagePerformance;
  league: StagePerformance;
};

export type HeadToHeadHistory = {
  opponentName: string;
  wins: number;
  losses: number;
  draws: number;
  played: number;
};

export type Standing = {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  buchholz?: number;
};

export type Match = {
  id: string;
  playerA: string;
  playerB: string;
  winner?: string;
  played: boolean;
  round: number;
  stage: MatchStage;
  groupId?: string;
};

export type Group = {
  id: string;
  participantIds: string[];
};

export type TournamentSettings = {
  groupCount?: number;
  advancePerGroup?: number;
  rounds?: number;
  randomSeed?: number;
  allowDraws?: boolean;
  faceOpponentsTwice?: boolean;
};

export type Tournament = {
  id: string;
  name: string;
  format: TournamentFormat;
  participants: Participant[];
  matches: Match[];
  standings?: Record<string, Standing>;
  settings: TournamentSettings;
  status: TournamentStatus;
  groups?: Group[];
  schemaVersion: number;
};

export type NewTournamentInput = {
  name: string;
  format: TournamentFormat;
  participants: Participant[];
  settings: TournamentSettings;
};

export type StatsTransferFile = {
  schemaVersion: number;
  exportedAt: string;
  tournaments: Tournament[];
  participantHistory: Record<string, ParticipantHistory>;
  currentTournamentId: string | null;
};
