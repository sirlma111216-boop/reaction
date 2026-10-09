import type { GameState, GroupOrder, Order, TeamState, Weather } from '../types';
import { subRng, type Rng } from './rng';
import { CUSTOMER_CHARACTERS, MENUS, PRESETS, TAKEOUT_CUSTOMER, resultReady, resultTemperature, wantableResults } from '../content';
import { hasEquipment, logEvent, newId, priceOf } from './state';

/**
 * 5절 손님·날씨·단체 주문. 모든 추첨은 (시드, 날짜, 팀)으로 결정한다.
 * 벽시계 시간이나 Math.random 은 쓰지 않는다.
 */

/** 5.2 전체 일정의 날씨를 한 번에 정한다. 1일 차는 맑음, 같은 날씨가 3일 연속 나오지 않는다. */
export function generateWeather(seed: string, days: number): Weather[] {
  const rng = subRng(seed, 'weather');
  const out: Weather[] = ['sunny'];
  for (let d = 1; d < days; d++) {
    const prev1 = out[d - 1];
    const prev2 = out[d - 2];
    let w: Weather;
    let guard = 0;
    do {
      const r = rng.next();
      w = r < 0.5 ? 'sunny' : r < 0.75 ? 'hot' : 'cold';
    } while (prev1 === w && prev2 === w && guard++ < 20);
    out.push(w);
  }
  return out;
}

interface Pair { menuId: string; want: string }

/** 날짜 제약에 맞는 (메뉴, 결과) 후보 */
function candidatePairs(state: GameState, opts: { noEquipmentOnly: boolean; lastDay: boolean }): Pair[] {
  const preset = PRESETS[state.presetId];
  const out: Pair[] = [];
  for (const menuId of preset.menus) {
    const m = MENUS[menuId]!;
    if (opts.noEquipmentOnly && m.equipment) continue;
    for (const want of wantableResults(menuId)) {
      if (opts.lastDay && resultReady(menuId, want) === 'overnight') continue;
      out.push({ menuId, want });
    }
  }
  return out;
}

function pickPair(rng: Rng, pairs: Pair[], used: Set<string>): Pair | null {
  // 메뉴를 먼저 같은 확률로, 그 메뉴의 결과를 같은 확률로 고른다
  const menus = [...new Set(pairs.map((p) => p.menuId))];
  const order = rng.shuffle(menus);
  for (const menuId of order) {
    const wants = rng.shuffle(pairs.filter((p) => p.menuId === menuId && !used.has(`${menuId}:${p.want}`)));
    if (wants.length) return wants[0]!;
  }
  return null;
}

function makeOrder(state: GameState, rng: Rng, pair: Pair, takeout: boolean): Order {
  const servings = rng.next() < state.config.twoServingRate ? 2 : 1;
  const customer = takeout ? TAKEOUT_CUSTOMER.id : rng.pick(CUSTOMER_CHARACTERS).id;
  return {
    id: newId(state, 'O'), customer, menuId: pair.menuId, want: pair.want, servings,
    price: priceOf(state, pair.menuId, pair.want), takeout,
    arriveDay: state.day, leaveDay: state.day + state.config.customerWaitDays - 1,
  };
}

/** 5.1 매일 아침 팀마다 새 손님을 만든다. */
export function generateCustomers(state: GameState, team: TeamState): Order[] {
  const day = state.day;
  const rng = subRng(state.seed, 'cust', day, team.id);
  const lastDay = day >= state.daysTotal;
  const weather = state.weather[day - 1] ?? 'sunny';
  const all = candidatePairs(state, { noEquipmentOnly: day === 1, lastDay });
  const used = new Set<string>();
  const picked: Pair[] = [];
  const n = state.config.customersPerDay;

  // 1명 이상은 지금 가진 장비로 만들 수 있고 기다리는 동안 완성할 수 있는 메뉴
  const feasible = all.filter((p) => hasEquipment(team, MENUS[p.menuId]!.equipment));
  const first = pickPair(rng, feasible.length ? feasible : all, used);
  if (first) { picked.push(first); used.add(`${first.menuId}:${first.want}`); }

  // 더움·추움이면 3명 중 2명은 가능한 한 날씨에 맞는 온도
  if (weather !== 'sunny') {
    const wantTemp = weather === 'hot' ? 'cold' : 'warm';
    const matching = all.filter((p) => resultTemperature(p.menuId, p.want) === wantTemp);
    let matched = picked.filter((p) => resultTemperature(p.menuId, p.want) === wantTemp).length;
    while (matched < 2 && picked.length < n) {
      const p = pickPair(rng, matching, used);
      if (!p) break;
      picked.push(p); used.add(`${p.menuId}:${p.want}`); matched++;
    }
  }
  while (picked.length < n) {
    const p = pickPair(rng, all, used);
    if (!p) break;
    picked.push(p); used.add(`${p.menuId}:${p.want}`);
  }
  const orders = picked.map((p) => makeOrder(state, rng, p, false));
  // 보온 포장 세트가 있는 팀에는 포장 손님 1명이 더 온다
  if (team.equipment.includes('packaging')) {
    const p = pickPair(rng, all, used) ?? pickPair(rng, all, new Set());
    if (p) orders.push(makeOrder(state, rng, p, true));
  }
  return orders;
}

/** 대기 줄에 새 손님을 넣고, 넘치면 가장 오래 기다린 손님부터 보낸다. */
export function admitCustomers(state: GameState, team: TeamState, orders: Order[]): void {
  team.customers.push(...orders);
  const max = state.config.queueMax;
  while (team.customers.length > max) {
    let idx = 0;
    for (let i = 1; i < team.customers.length; i++) if (team.customers[i]!.arriveDay < team.customers[idx]!.arriveDay) idx = i;
    const gone = team.customers.splice(idx, 1)[0]!;
    logEvent(state, team.id, 'queueFull', `줄이 가득 차서 ${MENUS[gone.menuId]?.name ?? ''} 손님이 떠났어요.`);
  }
}

/** 5.3 단체 주문: 3일 차와 마지막 전날 아침에 하나씩. 장비 없는 메뉴, 하룻밤 아닌 결과, 두 번은 서로 다른 메뉴. */
export function generateGroupOrders(state: GameState): GroupOrder[] {
  const rng = subRng(state.seed, 'group');
  const openDays = [...new Set([3, state.daysTotal - 1])].filter((d) => d >= 1 && d <= state.daysTotal);
  const preset = PRESETS[state.presetId];
  const pairs: Pair[] = [];
  for (const menuId of preset.menus) {
    if (MENUS[menuId]!.equipment) continue;
    for (const want of wantableResults(menuId)) if (resultReady(menuId, want) !== 'overnight') pairs.push({ menuId, want });
  }
  const out: GroupOrder[] = [];
  const usedMenus = new Set<string>();
  for (const openDay of openDays) {
    const pool = pairs.filter((p) => !usedMenus.has(p.menuId));
    const p = pickPair(rng, pool.length ? pool : pairs, new Set());
    if (!p) break;
    usedMenus.add(p.menuId);
    out.push({ id: newId(state, 'G'), menuId: p.menuId, want: p.want, servings: state.config.groupServings, price: priceOf(state, p.menuId, p.want), openDay, dueDay: openDay + 1 });
  }
  return out;
}

/** 오늘 보이는 단체 주문 */
export function activeGroupOrders(state: GameState): GroupOrder[] {
  return state.groupOrders.filter((g) => g.openDay <= state.day && state.day <= g.dueDay);
}
