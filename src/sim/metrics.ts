import type { GameOutcome } from './runner';
import { BOT_IDS, type BotId } from './bots';

export function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
export const round2 = (x: number) => Math.round(x * 100) / 100;

export interface BotStat { n: number; netMean: number; netMedian: number; winRate: number; firstSaleDay1: number; served: number; avgStars: number; wasteRate: number }

/** 10.4 밸런스 목표 지표 */
export interface Summary {
  games: number;
  teamsPerGame: number;
  errors: number;
  byBot: Record<string, BotStat>;
  byPosition: Record<string, { n: number; winRate: number; netMean: number }>;
  /** 1일 차 첫 판매 비율 (random 제외) */
  firstSaleDay1Rate: number;
  /** 자리별 승률 최대−최소 (%p) */
  positionSpreadPct: number;
  /** expert 와 learner 순이익 중앙값 차이 (%) */
  expertVsLearnerPct: number;
  investorWinRate: number;
  frugalWinRate: number;
  /** 한 메뉴의 전체 매출 비중 (3학년 메뉴판) */
  dominantMenu: { menuId: string; share: number } | null;
  /** 3일 차까지 산 장비의 본전 회수 날 중앙값 */
  paybackMedian: number | null;
  paybackN: number;
  expertWasteRate: number;
  randomNetMedian: number;
  /** 목표 달성 여부 */
  targets: Record<string, { target: string; value: string; ok: boolean }>;
  objective: number;
}

