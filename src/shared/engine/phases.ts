import type { FinalTeamResult, GameState, TeamState } from '../types';
import { MENUS } from '../content';
import { admitCustomers, generateCustomers, generateGroupOrders, generateWeather } from './customers';
import { emptyLedger, logEvent } from './state';

/**
 * 하루의 흐름. 정산 순서는 9.2-8 로 고정한다:
 * 기한 지난 손님·단체 주문 제거 → 유통기한 지난 음식 폐기 → 영수증 저장 → 마지막 날이면 결과, 아니면 날짜 +1
 * → 하룻밤 음식 완성 → 새 손님·단체 주문 → 행동 채우기 → 점장 교대(서버가 접속 상태를 보고 한다)
 */
export function startGame(state: GameState): void {
  if (state.phase !== 'setup') throw new Error('이미 시작했어요');
  state.weather = generateWeather(state.seed, state.daysTotal);
  state.groupOrders = generateGroupOrders(state);
  state.phase = 'open';
  state.day = 1;
  for (const id of state.teamOrder) openDayFor(state, state.teams[id]!);
  logEvent(state, null, 'start', '1일 차 영업을 시작해요.');
}

function openDayFor(state: GameState, team: TeamState): void {
  team.ready = false;
  team.pins = [];
  team.today = emptyLedger(state.day, team.receipts.length ? team.receipts[team.receipts.length - 1]!.cumulative : 0);
  // 하룻밤 음식 완성 (readyDay 가 오늘인 것)
  for (const p of team.products) if (p.readyDay === state.day && p.madeDay < state.day) logEvent(state, team.id, 'ready', `${MENUS[p.menuId]!.results[p.result]!.name}이(가) 완성됐어요.`);
  // 3.7 막힘 방지: 코인이 4보다 적고 재료와 보관함이 모두 비어 있으면 코인을 4로 채운다
  const stockEmpty = Object.values(team.stock).every((n) => n <= 0);
  if (team.coins < state.config.aidThreshold && stockEmpty && team.products.length === 0) {
    const aid = state.config.aidCoins - team.coins;
    if (aid > 0) { team.coins += aid; team.today.aid += aid; logEvent(state, team.id, 'aid', `긴급 지원 ${aid}코인을 받았어요.`); }
  }
  admitCustomers(state, team, generateCustomers(state, team));
  team.actionsLeft = state.config.actionsPerDay;
}

export function allTeamsReady(state: GameState, teamIds: string[] = state.teamOrder): boolean {
  return teamIds.length > 0 && teamIds.every((id) => state.teams[id]?.ready);
}

/** 모든 팀이 마감했을 때 정확히 한 번 호출한다. */
export function settleDay(state: GameState): void {
  if (state.phase !== 'open') return;
  const day = state.day;
  for (const id of state.teamOrder) {
    const team = state.teams[id]!;
    // 1. 기한이 지난 손님 제거
    const leaving = team.customers.filter((o) => o.leaveDay <= day);
    for (const o of leaving) logEvent(state, team.id, 'leave', `${MENUS[o.menuId]!.name} 손님이 기다리다 떠났어요.`);
    team.customers = team.customers.filter((o) => o.leaveDay > day);
    // 2. 유통기한이 지난 음식 폐기: 완성한 날의 다음 날 마감까지 팔지 못한 것
    const expired = team.products.filter((p) => p.readyDay <= day - 1);
    for (const p of expired) {
      team.today.waste.push({ menuId: p.menuId, result: p.result, servings: p.servings });
      logEvent(state, team.id, 'waste', `${MENUS[p.menuId]!.results[p.result]!.name} ${p.servings}인분을 폐기했어요.`);
    }
    team.products = team.products.filter((p) => p.readyDay > day - 1);
    // 3. 영수증 저장
    const l = team.today;
    l.net = l.sales + l.tips + l.weatherBonus + l.takeoutBonus + l.groupBonus + l.aid - l.ingredients - l.electricity - l.equipment;
    const prev = team.receipts.length ? team.receipts[team.receipts.length - 1]!.cumulative : 0;
    l.cumulative = prev + l.net;
    team.receipts.push(l);
    team.netHistory.push(l.cumulative);
  }
  state.settleCount += 1;
  // 4. 마지막 날이면 결과
  if (day >= state.daysTotal) {
    state.results = computeResults(state);
    state.phase = 'finished';
    logEvent(state, null, 'finish', '영업이 모두 끝났어요.');
    return;
  }
  state.day = day + 1;
  // 5~7. 하룻밤 음식 완성, 새 손님·단체 주문, 행동 채우기
  for (const id of state.teamOrder) openDayFor(state, state.teams[id]!);
  logEvent(state, null, 'open', `${state.day}일 차 영업을 시작해요.`);
}

