import type { CommandResult, GameState, Order, TeamCommand, TeamState } from '../../shared/types';
import { EQUIPMENT, MENUS, PRESETS, choiceFor, choiceUses, resultReady, wantableResults, type Choice } from '../../shared/content';
import { activeGroupOrders } from '../../shared/engine/customers';
import { availableServings, maxQuote, quoteGroup, quoteServe } from '../../shared/engine/scoring';
import { equipmentPrice, hasEquipment, ingredientPrice } from '../../shared/engine/state';

/**
 * 봇 공용 도우미. 봇은 자기 팀의 상태, 오늘 날씨, 공개된 단체 주문만 본다.
 * 다른 팀의 비공개 정보나 미래의 손님은 보지 않는다.
 */
export type Exec = (cmd: TeamCommand) => CommandResult;

/** 팀이 지금 만들어 달라고 요구받는 것 (손님 주문 + 단체 주문) */
export interface Demand {
  kind: 'order' | 'group';
  id: string;
  menuId: string;
  want: string;
  servings: number;
  /** 별 3개로 냈을 때 받는 대금 */
  value: number;
  /** 이 날 마감 때까지 내야 한다 */
  dueDay: number;
  order?: Order;
}

export function demands(state: GameState, team: TeamState): Demand[] {
  const out: Demand[] = team.customers.map((o) => ({ kind: 'order', id: o.id, menuId: o.menuId, want: o.want, servings: o.servings, value: maxQuote(state, o).total, dueDay: o.leaveDay, order: o }));
  for (const g of activeGroupOrders(state)) {
    if (team.groupDone.includes(g.id)) continue;
    out.push({ kind: 'group', id: g.id, menuId: g.menuId, want: g.want, servings: g.servings, value: g.price * g.servings + state.config.tipPerServing * g.servings + state.config.groupBonus, dueDay: g.dueDay });
  }
  return out;
}

/** 보관함에 있는 음식으로 낼 수 있는 주문을 모두 낸다 (가장 많이 받는 결과로). 행동을 쓰지 않는다. */
export function serveWhatYouCan(state: GameState, team: TeamState, exec: Exec): number {
  let served = 0;
  let guard = 0;
  while (guard++ < 20) {
    let best: { cmd: TeamCommand; total: number } | null = null;
    const results = (menuId: string) => Object.keys(MENUS[menuId]?.results ?? {});
    for (const o of [...team.customers].sort((a, b) => b.price * b.servings - a.price * a.servings)) {
      for (const r of results(o.menuId)) {
        const q = quoteServe(state, team, o, r);
        if (q && q.total > 0 && (!best || q.total > best.total)) best = { cmd: { type: 'serve', orderId: o.id, result: r }, total: q.total };
      }
    }
    for (const g of activeGroupOrders(state)) {
      if (team.groupDone.includes(g.id)) continue;
      for (const r of results(g.menuId)) {
        const q = quoteGroup(state, team, g.menuId, g.want, g.servings, g.price, r);
        if (q && q.total > 0 && (!best || q.total > best.total)) best = { cmd: { type: 'serveGroup', groupOrderId: g.id, result: r }, total: q.total };
      }
    }
    if (!best) break;
    if (!exec(best.cmd).ok) break;
    served++;
  }
  return served;
}

export interface Plan {
  demand: Demand;
  choice: Choice;
  makes: number;
  missing: Record<string, number>;
  buyCost: number;
  electricity: number;
  actions: number;
  profit: number;
  feasible: boolean;
  reason?: string;
}

/** 어떤 주문을 어떤 조건으로 만들어 낼 때의 계획과 이익 */
export function planDemand(state: GameState, team: TeamState, d: Demand, choice: Choice): Plan {
  const m = MENUS[d.menuId]!;
  const have = availableServings(team, state.day, d.menuId, choice.result);
  const need = Math.max(0, d.servings - have);
  const makes = Math.ceil(need / state.config.servingsPerMake);
  const uses = choiceUses(d.menuId, choice.id);
  const missing: Record<string, number> = {};
  let buyCost = 0;
  for (const [id, units] of Object.entries(uses)) {
    const lack = units * makes - (team.stock[id] ?? 0);
    if (lack > 0) { missing[id] = lack; buyCost += lack * ingredientPrice(state, id); }
  }
  const elecEach = choice.electricity ?? state.config.electricity[d.menuId] ?? m.electricity;
  const electricity = elecEach * makes;
  const buys = Object.keys(missing).length ? Math.max(1, Math.ceil(Object.keys(missing).length / state.config.buyMaxKinds), Math.ceil(Object.values(missing).reduce((a, b) => a + b, 0) / state.config.buyMaxUnits)) : 0;
  const actions = buys + makes;
  const profit = d.value - buyCost - electricity;
  const plan: Plan = { demand: d, choice, makes, missing, buyCost, electricity, actions, profit, feasible: true };
  if (!hasEquipment(team, m.equipment)) return { ...plan, feasible: false, reason: 'equipment' };
  if (resultReady(d.menuId, choice.result) === 'overnight') {
    if (state.day >= state.daysTotal) return { ...plan, feasible: false, reason: 'lastDay' };
    if (state.day + 1 > d.dueDay) return { ...plan, feasible: false, reason: 'due' };
  }
  if (actions > team.actionsLeft) return { ...plan, feasible: false, reason: 'actions' };
  if (buyCost + electricity > team.coins) return { ...plan, feasible: false, reason: 'coins' };
  return plan;
}

