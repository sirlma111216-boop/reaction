import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { EconomyConfig, PresetId } from '../shared/types';
import { DEFAULT_ECONOMY, cloneConfig } from '../shared/config/economy';
import { PRESET_IDS, DAY_OPTIONS, CONTENT_VERSION } from '../shared/content';
import { Rng } from '../shared/engine/rng';
import { runGame, type GameOutcome, type GameSpec } from './runner';
import { summarize, type Summary } from './metrics';
import { BOT_IDS } from './bots';

const REPORT_DIR = join(process.cwd(), 'reports', 'balance');
mkdirSync(REPORT_DIR, { recursive: true });
mkdirSync(join(REPORT_DIR, 'runs'), { recursive: true });

/**
 * paired seeds: 같은 시드에서 봇 5종을 자리 5개에 순환 배치한 5경기. 같은 손님 운을 모든 정책이 겪는다.
 * 자리 수를 봇 수와 같게 두어야 자리마다 모든 봇이 정확히 한 번씩 서고, 자리 효과를 봇 중복 없이 잴 수 있다.
 */
function pairedSpecs(seed: string, presetId: PresetId, days: number, config: EconomyConfig, teamCount = 5): GameSpec[] {
  const specs: GameSpec[] = [];
  for (let rot = 0; rot < BOT_IDS.length; rot++) {
    const teams = [];
    for (let pos = 0; pos < teamCount; pos++) teams.push({ bot: BOT_IDS[(pos + rot) % BOT_IDS.length]! });
    specs.push({ seed, presetId, days, teams, config });
  }
  return specs;
}

function runMany(seedPrefix: string, games: number, config: EconomyConfig, opts: { presets?: PresetId[]; days?: number[] } = {}): GameOutcome[] {
  const out: GameOutcome[] = [];
  const presets = opts.presets ?? PRESET_IDS;
  const days = opts.days ?? [...DAY_OPTIONS];
  let i = 0;
  while (out.length < games) {
    const preset = presets[i % presets.length]!;
    const d = days[Math.floor(i / presets.length) % days.length]!;
    for (const s of pairedSpecs(`${seedPrefix}-${i}`, preset, d, config)) { if (out.length >= games) break; out.push(runGame(s)); }
    i++;
  }
  return out;
}

function printSummary(title: string, s: Summary): void {
  console.log(`\n=== ${title} === 경기 ${s.games} (팀 ${s.teamsPerGame}/경기), 오류 ${s.errors}, objective ${s.objective}`);
  for (const [k, t] of Object.entries(s.targets)) console.log(`  ${t.ok ? '○' : '×'} ${k.padEnd(18)} 목표 ${t.target.padEnd(22)} 결과 ${t.value}`);
  for (const [b, v] of Object.entries(s.byBot)) console.log(`  ${b.padEnd(9)} n=${v.n} 순이익 평균 ${v.netMean} 중앙 ${v.netMedian} 승률 ${v.winRate} 1일차판매 ${v.firstSaleDay1} 인분 ${v.served} 별 ${v.avgStars} 폐기 ${v.wasteRate}`);
  for (const [p, v] of Object.entries(s.byPosition)) console.log(`  자리${p} n=${v.n} 승률 ${v.winRate} 순이익 ${v.netMean}`);
}

interface Report { title: string; when: string; seedPrefix: string; games: number; configVersion: string; contentVersion: string; summary: Summary; config: EconomyConfig; failures: string[]; elapsedMs: number }

function writeReport(name: string, r: Report): void {
  writeFileSync(join(REPORT_DIR, `${name}.json`), JSON.stringify(r, null, 2));
}