/** 3.4 순이익 = 최종 코인 − 시작 코인. 동점이면 낸 인분, 그다음 평균 별점. */
export function computeResults(state: GameState): FinalTeamResult[] {
  const rows = state.teamOrder.map((id) => {
    const t = state.teams[id]!;
    const sales = t.receipts.reduce((a, r) => a + r.sales + r.tips + r.weatherBonus + r.takeoutBonus + r.groupBonus, 0);
    const expenses = t.receipts.reduce((a, r) => a + r.ingredients + r.electricity + r.equipment, 0);
    const starsCount = t.served.length;
    const avgStars = starsCount ? t.served.reduce((a, s) => a + s.stars, 0) / starsCount : 0;
    const wasteServings = t.receipts.reduce((a, r) => a + r.waste.reduce((x, w) => x + w.servings, 0), 0);
    const byMenu: Record<string, number> = {};
    for (const s of t.served) byMenu[s.menuId] = (byMenu[s.menuId] ?? 0) + s.servings;
    const top = Object.entries(byMenu).sort((a, b) => b[1] - a[1])[0];
    const scienceMenus = [...new Set(t.served.filter((s) => s.stars === 3).map((s) => s.menuId))];
    const r: FinalTeamResult = {
      teamId: id, name: t.name, color: t.color, mascot: t.mascot, rank: 0,
      netProfit: t.coins - state.config.startCoins, coins: t.coins, revenue: sales, expenses,
      servedServings: t.served.reduce((a, s) => a + s.servings, 0), avgStars: Math.round(avgStars * 100) / 100, starsCount, wasteServings,
      topMenu: top ? { menuId: top[0], servings: top[1] } : null, awards: [], scienceMenus,
    };
    return r;
  });
  rows.sort((a, b) => b.netProfit - a.netProfit || b.servedServings - a.servedServings || b.avgStars - a.avgStars);
  rows.forEach((r, i) => { r.rank = i + 1; });
  // 연출용 상 (순위에 영향 없음)
  const withStars = rows.filter((r) => r.starsCount > 0);
  if (withStars.length) {
    const best = Math.max(...withStars.map((r) => r.avgStars));
    for (const r of withStars) if (r.avgStars === best) r.awards.push('별점왕');
  }
  const explorerMax = Math.max(0, ...rows.map((r) => r.scienceMenus.length));
  if (explorerMax > 0) for (const r of rows) if (r.scienceMenus.length === explorerMax) r.awards.push('과학 탐험가');
  const wasteMin = Math.min(...rows.map((r) => r.wasteServings));
  for (const r of rows) if (r.wasteServings === wasteMin) r.awards.push('알뜰왕');
  return rows;
}

/** 교사의 조기 종료: 그날을 마지막 날로 삼아 정산을 한 번 하고 결과를 낸다. */
export function endEarly(state: GameState): void {
  if (state.phase !== 'open') return;
  state.daysTotal = Math.max(1, state.day);
  for (const id of state.teamOrder) state.teams[id]!.ready = true;
  settleDay(state);
}
