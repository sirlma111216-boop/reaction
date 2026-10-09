import type { CommandResult, GameState, Product, TeamCommand, TeamState } from '../types';
import { EQUIPMENT, INGREDIENTS, MENUS, PRESETS, choiceElectricity, choiceUses, resultReady } from '../content';
import { equipmentPrice, hasEquipment, ingredientPrice, isLastDay, logEvent, newId, presetOf, readyDayOf, shopIngredients } from './state';
import { activeGroupOrders } from './customers';
import { availableProducts, isFailResult, quoteGroup, quoteServe } from './scoring';

/**
 * 3.1 행동. 순수 함수: 서버·연습 모드·시뮬레이터가 같은 검증을 거친다.
 * 점장인지 검사는 서버(방)가 한다. 여기서는 규칙만 본다.
 */
export function applyTeamCommand(state: GameState, teamId: string, cmd: TeamCommand): CommandResult {
  const team = state.teams[teamId];
  if (!team) return fail('없는 팀이에요.');
  if (state.phase !== 'open') return fail('지금은 영업 중이 아니에요.');
  switch (cmd.type) {
    case 'buy': return buy(state, team, cmd.items);
    case 'make': return make(state, team, cmd.menuId, cmd.choice);
    case 'equip': return equip(state, team, cmd.equipmentId);
    case 'serve': return serve(state, team, cmd.orderId, cmd.result);
    case 'serveGroup': return serveGroup(state, team, cmd.groupOrderId, cmd.result);
    case 'ready': return setReady(state, team, cmd.on);
    case 'hint': return hint(team, cmd.menuId);
    case 'pin': {
      team.pins.push({ playerId: cmd.playerId ?? '', target: String(cmd.target).slice(0, 40), label: String(cmd.label).slice(0, 20), at: cmd.at ?? 0 });
      if (team.pins.length > 30) team.pins.splice(0, team.pins.length - 30);
      return { ok: true };
    }
    default: return fail('알 수 없는 명령이에요.');
  }
}

const fail = (error: string): CommandResult => ({ ok: false, error });

function needAction(state: GameState, team: TeamState): string | null {
  if (team.ready) return '오늘 영업을 마감했어요. 취소하면 다시 할 수 있어요.';
  if (team.actionsLeft <= 0) return '오늘 행동을 다 썼어요. 음식 내기와 마감은 할 수 있어요.';
  void state;
  return null;
}

function buy(state: GameState, team: TeamState, items: { ingredientId: string; units: number }[]): CommandResult {
  const blocked = needAction(state, team);
  if (blocked) return fail(blocked);
  const cfg = state.config;
  const merged: Record<string, number> = {};
  for (const it of items ?? []) {
    const u = Math.floor(Number(it.units));
    if (!Number.isFinite(u) || u <= 0) continue;
    merged[it.ingredientId] = (merged[it.ingredientId] ?? 0) + u;
  }
  const kinds = Object.keys(merged);
  if (!kinds.length) return fail('살 재료를 골라 주세요.');
  const shop = shopIngredients(state.presetId);
  for (const id of kinds) if (!INGREDIENTS[id] || !shop.includes(id)) return fail('이 메뉴판에서는 팔지 않는 재료예요.');
  if (kinds.length > cfg.buyMaxKinds) return fail(`한 번에 ${cfg.buyMaxKinds}종류까지 살 수 있어요.`);
  const total = Object.values(merged).reduce((a, b) => a + b, 0);
  if (total > cfg.buyMaxUnits) return fail(`한 번에 ${cfg.buyMaxUnits}개까지 살 수 있어요.`);
  const cost = kinds.reduce((a, id) => a + ingredientPrice(state, id) * merged[id]!, 0);
  if (cost > team.coins) return fail(`코인이 ${cost - team.coins} 모자라요.`);
  team.coins -= cost;
  team.today.ingredients += cost;
  for (const id of kinds) team.stock[id] = (team.stock[id] ?? 0) + merged[id]!;
  team.actionsLeft -= 1;
  logEvent(state, team.id, 'buy', `${kinds.map((id) => `${INGREDIENTS[id]!.name} ${merged[id]}`).join(', ')}을(를) ${cost}코인에 샀어요.`);
  return { ok: true, paid: cost };
}

