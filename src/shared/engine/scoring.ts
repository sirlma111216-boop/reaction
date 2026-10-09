import type { GameState, Order, Product, TeamState } from '../types';
import { MENUS, resultTemperature } from '../content';
import { weatherOn } from './state';

/** 3.3 별점: 원한 결과와 같으면 3, M07 한 단계 차이면 2, 그 밖(실패 포함)은 1 */
export function baseStars(menuId: string, want: string, result: string): number {
  if (want === result) return 3;
  if (menuId === 'M07') {
    const order = ['strong', 'medium', 'weak'];
    const a = order.indexOf(want);
    const b = order.indexOf(result);
    if (a >= 0 && b >= 0 && Math.abs(a - b) === 1) return 2;
  }
  return 1;
}

export function isFailResult(menuId: string, result: string): boolean {
  return !!MENUS[menuId]?.results[result]?.fail;
}

/** 보관함에서 같은 메뉴·결과·완성된 음식을 완성일 순으로 */
export function availableProducts(team: TeamState, day: number, menuId: string, result: string): Product[] {
  return team.products.filter((p) => p.menuId === menuId && p.result === result && p.readyDay <= day).sort((a, b) => a.readyDay - b.readyDay);
}

export function availableServings(team: TeamState, day: number, menuId: string, result: string): number {
  return availableProducts(team, day, menuId, result).reduce((a, p) => a + p.servings, 0);
}

export interface ServeQuote {
  stars: number;
  /** 어제 만든 음식이 들어가 별점이 줄었는지 */
  stale: boolean;
  base: number;
  tip: number;
  weatherBonus: number;
  takeoutBonus: number;
  total: number;
}

/** 손님 주문에 어떤 결과를 내면 받을 별점과 대금 (화면 미리 보기와 서버가 같은 함수를 쓴다) */
export function quoteServe(state: GameState, team: TeamState, order: Order, result: string): ServeQuote | null {
  const products = availableProducts(team, state.day, order.menuId, result);
  let need = order.servings;
  let stale = false;
  for (const p of products) {
    if (need <= 0) break;
    if (p.readyDay < state.day) stale = true;
    need -= p.servings;
  }
  if (need > 0) return null;
  let stars = baseStars(order.menuId, order.want, result);
  if (stale) stars = Math.max(1, stars - 1);
  return finishQuote(state, order, stars, stale);
}

function finishQuote(state: GameState, order: Order, stars: number, stale = false): ServeQuote {
  const cfg = state.config;
  const gross = order.price * order.servings;
  const base = stars === 1 ? Math.floor(gross / 2) : gross;
  const tip = stars === 3 ? cfg.tipPerServing * order.servings : 0;
  const weather = weatherOn(state, state.day);
  const temp = resultTemperature(order.menuId, order.want);
  const weatherMatch = (weather === 'hot' && temp === 'cold') || (weather === 'cold' && temp === 'warm');
  const weatherBonus = stars >= 2 && weatherMatch ? cfg.weatherBonusPerServing * order.servings : 0;
  const takeoutBonus = stars >= 2 && order.takeout ? cfg.takeoutBonus : 0;
  return { stars, stale, base, tip, weatherBonus, takeoutBonus, total: base + tip + weatherBonus + takeoutBonus };
}

/** 주문의 최대 대금 (별 3개, 날씨·포장 보너스 포함) — 봇과 화면의 기대 수익 계산용 */
export function maxQuote(state: GameState, order: Order): ServeQuote {
  return finishQuote(state, order, 3);
}

export interface GroupQuote { stars: number; stale: boolean; base: number; tip: number; bonus: number; total: number }

/** 단체 주문 대금: 인분당 가격 × 4. 별 3개면 팁 4 + 보너스 6, 별 2개면 보너스 6, 별 1개면 절반. 날씨 보너스 없음 */
export function quoteGroup(state: GameState, team: TeamState, menuId: string, want: string, servings: number, price: number, result: string): GroupQuote | null {
  const products = availableProducts(team, state.day, menuId, result);
  let need = servings;
  let stale = false;
  for (const p of products) {
    if (need <= 0) break;
    if (p.readyDay < state.day) stale = true;
    need -= p.servings;
  }
  if (need > 0) return null;
  let stars = baseStars(menuId, want, result);
  if (stale) stars = Math.max(1, stars - 1);
  const gross = price * servings;
  const base = stars === 1 ? Math.floor(gross / 2) : gross;
  const tip = stars === 3 ? state.config.tipPerServing * servings : 0;
  const bonus = stars >= 2 ? state.config.groupBonus : 0;
  return { stars, stale, base, tip, bonus, total: base + tip + bonus };
}
