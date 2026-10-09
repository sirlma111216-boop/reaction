import { describe, expect, it } from 'vitest';
import type { GameState, PresetId } from '../src/shared/types';
import { createGame, TEAM_COLORS } from '../src/shared/engine/state';
import { startGame, settleDay, computeResults, endEarly } from '../src/shared/engine/phases';
import { applyTeamCommand, checkMake } from '../src/shared/engine/commands';
import { baseStars, quoteServe } from '../src/shared/engine/scoring';
import { MENUS, PRESETS, PRESET_IDS, choiceUses, resultReady, wantableResults } from '../src/shared/content';
import { generateWeather } from '../src/shared/engine/customers';

function game(presetId: PresetId = 'grade3', days = 8, seed = 'test', teams = 2): GameState {
  const g = createGame({ seed, presetId, daysTotal: days, teams: Array.from({ length: teams }, (_, i) => ({ id: `T${i + 1}`, name: `팀${i + 1}`, color: TEAM_COLORS[i]!, mascot: 'mascot-cat' })) });
  startGame(g);
  return g;
}
const T = (g: GameState, id = 'T1') => g.teams[id]!;
const give = (g: GameState, stock: Record<string, number>, id = 'T1') => { Object.assign(T(g, id).stock, stock); };

describe('행동: 장보기', () => {
  it('가격만큼 코인이 줄고 행동 1을 쓴다', () => {
    const g = game();
    const r = applyTeamCommand(g, 'T1', { type: 'buy', items: [{ ingredientId: 'tea', units: 2 }, { ingredientId: 'sugar', units: 1 }] });
    expect(r.ok).toBe(true);
    expect(T(g).coins).toBe(20 - 3);
    expect(T(g).actionsLeft).toBe(2);
    expect(T(g).stock['tea']).toBe(2);
  });
  it('4종류·6개 한도를 넘으면 거절한다', () => {
    const g = game();
    expect(applyTeamCommand(g, 'T1', { type: 'buy', items: [{ ingredientId: 'tea', units: 7 }] }).ok).toBe(false);
    expect(applyTeamCommand(g, 'T1', { type: 'buy', items: ['tea', 'sugar', 'milk', 'rice', 'lemon'].map((id) => ({ ingredientId: id, units: 1 })) }).ok).toBe(false);
    expect(T(g).actionsLeft).toBe(3);
  });
  it('코인이 모자라면 거절하고 모자란 수를 알려 준다', () => {
    const g = game();
    T(g).coins = 2;
    const r = applyTeamCommand(g, 'T1', { type: 'buy', items: [{ ingredientId: 'liquid-nitrogen', units: 1 }] });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('1 모자라요');
  });
  it('메뉴판에 없는 재료는 팔지 않는다', () => {
    const g = game('grade1');
    expect(applyTeamCommand(g, 'T1', { type: 'buy', items: [{ ingredientId: 'lemon', units: 1 }] }).ok).toBe(false);
  });
  it('행동을 다 쓰면 거절한다', () => {
    const g = game();
    T(g).actionsLeft = 0;
    expect(applyTeamCommand(g, 'T1', { type: 'buy', items: [{ ingredientId: 'tea', units: 1 }] }).ok).toBe(false);
  });
});

describe('행동: 장비 설치', () => {
  it('가격만큼 코인이 줄고 바로 쓸 수 있으며 같은 장비는 1대만', () => {
    const g = game();
    expect(applyTeamCommand(g, 'T1', { type: 'equip', equipmentId: 'oven' }).ok).toBe(true);
    expect(T(g).coins).toBe(20 - g.config.equipmentPrices['oven']!);
    expect(T(g).equipment).toEqual(['oven']);
    expect(applyTeamCommand(g, 'T1', { type: 'equip', equipmentId: 'oven' }).ok).toBe(false);
  });
  it('메뉴판에 없는 장비는 살 수 없다', () => {
    const g = game('grade1');
    expect(applyTeamCommand(g, 'T1', { type: 'equip', equipmentId: 'griddle' }).ok).toBe(false);
  });
});