function equip(state: GameState, team: TeamState, equipmentId: string): CommandResult {
  const blocked = needAction(state, team);
  if (blocked) return fail(blocked);
  const eq = EQUIPMENT[equipmentId];
  if (!eq || !presetOf(state).equipment.includes(equipmentId)) return fail('이 메뉴판에서는 살 수 없는 장비예요.');
  if (team.equipment.includes(equipmentId)) return fail('이미 있는 장비예요. 같은 장비는 1대만 둘 수 있어요.');
  const price = equipmentPrice(state, equipmentId);
  if (price > team.coins) return fail(`코인이 ${price - team.coins} 모자라요.`);
  team.coins -= price;
  team.today.equipment += price;
  team.equipment.push(equipmentId);
  team.actionsLeft -= 1;
  logEvent(state, team.id, 'equip', `${eq.name}을(를) ${price}코인에 설치했어요.`);
  return { ok: true, paid: price };
}

export interface MakeCheck { ok: boolean; reason?: string; missing: Record<string, number>; needEquipment: string | null; cost: number; electricity: number }

/** 만들기가 가능한지 미리 본다 (화면·봇 공용). 행동·마감은 보지 않는다. */
export function checkMake(state: GameState, team: TeamState, menuId: string, choiceId: string): MakeCheck {
  const m = MENUS[menuId];
  const empty: MakeCheck = { ok: false, missing: {}, needEquipment: null, cost: 0, electricity: 0 };
  if (!m || !PRESETS[state.presetId].menus.includes(menuId)) return { ...empty, reason: '이 메뉴판에 없는 메뉴예요.' };
  const choice = m.choices.find((c) => c.id === choiceId);
  if (!choice) return { ...empty, reason: '없는 조건이에요.' };
  const needEquipment = hasEquipment(team, m.equipment) ? null : m.equipment;
  const uses = choiceUses(menuId, choiceId);
  const missing: Record<string, number> = {};
  let cost = 0;
  for (const [id, units] of Object.entries(uses)) {
    const have = team.stock[id] ?? 0;
    if (have < units) missing[id] = units - have;
    cost += ingredientPrice(state, id) * units;
  }
  const electricity = choiceElectricity(menuId, choiceId, state.config.electricity[menuId] ?? m.electricity);
  if (needEquipment) return { ok: false, reason: `${EQUIPMENT[needEquipment]?.name ?? '장비'}가 필요해요.`, missing, needEquipment, cost, electricity };
  if (Object.keys(missing).length) return { ok: false, reason: `재료가 모자라요: ${Object.entries(missing).map(([id, n]) => `${INGREDIENTS[id]?.name ?? id} ${n}`).join(', ')}`, missing, needEquipment, cost, electricity };
  if (electricity > team.coins) return { ok: false, reason: `전기 요금 ${electricity}코인이 모자라요.`, missing, needEquipment, cost, electricity };
  return { ok: true, missing, needEquipment, cost, electricity };
}

function make(state: GameState, team: TeamState, menuId: string, choiceId: string): CommandResult {
  const blocked = needAction(state, team);
  if (blocked) return fail(blocked);
  const check = checkMake(state, team, menuId, choiceId);
  if (!check.ok) return fail(check.reason ?? '지금은 만들 수 없어요.');
  const m = MENUS[menuId]!;
  const choice = m.choices.find((c) => c.id === choiceId)!;
  const uses = choiceUses(menuId, choiceId);
  for (const [id, units] of Object.entries(uses)) team.stock[id] = (team.stock[id] ?? 0) - units;
  team.coins -= check.electricity;
  team.today.electricity += check.electricity;
  const result = choice.result;
  const readyDay = readyDayOf(state, menuId, result);
  const servings = state.config.servingsPerMake;
  const existing = team.products.find((p) => p.menuId === menuId && p.result === result && p.readyDay === readyDay);
  if (existing) existing.servings += servings;
  else {
    const p: Product = { id: newId(state, 'F'), menuId, result, servings, readyDay, madeDay: state.day };
    team.products.push(p);
  }
  team.actionsLeft -= 1;
  const at = (team.attempts[menuId] ??= { tries: 0, firstOk: false, hintUsed: false, choices: [], results: [], threeStar: false });
  const failRes = isFailResult(menuId, result);
  if (at.tries === 0 && !failRes) at.firstOk = true;
  at.tries += 1;
  if (!at.choices.includes(choiceId)) at.choices.push(choiceId);
  if (!at.results.includes(result)) at.results.push(result);
  logEvent(state, team.id, 'make', `${m.name}: ${m.results[result]!.name} ${servings}인분${resultReady(menuId, result) === 'overnight' ? ' (내일 아침 완성)' : ''}`);
  return { ok: true, result, paid: check.electricity };
}