/** 조정 가능한 값만 흔든다 (10.4). 과학 내용·재료 구성·조건·행동 수·인분은 건드리지 않는다. */
function mutate(config: EconomyConfig, rng: Rng): { config: EconomyConfig; changes: string[] } {
  const c = cloneConfig(config);
  const changes: string[] = [];
  const n = 1 + rng.int(3);
  for (let i = 0; i < n; i++) {
    const kind = rng.int(8);
    const d = rng.next() < 0.5 ? -1 : 1;
    if (kind === 0) {
      const id = rng.pick(Object.keys(c.ingredientPrices));
      const nv = Math.max(1, Math.min(4, c.ingredientPrices[id]! + d));
      if (nv !== c.ingredientPrices[id]) { changes.push(`ingredient.${id} ${c.ingredientPrices[id]}→${nv}`); c.ingredientPrices[id] = nv; }
    } else if (kind === 1) {
      const id = rng.pick(Object.keys(c.equipmentPrices));
      const nv = Math.max(4, Math.min(14, c.equipmentPrices[id]! + d));
      if (nv !== c.equipmentPrices[id]) { changes.push(`equipment.${id} ${c.equipmentPrices[id]}→${nv}`); c.equipmentPrices[id] = nv; }
    } else if (kind === 2) {
      const id = rng.pick(Object.keys(c.menuPrices));
      const nv = Math.max(2, Math.min(12, c.menuPrices[id]! + d));
      if (nv !== c.menuPrices[id]) { changes.push(`menu.${id} ${c.menuPrices[id]}→${nv}`); c.menuPrices[id] = nv; }
    } else if (kind === 3) {
      const id = rng.pick(Object.keys(c.electricity).filter((k) => c.electricity[k]! > 0));
      const nv = Math.max(1, Math.min(3, c.electricity[id]! + d));
      if (nv !== c.electricity[id]) { changes.push(`electricity.${id} ${c.electricity[id]}→${nv}`); c.electricity[id] = nv; }
    } else if (kind === 4) {
      const nv = Math.max(12, Math.min(30, c.startCoins + d * 2));
      if (nv !== c.startCoins) { changes.push(`startCoins ${c.startCoins}→${nv}`); c.startCoins = nv; }
    } else if (kind === 5) {
      const nv = Math.max(0, Math.min(3, c.tipPerServing + d));
      if (nv !== c.tipPerServing) { changes.push(`tipPerServing ${c.tipPerServing}→${nv}`); c.tipPerServing = nv; }
    } else if (kind === 6) {
      const nv = Math.max(2, Math.min(10, c.groupBonus + d * 2));
      if (nv !== c.groupBonus) { changes.push(`groupBonus ${c.groupBonus}→${nv}`); c.groupBonus = nv; }
    } else {
      const nv = Math.max(0.3, Math.min(0.9, Math.round((c.twoServingRate + d * 0.1) * 10) / 10));
      if (nv !== c.twoServingRate) { changes.push(`twoServingRate ${c.twoServingRate}→${nv}`); c.twoServingRate = nv; }
    }
  }
  return { config: c, changes };
}

function collectFailures(outs: GameOutcome[], limit = 20): string[] {
  const f: string[] = [];
  for (const o of outs) for (const e of o.errors) { if (f.length >= limit) return f; f.push(`${o.spec.seed} ${o.spec.presetId}/${o.spec.days}일: ${e.split('\n')[0]}`); }
  return f;
}

const cmd = process.argv[2] ?? 'smoke';
const argNum = (name: string, def: number) => { const i = process.argv.indexOf(name); return i >= 0 ? Number(process.argv[i + 1]) : def; };