describe('행동: 만들기 — 13개 메뉴의 모든 선택지', () => {
  for (const m of Object.values(MENUS)) {
    for (const c of m.choices) {
      it(`${m.id} ${m.name} / ${c.label} → ${m.results[c.result]!.name}`, () => {
        const g = game('grade3');
        if (m.equipment) T(g).equipment.push(m.equipment);
        give(g, { ...m.ingredients });
        const coinsBefore = T(g).coins;
        const r = applyTeamCommand(g, 'T1', { type: 'make', menuId: m.id, choice: c.id });
        expect(r.ok).toBe(true);
        expect(r.result).toBe(c.result);
        const p = T(g).products.find((x) => x.menuId === m.id)!;
        expect(p.result).toBe(c.result);
        expect(p.servings).toBe(2);
        expect(p.readyDay).toBe(resultReady(m.id, c.result) === 'overnight' ? 2 : 1);
        const uses = choiceUses(m.id, c.id);
        for (const [id, u] of Object.entries(m.ingredients)) expect(T(g).stock[id]).toBe(u - (uses[id] ?? 0));
        const elec = c.electricity ?? m.electricity;
        expect(T(g).coins).toBe(coinsBefore - elec);
        expect(T(g).today.electricity).toBe(elec);
        expect(T(g).actionsLeft).toBe(2);
        expect(T(g).attempts[m.id]!.tries).toBe(1);
        expect(T(g).attempts[m.id]!.firstOk).toBe(!m.results[c.result]!.fail);
      });
    }
  }
  it('M10 「넣지 않는다」는 탄산수소 나트륨을 차감하지 않는다', () => {
    const g = game();
    give(g, { sugar: 1 });
    expect(applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M10', choice: 'skip' }).ok).toBe(true);
    expect(T(g).stock['baking-soda'] ?? 0).toBe(0);
  });
  it('M05 「데우지 않는다」는 전기 요금 0', () => {
    const g = game();
    T(g).equipment.push('oven');
    give(g, { chocolate: 1, milk: 1, marshmallow: 1 });
    applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M05', choice: 'none' });
    expect(T(g).today.electricity).toBe(0);
    expect(T(g).coins).toBe(20);
  });
  it('장비가 없으면 만들 수 없다', () => {
    const g = game();
    give(g, { cream: 1, milk: 1, sugar: 1, 'liquid-nitrogen': 1 });
    const r = applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M01', choice: 'much' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('스탠드 믹서');
  });
  it('재료가 모자라면 부족한 재료를 알려 준다', () => {
    const g = game();
    const chk = checkMake(g, T(g), 'M06', 'bath');
    expect(chk.ok).toBe(false);
    expect(chk.missing['chocolate']).toBe(2);
  });
  it('같은 메뉴·결과·완성일은 합친다', () => {
    const g = game();
    give(g, { sugar: 2, 'baking-soda': 2 });
    applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M10', choice: 'add' });
    applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M10', choice: 'add' });
    expect(T(g).products.length).toBe(1);
    expect(T(g).products[0]!.servings).toBe(4);
  });
});

describe('별점과 대금', () => {
  it('원한 결과와 같으면 3, M07 한 단계 차이면 2, 그 밖은 1', () => {
    expect(baseStars('M01', 'hard', 'hard')).toBe(3);
    expect(baseStars('M01', 'hard', 'soft')).toBe(1);
    expect(baseStars('M07', 'strong', 'medium')).toBe(2);
    expect(baseStars('M07', 'strong', 'weak')).toBe(1);
    expect(baseStars('M07', 'medium', 'weak')).toBe(2);
    expect(baseStars('M06', 'good', 'burnt')).toBe(1);
  });
  it('별 3개면 팁, 별 1개면 절반(내림), 대금은 바로 들어오고 행동을 쓰지 않는다', () => {
    const g = game();
    give(g, { sugar: 2, 'baking-soda': 2 });
    applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M10', choice: 'add' });
    applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M10', choice: 'skip' });
    T(g).actionsLeft = 0;
    T(g).customers = [
      { id: 'O1', customer: 'cust-01', menuId: 'M10', want: 'puffed', servings: 1, price: 4, takeout: false, arriveDay: 1, leaveDay: 2 },
      { id: 'O2', customer: 'cust-01', menuId: 'M10', want: 'puffed', servings: 1, price: 4, takeout: false, arriveDay: 1, leaveDay: 2 },
    ];
    const before = T(g).coins;
    const a = applyTeamCommand(g, 'T1', { type: 'serve', orderId: 'O1', result: 'puffed' });
    expect(a.ok).toBe(true); expect(a.stars).toBe(3); expect(a.paid).toBe(4 + 1);
    const b = applyTeamCommand(g, 'T1', { type: 'serve', orderId: 'O2', result: 'candy' });
    expect(b.stars).toBe(1); expect(b.paid).toBe(Math.floor(4 / 2));
    expect(T(g).coins).toBe(before + 5 + 2);
    expect(T(g).customers.length).toBe(0);
    expect(T(g).today.servedServings).toBe(2);
  });
  it('M03 대금은 손님이 원한 결과의 가격', () => {
    const g = game();
    give(g, { tea: 1 });
    applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M03', choice: 'hot' });
    T(g).customers = [{ id: 'O1', customer: 'cust-01', menuId: 'M03', want: 'coldbrew', servings: 2, price: 5, takeout: false, arriveDay: 1, leaveDay: 2 }];
    const r = applyTeamCommand(g, 'T1', { type: 'serve', orderId: 'O1', result: 'hot' });
    expect(r.stars).toBe(1);
    expect(r.paid).toBe(Math.floor(10 / 2));
  });
  it('주문한 인분만큼 없으면 거절', () => {
    const g = game();
    give(g, { tea: 1 });
    applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M03', choice: 'hot' });
    T(g).customers = [{ id: 'O1', customer: 'cust-01', menuId: 'M03', want: 'hot', servings: 2, price: 3, takeout: false, arriveDay: 1, leaveDay: 2 }, { id: 'O2', customer: 'cust-01', menuId: 'M03', want: 'hot', servings: 1, price: 3, takeout: false, arriveDay: 1, leaveDay: 2 }];
    expect(applyTeamCommand(g, 'T1', { type: 'serve', orderId: 'O1', result: 'hot' }).ok).toBe(true);
    expect(applyTeamCommand(g, 'T1', { type: 'serve', orderId: 'O2', result: 'hot' }).ok).toBe(false);
  });
  it('날씨 보너스는 별 2개 이상일 때만, 포장 보너스도 같다', () => {
    const g = game();
    g.weather[0] = 'cold';
    give(g, { tea: 2 });
    applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M03', choice: 'hot' });
    T(g).customers = [
      { id: 'O1', customer: 'cust-takeout', menuId: 'M03', want: 'hot', servings: 1, price: 3, takeout: true, arriveDay: 1, leaveDay: 2 },
      { id: 'O2', customer: 'cust-01', menuId: 'M03', want: 'coldbrew', servings: 1, price: 5, takeout: true, arriveDay: 1, leaveDay: 2 },
    ];
    const a = applyTeamCommand(g, 'T1', { type: 'serve', orderId: 'O1', result: 'hot' });
    expect(a.paid).toBe(3 + 1 + 1 + 2);
    const b = applyTeamCommand(g, 'T1', { type: 'serve', orderId: 'O2', result: 'hot' });
    expect(b.stars).toBe(1);
    expect(b.paid).toBe(2);
  });
});

describe('신선도와 폐기', () => {
  it('다음 날에 내면 별점이 1 줄고, 어제 것부터 쓴다', () => {
    const g = game();
    give(g, { tea: 2 });
    applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M03', choice: 'hot' });
    for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true });
    settleDay(g);
    expect(g.day).toBe(2);
    applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M03', choice: 'hot' });
    expect(T(g).products.length).toBe(2);
    T(g).customers = [{ id: 'O1', customer: 'cust-01', menuId: 'M03', want: 'hot', servings: 1, price: 3, takeout: false, arriveDay: 2, leaveDay: 3 }, { id: 'O2', customer: 'cust-01', menuId: 'M03', want: 'hot', servings: 2, price: 3, takeout: false, arriveDay: 2, leaveDay: 3 }];
    const q = quoteServe(g, T(g), T(g).customers[0]!, 'hot')!;
    expect(q.stars).toBe(2);
    expect(q.stale).toBe(true);
    applyTeamCommand(g, 'T1', { type: 'serve', orderId: 'O1', result: 'hot' });
    expect(T(g).products.find((p) => p.readyDay === 1)!.servings).toBe(1);
    // 어제 것 1인분 + 오늘 것 1인분 → 어제 것이 들어가므로 별점 2
    const r = applyTeamCommand(g, 'T1', { type: 'serve', orderId: 'O2', result: 'hot' });
    expect(r.stars).toBe(2);
    expect(T(g).products.length).toBe(1);
    expect(T(g).products[0]!.readyDay).toBe(2);
  });
  it('완성한 날의 다음 날 마감 정산 때 폐기하고 영수증에 적는다', () => {
    const g = game();
    give(g, { tea: 1 });
    applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M03', choice: 'hot' });
    for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true });
    settleDay(g);
    expect(T(g).products.length).toBe(1);
    for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true });
    settleDay(g);
    expect(T(g).products.length).toBe(0);
    expect(T(g).receipts[1]!.waste).toEqual([{ menuId: 'M03', result: 'hot', servings: 2 }]);
  });
  it('하룻밤 음식은 다음 날 아침 완성되고 신선도는 완성일부터 센다', () => {
    const g = game();
    give(g, { sugar: 2 });
    applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M09', choice: 'saturated' });
    T(g).customers = [{ id: 'O1', customer: 'cust-01', menuId: 'M09', want: 'crystal', servings: 1, price: 6, takeout: false, arriveDay: 1, leaveDay: 2 }];
    expect(applyTeamCommand(g, 'T1', { type: 'serve', orderId: 'O1', result: 'crystal' }).ok).toBe(false);
    for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true });
    settleDay(g);
    expect(T(g).products[0]!.readyDay).toBe(2);
    T(g).customers = [{ id: 'O1', customer: 'cust-01', menuId: 'M09', want: 'crystal', servings: 1, price: 6, takeout: false, arriveDay: 1, leaveDay: 2 }];
    const r = applyTeamCommand(g, 'T1', { type: 'serve', orderId: 'O1', result: 'crystal' });
    expect(r.stars).toBe(3);
    for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true });
    settleDay(g);
    expect(T(g).products.length).toBe(1);
    for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true });
    settleDay(g);
    expect(T(g).products.length).toBe(0);
  });
});

