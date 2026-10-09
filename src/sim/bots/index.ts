import type { CommandResult, GameState, TeamCommand } from '../../shared/types';
import type { Rng } from '../../shared/engine/rng';
import { MENUS, PRESETS, resultReady } from '../../shared/content';
import { applyTeamCommand, checkMake } from '../../shared/engine/commands';
import { equipmentPrice, ingredientPrice, shopIngredients } from '../../shared/engine/state';
import { allChoices, combinePlans, correctChoice, demands, equipmentCandidates, executeCombo, planDemand, serveWhatYouCan, type Combo, type Demand, type Exec, type Plan } from './helpers';

export type BotId = 'expert' | 'learner' | 'investor' | 'frugal' | 'random';
export const BOT_IDS: BotId[] = ['expert', 'learner', 'investor', 'frugal', 'random'];
export const BOT_LABEL: Record<BotId, string> = { expert: '원리를 아는 봇', learner: '배우며 하는 봇', investor: '장비 투자 봇', frugal: '절약 봇', random: '무작위 봇' };

export interface BotContext { rng: Rng; exec: Exec }

export interface Bot {
  id: BotId;
  /** 하루의 행동. 끝나면 러너가 마감한다. */
  day(state: GameState, teamId: string, ctx: BotContext): void;
}

/** 봇도 학생과 같은 명령 검증을 거친다. */
export function makeExec(state: GameState, teamId: string, onReject?: (e: string) => void): Exec {
  return (cmd: TeamCommand): CommandResult => {
    const r = applyTeamCommand(state, teamId, cmd);
    if (!r.ok && onReject) onReject(r.error ?? '');
    return r;
  };
}

interface Policy {
  /** 이 주문에 쓸 선택지 (null 이면 건너뜀) */
  choose: (state: GameState, teamId: string, d: Demand, rng: Rng) => ReturnType<typeof correctChoice>;
  /** 장비를 살지 */
  equip: (state: GameState, teamId: string, rng: Rng) => string | null;
  /** 장비가 필요한 메뉴도 고려하는지 */
  allowEquipmentMenus: boolean;
}

/** 공용 하루 루틴: 낼 수 있는 것 내기 → (장비) → 이익이 큰 주문부터 계획 실행 */
function runPolicy(state: GameState, teamId: string, ctx: BotContext, policy: Policy): void {
  const team = state.teams[teamId]!;
  serveWhatYouCan(state, team, ctx.exec);
  let guard = 0;
  let equipped = false;
  while (team.actionsLeft > 0 && guard++ < 8) {
    // 장비는 하루에 한 대까지만 산다
    const eq = equipped ? null : policy.equip(state, teamId, ctx.rng);
    if (eq && ctx.exec({ type: 'equip', equipmentId: eq }).ok) { equipped = true; continue; }
    const plans: Plan[] = [];
    for (const d of demands(state, team)) {
      if (!policy.allowEquipmentMenus && MENUS[d.menuId]!.equipment) continue;
      const choice = policy.choose(state, teamId, d, ctx.rng);
      if (!choice) continue;
      const p = planDemand(state, team, d, choice);
      if (p.feasible && p.makes > 0 && p.profit > 0) plans.push(p);
    }
    if (!plans.length) break;
    // 오늘 바로 낼 수 있는 계획을 먼저, 그다음 이익 순. 두 계획을 한 번의 장보기로 묶을 수 있으면 묶는다 (행동 절약)
    const immediate = (p: Plan) => (resultReady(p.demand.menuId, p.choice.result) === 'now' ? 1 : 0);
    plans.sort((a, b) => immediate(b) - immediate(a) || b.profit - a.profit || a.actions - b.actions);
    let best: Combo = combinePlans(state, team, [plans[0]!]);
    for (const q of plans.slice(1)) {
      const c = combinePlans(state, team, [plans[0]!, q]);
      if (c.feasible && c.profit > best.profit) { best = c; break; }
    }
    if (!executeCombo(state, team, best, ctx.exec)) break;
  }
  serveWhatYouCan(state, team, ctx.exec);
}

const chooseCorrect: Policy['choose'] = (_s, _t, d) => correctChoice(d.menuId, d.want);

/** 만들기 1번의 이익 (2인분 가격 + 팁 − 재료비 − 전기 요금) */
function marginPerMake(state: GameState, menuId: string): number {
  const m = MENUS[menuId]!;
  const price = state.config.menuPrices[menuId] ?? m.price;
  const ing = Object.entries(m.ingredients).reduce((a, [id, u]) => a + u * (state.config.ingredientPrices[id] ?? 0), 0);
  return state.config.servingsPerMake * (price + state.config.tipPerServing) - ing - (state.config.electricity[menuId] ?? m.electricity);
}

