import { describe, expect, it } from 'vitest';
import type { GameState, TeamState } from '../src/shared/types';
import { createGame, newId, TEAM_COLORS } from '../src/shared/engine/state';
import { startGame, settleDay } from '../src/shared/engine/phases';
import { applyTeamCommand } from '../src/shared/engine/commands';
import { projectGame } from '../src/shared/projection';

/** 방(Durable Object)이 저장하는 방식과 같게 core 와 팀을 나눠 저장했다가 다시 합친다 */
function saveAndRestore(g: GameState): GameState {
  const { teams, ...core } = g;
  const stored: Record<string, string> = { 'game:core': JSON.stringify(core) };
  for (const [id, t] of Object.entries(teams)) stored[`game:team:${id}`] = JSON.stringify(t);
  const c = JSON.parse(stored['game:core']!) as Omit<GameState, 'teams'>;
  const map: Record<string, TeamState> = {};
  for (const id of c.teamOrder) map[id] = JSON.parse(stored[`game:team:${id}`]!) as TeamState;
  return { ...c, teams: map };
}

/** 키 순서에 상관없이 비교 */
function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, val) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.keys(val as object).sort().map((k) => [k, (val as Record<string, unknown>)[k]])) : val));
}

describe('저장 후 복원', () => {
  it('ID 카운터가 상태 안에 있어 복원 뒤에도 ID 가 겹치지 않는다', () => {
    const g = createGame({ seed: 's', presetId: 'grade3', daysTotal: 8, teams: [{ id: 'T1', name: 'a', color: TEAM_COLORS[0]!, mascot: 'mascot-cat' }] });
    startGame(g);
    g.teams['T1']!.stock['tea'] = 2;
    applyTeamCommand(g, 'T1', { type: 'make', menuId: 'M03', choice: 'hot' });
    const before = new Set<string>([...g.teams['T1']!.customers.map((o) => o.id), ...g.teams['T1']!.products.map((p) => p.id), ...g.groupOrders.map((x) => x.id)]);
    const r = saveAndRestore(g);
    expect(r.nextId).toBe(g.nextId);
    applyTeamCommand(r, 'T1', { type: 'make', menuId: 'M03', choice: 'cold' });
    applyTeamCommand(r, 'T1', { type: 'ready', on: true });
    settleDay(r);
    // 복원 뒤에 새로 만들어진 ID(하룻밤 음식, 2일 차 손님)는 이전 ID 와 겹치지 않는다
    const fresh = [...r.teams['T1']!.customers.filter((o) => o.arriveDay === 2).map((o) => o.id), ...r.teams['T1']!.products.filter((p) => p.result === 'coldbrew').map((p) => p.id)];
    expect(fresh.length).toBeGreaterThan(0);
    for (const id of fresh) expect(before.has(id)).toBe(false);
    expect(new Set(fresh).size).toBe(fresh.length);
    expect(newId(r, 'X')).toBe(`X${g.nextId + fresh.length}`);
  });
  it('복원한 상태로 이어서 진행해도 같은 시드의 연속 진행과 같다', () => {
    const make = () => { const g = createGame({ seed: 'same', presetId: 'grade2', daysTotal: 6, teams: [{ id: 'T1', name: 'a', color: TEAM_COLORS[0]!, mascot: 'mascot-cat' }, { id: 'T2', name: 'b', color: TEAM_COLORS[1]!, mascot: 'mascot-dog' }] }); startGame(g); return g; };
    const a = make();
    let b = make();
    for (let d = 0; d < 3; d++) {
      for (const id of a.teamOrder) applyTeamCommand(a, id, { type: 'ready', on: true });
      settleDay(a);
      b = saveAndRestore(b);
      for (const id of b.teamOrder) applyTeamCommand(b, id, { type: 'ready', on: true });
      settleDay(b);
    }
    expect(canonical(a)).toBe(canonical(b));
  });
  it('투영에는 다른 팀의 비공개 정보와 미래 날씨가 없다', () => {
    const g = createGame({ seed: 'p', presetId: 'grade3', daysTotal: 8, teams: [{ id: 'T1', name: 'a', color: TEAM_COLORS[0]!, mascot: 'mascot-cat' }, { id: 'T2', name: 'b', color: TEAM_COLORS[1]!, mascot: 'mascot-dog' }] });
    startGame(g);
    const v = projectGame(g, 'T1');
    expect(v.myTeam?.id).toBe('T1');
    const text = JSON.stringify(v);
    expect(text.includes(g.teams['T2']!.customers[0]!.id)).toBe(false);
    expect(v.weatherTomorrow).toBe(g.weather[1]);
    expect((v as unknown as { weather?: unknown }).weather).toBeUndefined();
  });
});