describe('마감과 경계 규칙', () => {
  it('마감한 팀은 취소 전까지 음식 내기도 못 한다', () => {
    const g = game();
    give(g, { tea: 1 });
    applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M03', choice: 'hot' });
    T(g).customers = [{ id: 'O1', customer: 'cust-01', menuId: 'M03', want: 'hot', servings: 1, price: 3, takeout: false, arriveDay: 1, leaveDay: 2 }];
    applyTeamCommand(g, 'T1', { type: 'ready', on: true });
    expect(applyTeamCommand(g, 'T1', { type: 'serve', orderId: 'O1', result: 'hot' }).ok).toBe(false);
    applyTeamCommand(g, 'T1', { type: 'ready', on: false });
    expect(applyTeamCommand(g, 'T1', { type: 'serve', orderId: 'O1', result: 'hot' }).ok).toBe(true);
  });
  it('행동을 다 쓴 뒤에도 음식 내기와 마감은 된다, 코인은 0 아래로 가지 않는다', () => {
    const g = game();
    T(g).coins = 0;
    expect(applyTeamCommand(g, 'T1', { type: 'buy', items: [{ ingredientId: 'tea', units: 1 }] }).ok).toBe(false);
    expect(T(g).coins).toBe(0);
    T(g).actionsLeft = 0;
    expect(applyTeamCommand(g, 'T1', { type: 'ready', on: true }).ok).toBe(true);
  });
  it('같은 시드·같은 명령이면 결과가 같다', () => {
    const run = () => {
      const g = game('grade2', 6, 'det');
      give(g, { tea: 2, syrup: 1, 'dry-ice': 1 });
      applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M02', choice: 'warm' });
      for (let d = 0; d < 6; d++) { for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true }); settleDay(g); }
      return JSON.stringify(g);
    };
    expect(run()).toBe(run());
  });
  it('힌트는 행동을 쓰지 않고 기록만 한다', () => {
    const g = game();
    expect(applyTeamCommand(g, 'T1', { type: 'hint', menuId: 'M03' }).ok).toBe(true);
    expect(T(g).attempts['M03']!.hintUsed).toBe(true);
    expect(T(g).actionsLeft).toBe(3);
  });
});