/** 장비 구입 판단(expert): 장비 메뉴의 이익이 장비 없는 최고 메뉴보다 커서 남은 날 동안 장비 값을 넘길 때, 지금 손님이 찾는 장비를 산다 */
function equipWhenDemanded(state: GameState, teamId: string): string | null {
  const team = state.teams[teamId]!;
  const remaining = state.daysTotal - state.day + 1;
  if (remaining < 3 || team.actionsLeft < 2) return null;
  const preset = PRESETS[state.presetId];
  const bestFree = Math.max(0, ...preset.menus.filter((m) => !MENUS[m]!.equipment).map((m) => marginPerMake(state, m)));
  const wanted = new Set(team.customers.map((o) => MENUS[o.menuId]!.equipment).filter((e): e is string => !!e));
  for (const c of equipmentCandidates(state, team)) {
    if (!wanted.has(c.id) || c.id === 'packaging') continue;
    if (team.coins < c.price + 6) continue;
    const gain = Math.max(0, ...(preset.menus.filter((m) => MENUS[m]!.equipment === c.id).map((m) => marginPerMake(state, m) - bestFree)));
    if (gain * (remaining - 1) * 0.6 >= c.price) return c.id;
  }
  return null;
}

export const BOTS: Record<BotId, Bot> = {
  expert: {
    id: 'expert',
    day: (state, teamId, ctx) => runPolicy(state, teamId, ctx, { choose: chooseCorrect, equip: equipWhenDemanded, allowEquipmentMenus: true }),
  },
  learner: {
    id: 'learner',
    day: (state, teamId, ctx) => runPolicy(state, teamId, ctx, {
      choose: (s, t, d, rng) => {
        const at = s.teams[t]!.attempts[d.menuId];
        if (at && at.tries > 0) return correctChoice(d.menuId, d.want);
        const cs = allChoices(d.menuId);
        return cs.length ? rng.pick(cs) : null;
      },
      equip: equipWhenDemanded,
      allowEquipmentMenus: true,
    }),
  },
  investor: {
    id: 'investor',
    day: (state, teamId, ctx) => runPolicy(state, teamId, ctx, {
      choose: chooseCorrect,
      equip: (s, t) => {
        const team = s.teams[t]!;
        const remaining = s.daysTotal - s.day + 1;
        if (remaining < 2 || team.actionsLeft < 1) return null;
        const c = equipmentCandidates(s, team).filter((x) => x.id !== 'packaging')[0] ?? equipmentCandidates(s, team)[0];
        if (c && team.coins >= c.price + 4) return c.id;
        return null;
      },
      allowEquipmentMenus: true,
    }),
  },
  frugal: {
    id: 'frugal',
    day: (state, teamId, ctx) => runPolicy(state, teamId, ctx, { choose: chooseCorrect, equip: () => null, allowEquipmentMenus: false }),
  },
  random: {
    id: 'random',
    day: (state, teamId, ctx) => randomDay(state, teamId, ctx),
  },
};

/** 가능한 행동 중 무작위. 음식 내기도 무작위로 시도한다. */
function randomDay(state: GameState, teamId: string, ctx: BotContext): void {
  const team = state.teams[teamId]!;
  const rng = ctx.rng;
  const preset = PRESETS[state.presetId];
  let guard = 0;
  while (team.actionsLeft > 0 && guard++ < 12) {
    const kind = rng.int(3);
    if (kind === 0) {
      const shop = shopIngredients(state.presetId).filter((id) => ingredientPrice(state, id) <= team.coins);
      if (!shop.length) continue;
      const n = 1 + rng.int(3);
      const items: { ingredientId: string; units: number }[] = [];
      let budget = team.coins;
      for (let i = 0; i < n; i++) {
        const id = rng.pick(shop);
        const units = 1 + rng.int(2);
        const cost = units * ingredientPrice(state, id);
        if (cost > budget) continue;
        budget -= cost;
        items.push({ ingredientId: id, units });
      }
      if (items.length) ctx.exec({ type: 'buy', items });
    } else if (kind === 1) {
      const options = preset.menus.flatMap((m) => MENUS[m]!.choices.map((c) => ({ m, c }))).filter(({ m, c }) => checkMake(state, team, m, c.id).ok);
      if (!options.length) continue;
      const o = rng.pick(options);
      ctx.exec({ type: 'make', menuId: o.m, choice: o.c.id });
    } else {
      const eqs = preset.equipment.filter((e) => !team.equipment.includes(e) && equipmentPrice(state, e) <= team.coins);
      if (eqs.length && rng.next() < 0.3) ctx.exec({ type: 'equip', equipmentId: rng.pick(eqs) });
    }
    // 무작위로 내 보기
    if (rng.next() < 0.7) serveWhatYouCan(state, team, ctx.exec);
  }
  serveWhatYouCan(state, team, ctx.exec);
}
