import type { GameState, TeamState } from './types';
import type { GameView } from './protocol';
import { activeGroupOrders } from './engine/customers';

/** 특정 팀(또는 관전자)의 게임 투영. 다른 팀의 재료·보관함·손님은 넣지 않는다. 미래 날씨는 내일 예보까지만. */
export function projectGame(state: GameState, teamId: string | null): GameView {
  const myTeam = teamId ? state.teams[teamId] ?? null : null;
  return {
    day: state.day,
    daysTotal: state.daysTotal,
    phase: state.phase,
    presetId: state.presetId,
    weatherToday: state.weather[state.day - 1] ?? 'sunny',
    weatherTomorrow: state.day < state.daysTotal ? state.weather[state.day] ?? null : null,
    groupOrders: activeGroupOrders(state),
    myTeam: myTeam ? stripTeam(myTeam) : null,
    results: state.results,
    log: state.log.filter((e) => e.teamId === null || e.teamId === teamId).slice(-40),
    readyCount: state.teamOrder.filter((id) => state.teams[id]?.ready).length,
    teamCount: state.teamOrder.length,
    config: state.config,
    settleCount: state.settleCount,
    contentVersion: state.contentVersion,
  };
}

/** 팀 상태 그대로 (추천 표시는 최근 것만) */
export function stripTeam(t: TeamState): TeamState {
  return { ...t, pins: t.pins.slice(-12) };
}