describe('손님 생성', () => {
  it('1일 차 손님 3명은 모두 장비 없이 만들 수 있는 메뉴', () => {
    for (const pid of PRESET_IDS) for (let i = 0; i < 20; i++) {
      const g = game(pid, 8, `c-${i}`);
      for (const t of Object.values(g.teams)) {
        expect(t.customers.length).toBe(3);
        for (const o of t.customers) expect(MENUS[o.menuId]!.equipment).toBeNull();
      }
    }
  });
  it('같은 날 한 팀에 같은 메뉴·결과 손님이 둘 오지 않고, 원하는 결과는 (실패)가 아니다', () => {
    for (let i = 0; i < 30; i++) {
      const g = game('grade3', 8, `d-${i}`);
      for (let d = 0; d < 7; d++) {
        for (const t of Object.values(g.teams)) {
          const today = t.customers.filter((o) => o.arriveDay === g.day);
          const keys = today.map((o) => `${o.menuId}:${o.want}`);
          expect(new Set(keys).size).toBe(keys.length);
          for (const o of today) expect(wantableResults(o.menuId)).toContain(o.want);
        }
        for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true });
        settleDay(g);
      }
    }
  });
  it('마지막 날 손님은 하룻밤 결과를 주문하지 않고, 대기 줄은 8명을 넘지 않는다', () => {
    for (let i = 0; i < 10; i++) {
      const g = game('grade3', 6, `e-${i}`);
      T(g).equipment.push('packaging');
      while (g.phase === 'open') {
        for (const t of Object.values(g.teams)) expect(t.customers.length).toBeLessThanOrEqual(8);
        if (g.day === g.daysTotal) for (const o of T(g).customers.filter((x) => x.arriveDay === g.day)) expect(resultReady(o.menuId, o.want)).toBe('now');
        for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true });
        settleDay(g);
      }
    }
  });
  it('보온 포장 세트가 있으면 포장 손님이 1명 더 온다', () => {
    const g = game();
    T(g).equipment.push('packaging');
    for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true });
    settleDay(g);
    expect(T(g).customers.filter((o) => o.takeout && o.arriveDay === 2).length).toBe(1);
    expect(T(g, 'T2').customers.filter((o) => o.takeout).length).toBe(0);
  });
  it('손님 생성은 결정적이다 (새로고침·재접속에도 같다)', () => {
    const a = game('grade3', 8, 'same');
    const b = game('grade3', 8, 'same');
    expect(JSON.stringify(a.teams['T1']!.customers)).toBe(JSON.stringify(b.teams['T1']!.customers));
  });
  it('손님은 온 날과 그다음 날까지 기다린다', () => {
    const g = game();
    const first = T(g).customers.map((o) => o.id);
    for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true });
    settleDay(g);
    expect(first.every((id) => T(g).customers.some((o) => o.id === id))).toBe(true);
    for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true });
    settleDay(g);
    expect(first.some((id) => T(g).customers.some((o) => o.id === id))).toBe(false);
  });
});

