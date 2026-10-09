import type { DayLedger, EconomyConfig, GameState, PresetId, TeamState, Temperature } from '../types';
import { DEFAULT_ECONOMY, menuPrice } from '../config/economy';
import { CONTENT_VERSION, EQUIPMENT, INGREDIENTS, MENUS, PRESETS, resultReady, resultTemperature } from '../content';

/** 팀 색 8개. 팔레트(크림·코코아·민트·코랄·버터)와 어울리게 정했다. */
export const TEAM_COLORS = ['#2FA98C', '#F2705A', '#E0A526', '#5B8DEF', '#B36BD6', '#5FA8A0', '#D96C8C', '#8C7B4F'];
export const TEAM_COLOR_NAMES: Record<string, string> = { '#2FA98C': '민트', '#F2705A': '코랄', '#E0A526': '버터', '#5B8DEF': '하늘', '#B36BD6': '라벤더', '#5FA8A0': '청록', '#D96C8C': '분홍', '#8C7B4F': '올리브' };

export function emptyLedger(day: number, cumulative = 0): DayLedger {
  return { day, sales: 0, tips: 0, weatherBonus: 0, takeoutBonus: 0, groupBonus: 0, ingredients: 0, electricity: 0, equipment: 0, aid: 0, waste: [], servedServings: 0, net: 0, cumulative };
}

export interface CreateGameOptions {
  seed: string;
  presetId: PresetId;
  daysTotal: number;
  config?: EconomyConfig;
  teams: { id: string; name: string; color: string; mascot: string }[];
}

export function createGame(opts: CreateGameOptions): GameState {
  const config = JSON.parse(JSON.stringify(opts.config ?? DEFAULT_ECONOMY)) as EconomyConfig;
  const teams: Record<string, TeamState> = {};
  for (const t of opts.teams) {
    teams[t.id] = {
      id: t.id, name: t.name, color: t.color, mascot: t.mascot,
      coins: config.startCoins, actionsLeft: 0, ready: false, operatorId: null,
      stock: {}, products: [], equipment: [], customers: [], groupDone: [],
      today: emptyLedger(0), receipts: [], attempts: {}, pins: [], served: [], netHistory: [],
    };
  }
  return {
    rulesVersion: 1, contentVersion: CONTENT_VERSION, seed: opts.seed, presetId: opts.presetId, daysTotal: opts.daysTotal, day: 0, phase: 'setup',
    config, nextId: 1, weather: [], groupOrders: [], teamOrder: opts.teams.map((t) => t.id), teams, log: [], results: null, settleCount: 0,
  };
}

/** 저장되는 카운터에서 ID 를 만든다. 휴면에서 깨어나도 겹치지 않는다. */
export function newId(state: GameState, prefix: string): string {
  const n = state.nextId++;
  return `${prefix}${n}`;
}

export function logEvent(state: GameState, teamId: string | null, type: string, text: string): void {
  state.log.push({ day: state.day, teamId, type, text });
  if (state.log.length > 600) state.log.splice(0, state.log.length - 600);
}

export function isLastDay(state: GameState): boolean {
  return state.day >= state.daysTotal;
}

export function presetOf(state: GameState) {
  return PRESETS[state.presetId];
}

/** 선택한 메뉴판의 메뉴에 쓰이는 재료만 진열한다 (메뉴에서 자동으로 뽑는다). */
export function shopIngredients(presetId: PresetId): string[] {
  const set = new Set<string>();
  for (const mid of PRESETS[presetId].menus) for (const ing of Object.keys(MENUS[mid]!.ingredients)) set.add(ing);
  return Object.keys(INGREDIENTS).filter((id) => set.has(id));
}

export function hasEquipment(team: TeamState, equipmentId: string | null): boolean {
  return !equipmentId || team.equipment.includes(equipmentId);
}

export function ingredientPrice(state: GameState, id: string): number {
  return state.config.ingredientPrices[id] ?? INGREDIENTS[id]?.price ?? 0;
}

export function equipmentPrice(state: GameState, id: string): number {
  return state.config.equipmentPrices[id] ?? EQUIPMENT[id]?.price ?? 0;
}

export function priceOf(state: GameState, menuId: string, result: string): number {
  return menuPrice(state.config, menuId, result);
}

export function orderTemperature(menuId: string, want: string): Temperature {
  return resultTemperature(menuId, want);
}

/** 완성되는 날 */
export function readyDayOf(state: GameState, menuId: string, result: string): number {
  return resultReady(menuId, result) === 'overnight' ? state.day + 1 : state.day;
}

/** 오늘 날씨 (1일 차 = index 0) */
export function weatherOn(state: GameState, day: number): import('../types').Weather {
  return state.weather[day - 1] ?? 'sunny';
}

export function cumulativeNet(team: TeamState): number {
  return team.receipts.length ? team.receipts[team.receipts.length - 1]!.cumulative : 0;
}