export function summarize(outcomes: GameOutcome[], opts: { dominantPreset?: string } = {}): Summary {
  const valid = outcomes.filter((o) => o.teams.length);
  const byBot: Record<string, { nets: number[]; wins: number; day1: number; served: number[]; stars: number[]; made: number; waste: number }> = {};
  const byPos: Record<string, { n: number; wins: number; nets: number[] }> = {};
  const menuSales: Record<string, number> = {};
  let menuTotal = 0;
  const paybacks: number[] = [];
  for (const o of valid) {
    for (const t of o.teams) {
      const b = (byBot[t.bot] ??= { nets: [], wins: 0, day1: 0, served: [], stars: [], made: 0, waste: 0 });
      b.nets.push(t.netProfit); if (t.rank === 1) b.wins++; if (t.firstSaleDay === 1) b.day1++;
      b.served.push(t.servedServings); b.stars.push(t.avgStars); b.made += t.madeServings; b.waste += t.wasteServings;
      const p = (byPos[String(t.position)] ??= { n: 0, wins: 0, nets: [] });
      p.n++; if (t.rank === 1) p.wins++; p.nets.push(t.netProfit);
      if (!opts.dominantPreset || o.spec.presetId === opts.dominantPreset) for (const [m, v] of Object.entries(t.salesByMenu)) { menuSales[m] = (menuSales[m] ?? 0) + v; menuTotal += v; }
      for (const e of t.equipment) if (e.day <= 3 && e.paybackDays !== null) paybacks.push(e.paybackDays);
    }
  }
  const outBot: Record<string, BotStat> = {};
  for (const [k, v] of Object.entries(byBot)) outBot[k] = { n: v.nets.length, netMean: round2(mean(v.nets)), netMedian: median(v.nets), winRate: round2(v.wins / Math.max(1, v.nets.length)), firstSaleDay1: round2(v.day1 / Math.max(1, v.nets.length)), served: round2(mean(v.served)), avgStars: round2(mean(v.stars)), wasteRate: round2(v.waste / Math.max(1, v.made)) };
  const outPos: Summary['byPosition'] = {};
  for (const [k, v] of Object.entries(byPos)) outPos[k] = { n: v.n, winRate: round2(v.wins / v.n), netMean: round2(mean(v.nets)) };
  const nonRandom = BOT_IDS.filter((b) => b !== 'random' && byBot[b]);
  const day1Num = nonRandom.reduce((a, b) => a + byBot[b]!.day1, 0);
  const day1Den = nonRandom.reduce((a, b) => a + byBot[b]!.nets.length, 0);
  const firstSaleDay1Rate = day1Den ? day1Num / day1Den : 0;
  const posRates = Object.values(outPos).map((p) => p.winRate);
  const positionSpreadPct = posRates.length ? (Math.max(...posRates) - Math.min(...posRates)) * 100 : 0;
  const em = outBot['expert']?.netMedian ?? 0;
  const lm = outBot['learner']?.netMedian ?? 0;
  const expertVsLearnerPct = lm > 0 ? ((em - lm) / lm) * 100 : em > 0 ? 100 : 0;
  const investorWinRate = outBot['investor']?.winRate ?? 0;
  const frugalWinRate = outBot['frugal']?.winRate ?? 0;
  const dom = Object.entries(menuSales).sort((a, b) => b[1] - a[1])[0];
  const dominantMenu = dom ? { menuId: dom[0], share: round2(dom[1] / Math.max(1, menuTotal)) } : null;
  const paybackMedian = paybacks.length ? median(paybacks) : null;
  const expertWasteRate = outBot['expert']?.wasteRate ?? 0;
  const randomNetMedian = outBot['random']?.netMedian ?? 0;
  const errors = outcomes.reduce((a, o) => a + o.errors.length, 0);
  const ratio = Math.max(investorWinRate, frugalWinRate) / Math.max(0.001, Math.min(investorWinRate, frugalWinRate));
  const targets: Summary['targets'] = {
    errors: { target: '0건', value: String(errors), ok: errors === 0 },
    firstSaleDay1: { target: '95% 이상', value: `${(firstSaleDay1Rate * 100).toFixed(1)}%`, ok: firstSaleDay1Rate >= 0.95 },
    positionSpread: { target: '3%p 이하', value: `${positionSpreadPct.toFixed(1)}%p`, ok: positionSpreadPct <= 3 },
    expertVsLearner: { target: '15~35%', value: `${expertVsLearnerPct.toFixed(1)}% (expert ${em}, learner ${lm})`, ok: expertVsLearnerPct >= 15 && expertVsLearnerPct <= 35 },
    investorVsFrugal: { target: '어느 쪽도 2배 미만', value: `investor ${(investorWinRate * 100).toFixed(1)}% vs frugal ${(frugalWinRate * 100).toFixed(1)}% (비 ${ratio.toFixed(2)})`, ok: ratio <= 2 },
    dominantMenu: { target: '30% 이하 (3학년 메뉴판)', value: dominantMenu ? `${dominantMenu.menuId} ${(dominantMenu.share * 100).toFixed(1)}%` : '-', ok: !dominantMenu || dominantMenu.share <= 0.3 },
    payback: { target: '2~4일 (중앙값)', value: paybackMedian === null ? '-' : `${paybackMedian}일 (n=${paybacks.length})`, ok: paybackMedian !== null && paybackMedian >= 2 && paybackMedian <= 4 },
    expertWaste: { target: '15% 이하', value: `${(expertWasteRate * 100).toFixed(1)}%`, ok: expertWasteRate <= 0.15 },
    randomNet: { target: '0 근처 또는 음수', value: String(randomNetMedian), ok: randomNetMedian <= 5 },
  };
  const parts = [
    -Math.max(0, positionSpreadPct - 3) * 4,
    -Math.max(0, 0.95 - firstSaleDay1Rate) * 200,
    -(expertVsLearnerPct < 15 ? (15 - expertVsLearnerPct) * 1.5 : expertVsLearnerPct > 35 ? (expertVsLearnerPct - 35) * 1.5 : 0),
    -Math.max(0, ratio - 2) * 20,
    -(dominantMenu && dominantMenu.share > 0.3 ? (dominantMenu.share - 0.3) * 100 : 0),
    -(paybackMedian === null ? 10 : paybackMedian < 2 ? (2 - paybackMedian) * 8 : paybackMedian > 4 ? (paybackMedian - 4) * 8 : 0),
    -Math.max(0, expertWasteRate - 0.15) * 100,
    -Math.max(0, randomNetMedian - 5) * 1,
    -errors * 50,
  ];
  return {
    games: valid.length, teamsPerGame: valid[0]?.teams.length ?? 0, errors, byBot: outBot, byPosition: outPos,
    firstSaleDay1Rate: round2(firstSaleDay1Rate), positionSpreadPct: round2(positionSpreadPct), expertVsLearnerPct: round2(expertVsLearnerPct),
    investorWinRate, frugalWinRate, dominantMenu, paybackMedian, paybackN: paybacks.length, expertWasteRate: round2(expertWasteRate), randomNetMedian,
    targets, objective: round2(parts.reduce((a, b) => a + b, 0)),
  };
}

export const botLabel = (b: BotId) => b;