describe('날씨', () => {
  it('1일 차는 맑음, 같은 날씨가 3일 연속 없음', () => {
    for (let i = 0; i < 50; i++) {
      const w = generateWeather(`w-${i}`, 10);
      expect(w[0]).toBe('sunny');
      for (let d = 2; d < w.length; d++) expect(w[d] === w[d - 1] && w[d] === w[d - 2]).toBe(false);
    }
  });
  it('더운 날에는 3명 중 2명이 가능한 한 차가운 주문', () => {
    let hotDays = 0; let matched = 0;
    for (let i = 0; i < 30; i++) {
      const g = game('grade3', 8, `h-${i}`);
      while (g.phase === 'open') {
        const w = g.weather[g.day - 1];
        if (w === 'hot') { hotDays++; const today = T(g).customers.filter((o) => o.arriveDay === g.day && !o.takeout); if (today.filter((o) => (MENUS[o.menuId]!.results[o.want]!.temperature ?? MENUS[o.menuId]!.temperature) === 'cold').length >= 2) matched++; }
        for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true });
        settleDay(g);
      }
    }
    expect(hotDays).toBeGreaterThan(0);
    expect(matched / hotDays).toBeGreaterThan(0.9);
  });
});

describe('단체 주문', () => {
  it('3일 차와 마지막 전날에 하나씩, 장비 없는 서로 다른 메뉴, 팀마다 한 번', () => {
    const g = game('grade3', 8);
    expect(g.groupOrders.map((x) => x.openDay)).toEqual([3, 7]);
    expect(new Set(g.groupOrders.map((x) => x.menuId)).size).toBe(2);
    for (const go of g.groupOrders) { expect(MENUS[go.menuId]!.equipment).toBeNull(); expect(resultReady(go.menuId, go.want)).toBe('now'); expect(go.dueDay).toBe(go.openDay + 1); }
    while (g.day < 3) { for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true }); settleDay(g); }
    const go = g.groupOrders[0]!;
    const m = MENUS[go.menuId]!;
    const choice = m.choices.find((c) => c.result === go.want)!;
    const uses = choiceUses(go.menuId, choice.id);
    give(g, Object.fromEntries(Object.entries(uses).map(([k, v]) => [k, v * 2])));
    T(g).coins = 50;
    applyTeamCommand(g, 'T1', { type: 'make', menuId: go.menuId, choice: choice.id });
    expect(applyTeamCommand(g, 'T1', { type: 'serveGroup', groupOrderId: go.id, result: go.want }).ok).toBe(false);
    applyTeamCommand(g, 'T1', { type: 'make', menuId: go.menuId, choice: choice.id });
    const before = T(g).coins;
    const r = applyTeamCommand(g, 'T1', { type: 'serveGroup', groupOrderId: go.id, result: go.want });
    expect(r.ok).toBe(true);
    expect(r.paid).toBe(go.price * 4 + 4 + 6);
    expect(T(g).coins).toBe(before + go.price * 4 + 10);
    expect(applyTeamCommand(g, 'T1', { type: 'serveGroup', groupOrderId: go.id, result: go.want }).ok).toBe(false);
    expect(T(g, 'T2').groupDone.length).toBe(0);
  });
  it('6일 영업이면 3일 차와 5일 차', () => {
    const g = game('chem', 6);
    expect(g.groupOrders.map((x) => x.openDay)).toEqual([3, 5]);
  });
});