if (cmd === 'smoke') {
  // 메뉴판 4종 × 영업일 3종을 돌아가며 100경기 완주와 예외를 점검한다
  const games = argNum('--games', 100);
  const t0 = Date.now();
  const outs = runMany('smoke', games, DEFAULT_ECONOMY);
  const s = summarize(outs, { dominantPreset: 'grade3' });
  printSummary('SMOKE', s);
  const failures = collectFailures(outs);
  for (const f of failures) console.log('  실패:', f);
  const byKey: Record<string, number> = {};
  for (const o of outs) { const k = `${o.spec.presetId}/${o.spec.days}일`; byKey[k] = (byKey[k] ?? 0) + 1; }
  console.log('메뉴판·영업일별 경기 수:', byKey, `소요 ${Date.now() - t0}ms`);
  writeReport('smoke', { title: 'smoke', when: new Date().toISOString(), seedPrefix: 'smoke', games: outs.length, configVersion: DEFAULT_ECONOMY.version, contentVersion: CONTENT_VERSION, summary: s, config: DEFAULT_ECONOMY, failures, elapsedMs: Date.now() - t0 });
  if (s.errors) process.exit(1);
} else if (cmd === 'balance') {
  const games = argNum('--games', 600);
  const candGames = argNum('--cand', Math.max(200, Math.floor(games / 3)));
  const loops = argNum('--loops', 12);
  const t0 = Date.now();
  console.log(`기준선 ${games}경기 (학습 시드 train-*) ...`);
  const baseOuts = runMany('train', games, DEFAULT_ECONOMY);
  const base = summarize(baseOuts, { dominantPreset: 'grade3' });
  printSummary('BASELINE', base);
  writeReport('baseline', { title: 'baseline', when: new Date().toISOString(), seedPrefix: 'train', games: baseOuts.length, configVersion: DEFAULT_ECONOMY.version, contentVersion: CONTENT_VERSION, summary: base, config: DEFAULT_ECONOMY, failures: collectFailures(baseOuts), elapsedMs: Date.now() - t0 });
  let bestConfig = DEFAULT_ECONOMY;
  let bestScore = base.objective;
  const history: { loop: number; changes: string[]; objective: number; accepted: boolean }[] = [];
  const rng = new Rng('balance-search');
  for (let loop = 1; loop <= loops; loop++) {
    const { config, changes } = mutate(bestConfig, rng);
    if (!changes.length) continue;
    const outs = runMany(`train-c${loop}`, candGames, config);
    const s = summarize(outs, { dominantPreset: 'grade3' });
    const accepted = s.errors === 0 && s.objective > bestScore + 0.5;
    history.push({ loop, changes, objective: s.objective, accepted });
    console.log(`후보 ${loop}: ${changes.join(', ')} → objective ${s.objective} (기준 ${bestScore}) ${accepted ? '채택' : '기각'}`);
    writeReport(`candidate-${loop}`, { title: `candidate-${loop}: ${changes.join(', ')}`, when: new Date().toISOString(), seedPrefix: `train-c${loop}`, games: outs.length, configVersion: `${config.version}+c${loop}`, contentVersion: CONTENT_VERSION, summary: s, config, failures: collectFailures(outs), elapsedMs: Date.now() - t0 });
    if (accepted) { bestConfig = cloneConfig(config); bestConfig.version = `${DEFAULT_ECONOMY.version}+c${loop}`; bestScore = s.objective; }
  }
  const elapsed = Date.now() - t0;
  writeFileSync(join(REPORT_DIR, 'search-history.json'), JSON.stringify({ baseline: base.objective, history, selectedVersion: bestConfig.version, elapsedMs: elapsed }, null, 2));
  writeReport('selected', { title: 'selected (학습 시드 기준, 검증 전)', when: new Date().toISOString(), seedPrefix: 'train', games, configVersion: bestConfig.version, contentVersion: CONTENT_VERSION, summary: base, config: bestConfig, failures: [], elapsedMs: elapsed });
  console.log(`\n선택된 설정: ${bestConfig.version} (objective ${bestScore}), 총 소요 ${Math.round(elapsed / 1000)}s. 검증은 npm run sim:validate 로 실행.`);
} else if (cmd === 'validate') {
  const games = argNum('--games', 2000);
  const t0 = Date.now();
  const selectedPath = join(REPORT_DIR, 'selected.json');
  const useSelected = process.argv.includes('--selected');
  const config = useSelected && existsSync(selectedPath) ? (JSON.parse(readFileSync(selectedPath, 'utf8')) as Report).config : DEFAULT_ECONOMY;
  console.log(`검증 ${games}경기 (검증 시드 valid-*, 설정 ${config.version}) ...`);
  const outs = runMany('valid', games, config);
  const s = summarize(outs, { dominantPreset: 'grade3' });
  printSummary('VALIDATE', s);
  const failures = collectFailures(outs);
  const report: Report = { title: 'final validation', when: new Date().toISOString(), seedPrefix: 'valid', games: outs.length, configVersion: config.version, contentVersion: CONTENT_VERSION, summary: s, config, failures, elapsedMs: Date.now() - t0 };
  writeReport('final', report);
  const byPreset: Record<string, Summary> = {};
  for (const p of PRESET_IDS) byPreset[p] = summarize(outs.filter((o) => o.spec.presetId === p), { dominantPreset: p });
  const byDays: Record<string, Summary> = {};
  for (const d of DAY_OPTIONS) byDays[String(d)] = summarize(outs.filter((o) => o.spec.days === d), { dominantPreset: 'grade3' });
  writeFileSync(join(REPORT_DIR, 'BALANCE_REPORT.md'), renderMarkdown(report, byPreset, byDays));
  console.log(`보고서: reports/balance/final.json, BALANCE_REPORT.md (소요 ${Date.now() - t0}ms)`);
  if (s.errors) process.exit(1);
} else if (cmd === 'replay') {
  const file = process.argv[3];
  if (!file) { console.error('사용법: npm run sim:replay -- <replay.json>'); process.exit(2); }
  const spec = JSON.parse(readFileSync(file, 'utf8')) as GameSpec;
  const out = runGame(spec, { verbose: true, keepState: true });
  console.log(JSON.stringify({ teams: out.teams, errors: out.errors }, null, 2));
  if (out.finalState) writeFileSync(join(REPORT_DIR, 'runs', 'replay-final-state.json'), JSON.stringify(out.finalState, null, 2));
} else {
  console.error('알 수 없는 명령:', cmd);
  process.exit(2);
}

