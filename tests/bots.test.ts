import { describe, expect, it } from 'vitest';
import { runGame } from '../src/sim/runner';
import { BOT_IDS } from '../src/sim/bots';
import { PRESET_IDS } from '../src/shared/content';

describe('시뮬레이터', () => {
  it('봇 5종이 메뉴판 4종에서 오류 없이 완주한다', () => {
    for (const presetId of PRESET_IDS) {
      const out = runGame({ seed: `bots-${presetId}`, presetId, days: 6, teams: BOT_IDS.map((bot) => ({ bot })) });
      expect(out.errors).toEqual([]);
      expect(out.teams.length).toBe(5);
      for (const t of out.teams) expect(Number.isFinite(t.netProfit)).toBe(true);
    }
  });
  it('같은 시드면 결과가 같다', () => {
    const spec = { seed: 'rep', presetId: 'grade3' as const, days: 8, teams: BOT_IDS.map((bot) => ({ bot })) };
    expect(JSON.stringify(runGame(spec).teams)).toBe(JSON.stringify(runGame(spec).teams));
  });
});