/** 보관함에서 인분을 뺀다. 어제 것부터 쓴다. */
function consume(team: TeamState, day: number, menuId: string, result: string, servings: number): boolean {
  const products = availableProducts(team, day, menuId, result);
  let need = servings;
  for (const p of products) {
    if (need <= 0) break;
    const take = Math.min(p.servings, need);
    p.servings -= take;
    need -= take;
  }
  team.products = team.products.filter((p) => p.servings > 0);
  return need <= 0;
}

function serve(state: GameState, team: TeamState, orderId: string, result: string): CommandResult {
  if (team.ready) return fail('오늘 영업을 마감했어요. 취소하면 다시 할 수 있어요.');
  const order = team.customers.find((o) => o.id === orderId);
  if (!order) return fail('이미 떠난 손님이에요.');
  const quote = quoteServe(state, team, order, result);
  if (!quote) return fail('주문한 인분만큼 같은 음식이 없어요.');
  consume(team, state.day, order.menuId, result, order.servings);
  team.coins += quote.total;
  team.today.sales += quote.base;
  team.today.tips += quote.tip;
  team.today.weatherBonus += quote.weatherBonus;
  team.today.takeoutBonus += quote.takeoutBonus;
  team.today.servedServings += order.servings;
  team.customers = team.customers.filter((o) => o.id !== orderId);
  team.served.push({ day: state.day, menuId: order.menuId, result, servings: order.servings, stars: quote.stars, group: false, paid: quote.total, takeout: order.takeout });
  if (quote.stars === 3) { const at = team.attempts[order.menuId]; if (at) at.threeStar = true; }
  logEvent(state, team.id, 'serve', `${MENUS[order.menuId]!.name} ${order.servings}인분을 내고 별 ${quote.stars}개, ${quote.total}코인을 받았어요.`);
  return { ok: true, stars: quote.stars, paid: quote.total, result };
}

function serveGroup(state: GameState, team: TeamState, groupOrderId: string, result: string): CommandResult {
  if (team.ready) return fail('오늘 영업을 마감했어요. 취소하면 다시 할 수 있어요.');
  const g = activeGroupOrders(state).find((x) => x.id === groupOrderId);
  if (!g) return fail('지금은 받지 않는 단체 주문이에요.');
  if (team.groupDone.includes(g.id)) return fail('이 단체 주문은 이미 냈어요.');
  const quote = quoteGroup(state, team, g.menuId, g.want, g.servings, g.price, result);
  if (!quote) return fail(`같은 음식 ${g.servings}인분이 필요해요.`);
  consume(team, state.day, g.menuId, result, g.servings);
  team.coins += quote.total;
  team.today.sales += quote.base;
  team.today.tips += quote.tip;
  team.today.groupBonus += quote.bonus;
  team.today.servedServings += g.servings;
  team.groupDone.push(g.id);
  team.served.push({ day: state.day, menuId: g.menuId, result, servings: g.servings, stars: quote.stars, group: true, paid: quote.total, takeout: false });
  if (quote.stars === 3) { const at = team.attempts[g.menuId]; if (at) at.threeStar = true; }
  logEvent(state, team.id, 'serveGroup', `단체 주문 ${MENUS[g.menuId]!.name} ${g.servings}인분을 내고 별 ${quote.stars}개, ${quote.total}코인을 받았어요.`);
  return { ok: true, stars: quote.stars, paid: quote.total, result };
}

function setReady(state: GameState, team: TeamState, on: boolean): CommandResult {
  team.ready = !!on;
  void state;
  return { ok: true };
}

function hint(team: TeamState, menuId: string): CommandResult {
  if (!MENUS[menuId]) return fail('없는 메뉴예요.');
  const at = (team.attempts[menuId] ??= { tries: 0, firstOk: false, hintUsed: false, choices: [], results: [], threeStar: false });
  at.hintUsed = true;
  return { ok: true };
}

/** 마지막 날에 하룻밤 음식을 만들면 완성되지 않는다. 화면에서 미리 알려 주기 위한 판정 */
export function overnightTooLate(state: GameState, menuId: string, result: string): boolean {
  return resultReady(menuId, result) === 'overnight' && isLastDay(state);
}