function renderMarkdown(r: Report, byPreset: Record<string, Summary>, byDays: Record<string, Summary>): string {
  const s = r.summary;
  const L: string[] = [];
  L.push('# 밸런스 보고서 (실제 실행 결과)', '');
  L.push(`- 생성 시각: ${r.when}`);
  L.push(`- 경제 설정 버전: ${r.configVersion}, 콘텐츠 버전: ${r.contentVersion}`);
  L.push(`- 검증 경기 수: ${r.games} (검증 시드 접두사 \`${r.seedPrefix}-*\`, 학습 시드 \`train-*\` 와 분리), 팀 ${s.teamsPerGame}/경기, 소요 ${Math.round(r.elapsedMs / 1000)}s`);
  L.push(`- 오류·음수 코인·음수 재고: ${s.errors}건`);
  L.push('- 정책 봇 5종(expert·learner·investor·frugal·random)을 paired seeds 로 자리 5개에 순환 배치(시드당 5경기). 손님은 (시드, 날짜, 팀)으로 정해지므로 같은 운을 모든 정책이 겪는다. 봇은 학생과 같은 명령 검증을 거치며 다른 팀의 비공개 정보나 미래의 손님을 보지 않는다.');
  L.push('- 메뉴판 4종 × 영업일 6·8·10일을 돌아가며 섞었다.', '');
  L.push('## 10.4 밸런스 목표', '', '| 지표 | 목표 | 결과 | 달성 |', '|---|---|---|---|');
  const names: Record<string, string> = { errors: '오류, 음수 코인, 음수 재고', firstSaleDay1: '1일 차 첫 판매 비율 (random 제외)', positionSpread: '자리에 따른 승률 차이', expertVsLearner: 'expert 와 learner 순이익 중앙값 차이', investorVsFrugal: 'investor 와 frugal 승률', dominantMenu: '한 메뉴의 매출 비중 (3학년 메뉴판)', payback: '3일 차까지 산 장비의 본전 회수 날', expertWaste: 'expert 폐기 비율', randomNet: 'random 순이익 중앙값' };
  for (const [k, t] of Object.entries(s.targets)) L.push(`| ${names[k] ?? k} | ${t.target} | ${t.value} | ${t.ok ? '달성' : '미달'} |`);
  L.push('', '## 정책별', '', '| 봇 | n | 순이익 평균 | 순이익 중앙 | 승률 | 1일 차 판매 | 낸 인분 | 평균 별점 | 폐기 비율 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const [b, v] of Object.entries(s.byBot)) L.push(`| ${b} | ${v.n} | ${v.netMean} | ${v.netMedian} | ${v.winRate} | ${v.firstSaleDay1} | ${v.served} | ${v.avgStars} | ${v.wasteRate} |`);
  L.push('', '## 자리별', '', '| 자리 | n | 승률 | 순이익 평균 |', '|---|---:|---:|---:|');
  for (const [p, v] of Object.entries(s.byPosition)) L.push(`| ${p} | ${v.n} | ${v.winRate} | ${v.netMean} |`);
  L.push('', '## 메뉴판별 (분리 요인)', '', '| 메뉴판 | 경기 | expert 중앙 | learner 중앙 | investor 승률 | frugal 승률 | random 중앙 | 지배 메뉴 | 1일 차 판매 |', '|---|---:|---:|---:|---:|---:|---:|---|---:|');
  for (const [p, v] of Object.entries(byPreset)) L.push(`| ${p} | ${v.games} | ${v.byBot['expert']?.netMedian ?? '-'} | ${v.byBot['learner']?.netMedian ?? '-'} | ${v.investorWinRate} | ${v.frugalWinRate} | ${v.randomNetMedian} | ${v.dominantMenu ? `${v.dominantMenu.menuId} ${(v.dominantMenu.share * 100).toFixed(0)}%` : '-'} | ${(v.firstSaleDay1Rate * 100).toFixed(0)}% |`);
  L.push('', '## 영업일별 (분리 요인)', '', '| 영업일 | 경기 | expert 중앙 | learner 중앙 | investor 승률 | frugal 승률 | 본전 회수 중앙 |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const [d, v] of Object.entries(byDays)) L.push(`| ${d}일 | ${v.games} | ${v.byBot['expert']?.netMedian ?? '-'} | ${v.byBot['learner']?.netMedian ?? '-'} | ${v.investorWinRate} | ${v.frugalWinRate} | ${v.paybackMedian ?? '-'} |`);
  L.push('', '## 해석과 미해결 사항', '');
  L.push('- 봇의 승률이 비슷하다고 해서 학생에게 재미있다는 뜻은 아니다. 사람 플레이테스트는 하지 않았다.');
  L.push('- 봇은 자기 팀의 정보만 쓰며 서버 상태나 미래의 손님을 보지 않는다. 최적해 상한은 만들지 않았다.');
  L.push('- 실패 경기 목록: ' + (r.failures.length ? r.failures.join('; ') : '없음'));
  L.push('- 재실행: `npm run sim:balance` (학습) → `npm run sim:validate` (검증). 설정을 바꾸면 `src/shared/config/economy.ts` 를 수정하고 다시 실행한다.');
  return L.join('\n');
}