describe('정산과 순위', () => {
  it('정산 순서: 손님 제거 → 폐기 → 영수증 → 날짜 +1 → 새 손님 → 행동 3', () => {
    const g = game();
    give(g, { tea: 1 });
    applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M03', choice: 'hot' });
    for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true });
    settleDay(g);
    expect(g.day).toBe(2);
    expect(g.settleCount).toBe(1);
    expect(T(g).receipts.length).toBe(1);
    expect(T(g).receipts[0]!.ingredients).toBe(0);
    expect(T(g).actionsLeft).toBe(3);
    expect(T(g).ready).toBe(false);
    expect(T(g).customers.length).toBe(6);
  });
  it('마지막 날 정산이 끝나면 결과가 나오고 순이익·동점 처리가 맞다', () => {
    const g = game('grade1', 6, 'r', 3);
    T(g, 'T1').coins = 30; T(g, 'T2').coins = 30; T(g, 'T3').coins = 25;
    T(g, 'T2').served.push({ day: 1, menuId: 'M03', result: 'hot', servings: 2, stars: 3, group: false, paid: 8, takeout: false });
    T(g, 'T1').served.push({ day: 1, menuId: 'M03', result: 'hot', servings: 1, stars: 3, group: false, paid: 4, takeout: false });
    endEarly(g);
    expect(g.phase).toBe('finished');
    const res = g.results!;
    expect(res.map((r) => r.teamId)).toEqual(['T2', 'T1', 'T3']);
    expect(res[0]!.netProfit).toBe(10);
    expect(res[2]!.netProfit).toBe(5);
    expect(res[0]!.awards).toContain('별점왕');
    expect(res.every((r) => r.awards.includes('알뜰왕'))).toBe(true);
  });
  it('조기 종료는 그날을 마지막 날로 삼아 정산 한 번', () => {
    const g = game('grade1', 8);
    for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true });
    settleDay(g);
    endEarly(g);
    expect(g.daysTotal).toBe(2);
    expect(g.settleCount).toBe(2);
    expect(g.phase).toBe('finished');
  });
  it('계산 결과 함수는 평균 별점과 가장 많이 판 메뉴를 낸다', () => {
    const g = game();
    T(g).served.push({ day: 1, menuId: 'M03', result: 'hot', servings: 2, stars: 3, group: false, paid: 8, takeout: false }, { day: 1, menuId: 'M06', result: 'good', servings: 1, stars: 1, group: false, paid: 2, takeout: false });
    const r = computeResults(g).find((x) => x.teamId === 'T1')!;
    expect(r.avgStars).toBe(2);
    expect(r.topMenu).toEqual({ menuId: 'M03', servings: 2 });
    expect(r.scienceMenus).toEqual(['M03']);
  });
});

describe('막힘 방지와 메뉴판', () => {
  it('코인이 4보다 적고 재료·보관함이 비면 아침에 코인을 4로 채운다', () => {
    const g = game();
    T(g).coins = 1;
    for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true });
    settleDay(g);
    expect(T(g).coins).toBe(4);
    expect(T(g).today.aid).toBe(3);
    expect(T(g, 'T2').coins).toBe(20);
  });
  it('메뉴판 4종이 끝까지 진행된다', () => {
    for (const pid of PRESET_IDS) for (const days of [6, 8, 10]) {
      const g = game(pid, days, `p-${pid}-${days}`);
      let guard = 0;
      while (g.phase === 'open' && guard++ < 20) { for (const id of g.teamOrder) applyTeamCommand(g, id, { type: 'ready', on: true }); settleDay(g); }
      expect(g.phase).toBe('finished');
      expect(g.settleCount).toBe(days);
      expect(g.results!.length).toBe(2);
      for (const mid of PRESETS[pid].menus) expect(MENUS[mid]).toBeDefined();
    }
  });
});