/** 원하는 결과를 만드는 선택지 */
export function correctChoice(menuId: string, want: string): Choice | null {
  return choiceFor(menuId, want);
}

/** 장보기 명령을 4종류·6개 한도에 맞춰 나눈다 */
export function splitBuys(state: GameState, missing: Record<string, number>): { ingredientId: string; units: number }[][] {
  const out: { ingredientId: string; units: number }[][] = [];
  let cur: { ingredientId: string; units: number }[] = [];
  let units = 0;
  for (const [id, n] of Object.entries(missing)) {
    let left = n;
    while (left > 0) {
      const room = state.config.buyMaxUnits - units;
      if (room <= 0 || cur.length >= state.config.buyMaxKinds) { out.push(cur); cur = []; units = 0; continue; }
      const take = Math.min(left, room);
      cur.push({ ingredientId: id, units: take });
      units += take; left -= take;
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

export interface Combo { plans: Plan[]; missing: Record<string, number>; buyCost: number; electricity: number; actions: number; profit: number; feasible: boolean }

/** 계획 여러 개를 한 번의 장보기로 묶는다 (장보기 1 + 만들기 n). 재고는 한 번만 센다. */
export function combinePlans(state: GameState, team: TeamState, plans: Plan[]): Combo {
  const total: Record<string, number> = {};
  for (const p of plans) for (const [id, units] of Object.entries(choiceUses(p.demand.menuId, p.choice.id))) total[id] = (total[id] ?? 0) + units * p.makes;
  const missing: Record<string, number> = {};
  let buyCost = 0;
  for (const [id, units] of Object.entries(total)) {
    const lack = units - (team.stock[id] ?? 0);
    if (lack > 0) { missing[id] = lack; buyCost += lack * ingredientPrice(state, id); }
  }
  const buys = splitBuys(state, missing).length;
  const makes = plans.reduce((a, p) => a + p.makes, 0);
  const electricity = plans.reduce((a, p) => a + p.electricity, 0);
  const actions = buys + makes;
  const profit = plans.reduce((a, p) => a + p.demand.value, 0) - buyCost - electricity;
  const feasible = actions <= team.actionsLeft && buyCost + electricity <= team.coins && new Set(plans.map((p) => p.demand.id)).size === plans.length;
  return { plans, missing, buyCost, electricity, actions, profit, feasible };
}

/** 묶음 계획을 실행한다: 장보기 → 만들기 → 내기 (만들 때마다 낼 수 있는 것을 낸다) */
export function executeCombo(state: GameState, team: TeamState, combo: Combo, exec: Exec): boolean {
  for (const items of splitBuys(state, combo.missing)) if (!exec({ type: 'buy', items }).ok) return false;
  for (const p of combo.plans) {
    for (let i = 0; i < p.makes; i++) if (!exec({ type: 'make', menuId: p.demand.menuId, choice: p.choice.id }).ok) return false;
    serveWhatYouCan(state, team, exec);
  }
  return true;
}

/** 계획을 실행한다: 장보기 → 만들기 → 내기 */
export function executePlan(state: GameState, team: TeamState, plan: Plan, exec: Exec): boolean {
  return executeCombo(state, team, combinePlans(state, team, [plan]), exec);
}

/** 메뉴판에서 살 수 있는 장비 중 아직 없는 것, 만들 수 있는 메뉴의 가격 순 */
export function equipmentCandidates(state: GameState, team: TeamState): { id: string; price: number; bestMenuPrice: number }[] {
  const preset = PRESETS[state.presetId];
  return preset.equipment
    .filter((id) => !team.equipment.includes(id))
    .map((id) => {
      const eq = EQUIPMENT[id]!;
      const bestMenuPrice = Math.max(0, ...eq.enables.filter((m) => preset.menus.includes(m)).map((m) => state.config.menuPrices[m] ?? MENUS[m]!.price));
      return { id, price: equipmentPrice(state, id), bestMenuPrice: id === 'packaging' ? state.config.takeoutBonus + 4 : bestMenuPrice };
    })
    .sort((a, b) => b.bestMenuPrice - a.bestMenuPrice);
}

/** 봇의 선택지 목록 (무작위 봇·학습 봇용) */
export function allChoices(menuId: string): Choice[] {
  return MENUS[menuId]?.choices ?? [];
}

export function presetMenus(state: GameState): string[] {
  return PRESETS[state.presetId].menus;
}

export function noEquipmentMenus(state: GameState): string[] {
  return presetMenus(state).filter((m) => !MENUS[m]!.equipment);
}

export { wantableResults };
