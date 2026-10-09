import type { EconomyConfig, GameState, PresetId } from '../shared/types';
import { createGame, TEAM_COLORS } from '../shared/engine/state';
import { startGame, settleDay } from '../shared/engine/phases';
import { applyTeamCommand } from '../shared/engine/commands';
import { subRng } from '../shared/engine/rng';
import { EQUIPMENT, MASCOT_IDS, MENUS } from '../shared/content';
import { DEFAULT_ECONOMY } from '../shared/config/economy';
import { BOTS, makeExec, type BotId } from './bots';

export interface GameSpec {
  seed: string;
  presetId: PresetId;
  days: number;
  teams: { bot: BotId }[];
  config?: EconomyConfig;
}

export interface TeamOutcome {
  teamId: string;
  position: number;
  bot: BotId;
  netProfit: number;
  rank: number;
  firstSaleDay: number | null;
  servedServings: number;
  avgStars: number;
  madeServings: number;
  wasteServings: number;
  /** 메뉴별 매출 (대금+팁+보너스 근사: 낸 인분 × 인분당 가격) */
  salesByMenu: Record<string, number>;
  equipment: { id: string; day: number; paybackDays: number | null }[];
}

export interface GameOutcome {
  spec: GameSpec;
  teams: TeamOutcome[];
  errors: string[];
  days: number;
  finalState?: GameState;
}

function checkInvariants(state: GameState, errors: string[]): void {
  for (const t of Object.values(state.teams)) {
    if (t.coins < 0) errors.push(`D${state.day} ${t.id} 음수 코인 ${t.coins}`);
    for (const [id, n] of Object.entries(t.stock)) if (n < 0) errors.push(`D${state.day} ${t.id} 음수 재고 ${id}=${n}`);
    for (const p of t.products) if (p.servings <= 0) errors.push(`D${state.day} ${t.id} 0인분 음식 ${p.id}`);
    if (t.customers.length > state.config.queueMax) errors.push(`D${state.day} ${t.id} 대기 줄 초과`);
  }
}

/** 한 경기를 헤드리스로 끝까지 실행한다. 봇은 플레이어와 같은 명령 검증을 거친다. */
export function runGame(spec: GameSpec, opts: { keepState?: boolean; verbose?: boolean } = {}): GameOutcome {
  const errors: string[] = [];
  const state = createGame({
    seed: spec.seed, presetId: spec.presetId, daysTotal: spec.days, config: spec.config ?? DEFAULT_ECONOMY,
    teams: spec.teams.map((t, i) => ({ id: `T${i + 1}`, name: `${t.bot}-${i + 1}`, color: TEAM_COLORS[i % TEAM_COLORS.length]!, mascot: MASCOT_IDS[i % MASCOT_IDS.length]! })),
  });
  const equipDays: Record<string, { id: string; day: number }[]> = {};
  try {
    startGame(state);
    let guard = 0;
    while (state.phase !== 'finished' && guard++ < 40) {
      const order = spec.teams.map((_, i) => i);
      const rot = state.day % order.length;
      const rotated = [...order.slice(rot), ...order.slice(0, rot)];
      for (const i of rotated) {
        const teamId = `T${i + 1}`;
        const before = new Set(state.teams[teamId]!.equipment);
        BOTS[spec.teams[i]!.bot].day(state, teamId, { rng: subRng(spec.seed, 'bot', teamId, state.day), exec: makeExec(state, teamId, opts.verbose ? (e) => console.log(`  ${teamId} 거절: ${e}`) : undefined) });
        for (const e of state.teams[teamId]!.equipment) if (!before.has(e)) (equipDays[teamId] ??= []).push({ id: e, day: state.day });
        applyTeamCommand(state, teamId, { type: 'ready', on: true });
      }
      const dayDone = state.day;
      settleDay(state);
      checkInvariants(state, errors);
      if (opts.verbose) console.log(`D${dayDone}: ` + state.teamOrder.map((id) => `${id}=${state.teams[id]!.coins}c`).join(' '));
    }
    if (state.phase !== 'finished') errors.push('경기가 종료되지 않음');
    const res = state.results ?? [];
    const teams: TeamOutcome[] = spec.teams.map((t, i) => {
      const id = `T${i + 1}`;
      const ts = state.teams[id]!;
      const r = res.find((x) => x.teamId === id);
      const salesByMenu: Record<string, number> = {};
      for (const s of ts.served) salesByMenu[s.menuId] = (salesByMenu[s.menuId] ?? 0) + s.servings * (state.config.menuPrices[`${s.menuId}:${s.result}`] ?? state.config.menuPrices[s.menuId] ?? 0);
      const madeServings = Object.values(ts.attempts).reduce((a, at) => a + at.tries * state.config.servingsPerMake, 0);
      const firstSale = ts.served.length ? Math.min(...ts.served.map((s) => s.day)) : null;
      // 본전 회수: 그 장비로만 만들 수 있는 메뉴(포장 세트는 포장 손님)로 번 이익(대금 − 재료비 − 전기 요금)이 장비 가격에 이르는 날
      const equipment = (equipDays[id] ?? []).map((e) => {
        const price = state.config.equipmentPrices[e.id] ?? EQUIPMENT[e.id]!.price;
        const enabled = new Set(EQUIPMENT[e.id]!.enables);
        let acc = 0;
        let payback: number | null = null;
        for (let d = e.day; d <= state.daysTotal && payback === null; d++) {
          for (const s of ts.served) {
            if (s.day !== d) continue;
            const relevant = e.id === 'packaging' ? s.takeout : enabled.has(s.menuId);
            if (!relevant) continue;
            const m = MENUS[s.menuId]!;
            const ingCost = Object.entries(m.ingredients).reduce((a, [ing, u]) => a + u * (state.config.ingredientPrices[ing] ?? 0), 0) + (state.config.electricity[s.menuId] ?? m.electricity);
            acc += s.paid - (ingCost / state.config.servingsPerMake) * s.servings;
          }
          if (acc >= price) payback = d - e.day + 1;
        }
        return { id: e.id, day: e.day, paybackDays: payback };
      });
      return {
        teamId: id, position: i, bot: t.bot, netProfit: r?.netProfit ?? ts.coins - state.config.startCoins, rank: r?.rank ?? 0,
        firstSaleDay: firstSale, servedServings: r?.servedServings ?? 0, avgStars: r?.avgStars ?? 0, madeServings, wasteServings: r?.wasteServings ?? 0, salesByMenu, equipment,
      };
    });
    return { spec, teams, errors, days: state.daysTotal, finalState: opts.keepState ? state : undefined };
  } catch (e) {
    errors.push(`예외: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    return { spec, teams: [], errors, days: state.day, finalState: opts.keepState ? state : undefined };
  }
}
