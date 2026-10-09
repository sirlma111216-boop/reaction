import type { EconomyConfig, FinalTeamResult, GameEvent, GroupOrder, PresetId, TeamCommand, TeamState, Weather } from './types';

/** 방(Room) 수준 명령. 팀 게임 명령은 `team` 으로 감싼다. */
export type RoomCommand =
  // 교사
  | { type: 'appointLeader'; playerId: string; on: boolean }
  | { type: 'movePlayer'; playerId: string; teamId: string | null }
  | { type: 'kickPlayer'; playerId: string }
  | { type: 'setTeamLeader'; teamId: string; playerId: string }
  | { type: 'disbandTeam'; teamId: string }
  | { type: 'lock'; on: boolean }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'setOperator'; teamId: string; playerId: string }
  | { type: 'skipTeam'; teamId: string }
  | { type: 'endGame' }
  | { type: 'teacherJoinTeam'; name: string; color: string; mascot: string }
  | { type: 'teacherLeaveTeam' }
  // 팀장
  | { type: 'createTeam'; name: string; color: string; mascot: string }
  | { type: 'ready'; on: boolean }
  | { type: 'reorderMembers'; order: string[] }
  // 학생
  | { type: 'joinTeam'; teamId: string }
  | { type: 'leaveTeam' }
  | { type: 'team'; cmd: TeamCommand };

export interface ClientMessage { type: 'cmd'; id: string; cmd: RoomCommand }
export type ClientEnvelope = ClientMessage | { type: 'ping' };

export type ServerMessage =
  | { type: 'view'; view: ClientView }
  | { type: 'ack'; id: string; ok: boolean; error?: string; stars?: number; paid?: number; result?: string }
  | { type: 'toast'; text: string; level: 'info' | 'warn' | 'success' }
  | { type: 'pong'; now: number }
  | { type: 'closed'; reason: string };

export type PlayerRole = 'teacher' | 'student' | 'spectator';

export interface PlayerPublic { id: string; nick: string; role: PlayerRole; teamId: string | null; isLeader: boolean; connected: boolean }

/** 공개하는 것: 팀 이름, 전날까지의 누적 순이익, 오늘 마감 여부 (+ 대기실 정보) */
export interface TeamPublic {
  id: string;
  name: string;
  color: string;
  mascot: string;
  leaderId: string | null;
  members: string[];
  ready: boolean;
  /** 경기 중: 오늘 영업 마감 */
  dayReady: boolean;
  /** 전날까지의 누적 순이익 */
  netUntilYesterday: number;
  netHistory: number[];
  operatorId: string | null;
  actionsLeft: number;
  connectedCount: number;
}

export interface GameView {
  day: number;
  daysTotal: number;
  phase: 'setup' | 'open' | 'finished';
  presetId: PresetId;
  weatherToday: Weather;
  weatherTomorrow: Weather | null;
  groupOrders: GroupOrder[];
  myTeam: TeamState | null;
  results: FinalTeamResult[] | null;
  log: GameEvent[];
  readyCount: number;
  teamCount: number;
  config: EconomyConfig;
  settleCount: number;
  contentVersion: string;
}

export interface ClientView {
  serverNow: number;
  me: { playerId: string; nick: string; role: PlayerRole; teamId: string | null; isLeader: boolean; isOperator: boolean };
  room: {
    code: string;
    status: 'lobby' | 'playing' | 'paused' | 'finished' | 'expired';
    locked: boolean;
    presetId: PresetId;
    days: number;
    teacherNick: string;
    teacherPlayerId: string;
    createdAt: number;
    expiresAt: number;
    joinUrl: string;
  };
  players: PlayerPublic[];
  teams: TeamPublic[];
  game: GameView | null;
  /** 교사 전용: 모든 팀의 전체 상태 */
  teacherTeams?: TeamState[];
  /** 교사 전용: 전체 날씨 일정 */
  teacherWeather?: Weather[];
}

export const NICK_MAX = 12;
export const TEAM_NAME_MAX = 12;

export function sanitizeName(raw: unknown, max: number): string {
  return String(raw ?? '')
    .replace(/[<>&"'`\\/]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
