/**
 * 콘텐츠 자동 검사 (6.5): npm run verify:content
 * - 화면에 쓰이는 모든 문자열에 6.2 의 용어가 없다 (「열평형」은 허용. 「몰」은 단위로 쓰인 경우만 잡는다)
 * - 메뉴판의 모든 메뉴에 대해 재료가 4.1 표에 있고 필요한 장비가 그 메뉴판의 장비 목록에 있다
 * - 모든 선택지에 결과 키·결과 이름·「왜 그럴까?」 문장이 있다
 * - 손님 말이 있는 결과는 (실패)가 아니고, 그 결과를 만드는 선택지가 있다
 * - 데이터가 가리키는 그림·소리 ID 가 8절 목록에 있다
 * - 1일 차에 시작 코인만으로 만들 수 있는 메뉴가 메뉴판마다 2종 이상 있다
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AUDIO_IDS, CUSTOMER_CHARACTERS, EQUIPMENT, EXTRA_CARDS, GAS_STOVE, GROUP_CUSTOMER, IMAGE_IDS, INGREDIENTS, MASCOTS, MENUS, PRESETS, PRESET_IDS, TAKEOUT_CUSTOMER, WEATHER_IMAGE } from '../src/shared/content';
import { DEFAULT_ECONOMY } from '../src/shared/config/economy';

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

// ---------- 1. 금지 용어 ----------
const FORBIDDEN = ['엔탈피', '촉매', '화학 평형', '화학평형', '산화수', '환원', '중화', 'pH', '지시약', '어는점 내림', '어는점내림', '삼투', '이온화', '전자 이동', '전자이동', '발효', '유화', '단백질 변성', '마이야르', '앙금', '불꽃 반응', '불꽃반응', '크로마토그래피', '보일 법칙', '보일법칙', '샤를 법칙', '샤를법칙', '일정 성분비', '일정성분비'];
/** 「몰」은 단위로 쓰인 경우만: 숫자 뒤의 몰, 몰 농도, 몰 질량, mol 단위 */
const MOL_PATTERNS = [/\d\s*몰(?![라-힣])/u, /몰\s*(농도|질량|수|비)/u, /\bmol\b/i];

function collectStrings(dir: string, out: { file: string; text: string }[]): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { collectStrings(p, out); continue; }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    out.push({ file: p, text: readFileSync(p, 'utf8') });
  }
}
const sources: { file: string; text: string }[] = [];
collectStrings(join(process.cwd(), 'src', 'client'), sources);
collectStrings(join(process.cwd(), 'src', 'shared', 'content'), sources);
collectStrings(join(process.cwd(), 'src', 'worker'), sources);
for (const s of sources) {
  const lines = s.text.split('\n');
  lines.forEach((line, i) => {
    // 주석은 화면에 나오지 않는다
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    for (const term of FORBIDDEN) if (code.includes(term)) fail(`금지 용어 「${term}」: ${s.file}:${i + 1}`);
    for (const re of MOL_PATTERNS) if (re.test(code)) fail(`금지 용어 「몰(단위)」: ${s.file}:${i + 1}`);
  });
}

// ---------- 2. 메뉴판·재료·장비 ----------
for (const pid of PRESET_IDS) {
  const preset = PRESETS[pid];
  for (const mid of preset.menus) {
    const m = MENUS[mid];
    if (!m) { fail(`${pid}: 없는 메뉴 ${mid}`); continue; }
    for (const ing of Object.keys(m.ingredients)) if (!INGREDIENTS[ing]) fail(`${mid}: 4.1 표에 없는 재료 ${ing}`);
    if (m.equipment && !preset.equipment.includes(m.equipment)) fail(`${pid}: ${mid} 에 필요한 장비 ${m.equipment} 가 메뉴판 장비 목록에 없음`);
    if (m.equipment && !EQUIPMENT[m.equipment]) fail(`${mid}: 없는 장비 ${m.equipment}`);
  }
  for (const eq of preset.equipment) if (!EQUIPMENT[eq]) fail(`${pid}: 없는 장비 ${eq}`);
}

// ---------- 3. 선택지·결과·손님 말 ----------
for (const m of Object.values(MENUS)) {
  if (!m.choices.length) fail(`${m.id}: 선택지가 없음`);
  for (const c of m.choices) {
    const r = m.results[c.result];
    if (!r) { fail(`${m.id}: 선택지 ${c.id} 의 결과 키 ${c.result} 가 없음`); continue; }
    if (!r.name) fail(`${m.id}/${c.result}: 결과 이름 없음`);
    if (!r.why) fail(`${m.id}/${c.result}: 「왜 그럴까?」 없음`);
    if (!c.label) fail(`${m.id}/${c.id}: 선택지 글 없음`);
    if (c.uses) for (const ing of Object.keys(c.uses)) if (!(ing in m.ingredients)) fail(`${m.id}/${c.id}: 메뉴 재료에 없는 ${ing} 사용`);
  }
  for (const r of Object.values(m.results)) {
    if (r.customerLine && r.fail) fail(`${m.id}/${r.key}: (실패) 결과에 손님 말이 있음`);
    if (r.customerLine && !m.choices.some((c) => c.result === r.key)) fail(`${m.id}/${r.key}: 손님 말이 있지만 만드는 선택지가 없음`);
    if (!r.fail && !r.customerLine) fail(`${m.id}/${r.key}: (실패) 아닌 결과에 손님 말이 없음`);
    if (!m.choices.some((c) => c.result === r.key)) fail(`${m.id}/${r.key}: 어떤 선택지도 만들지 않는 결과`);
  }
  if (!m.principle || !m.question) fail(`${m.id}: 원리 한 줄 또는 질문 없음`);
  if (m.ui.kind === 'two') {
    const combos = m.ui.questions[0]!.options.flatMap((a) => m.ui.kind === 'two' ? m.ui.questions[1]!.options.map((b) => `${a.id}+${b.id}`) : []);
    for (const id of combos) if (!m.choices.some((c) => c.id === id)) fail(`${m.id}: 조합 ${id} 에 해당하는 선택지가 없음`);
  }
  if (m.ui.kind === 'order') {
    const ids = m.ui.liquids.map((l) => l.ingredientId);
    const perms: string[] = [];
    const go = (rest: string[], acc: string[]) => { if (!rest.length) { perms.push(acc.join('>')); return; } for (const x of rest) go(rest.filter((y) => y !== x), [...acc, x]); };
    go(ids, []);
    for (const p of perms) if (!m.choices.some((c) => c.id === p)) fail(`${m.id}: 순서 ${p} 에 해당하는 선택지가 없음`);
  }
  // ---------- 4. 그림·소리 ID ----------
  if (!IMAGE_IDS.has(m.image)) fail(`${m.id}: 대표 그림 ${m.image} 가 8절 목록에 없음`);
  if (!IMAGE_IDS.has(`principle-${m.id.toLowerCase()}`)) fail(`${m.id}: 원리 장면 그림이 8절 목록에 없음`);
  if (!AUDIO_IDS.has(m.sfx)) fail(`${m.id}: 효과음 ${m.sfx} 가 8절 목록에 없음`);
}
for (const i of Object.values(INGREDIENTS)) if (!IMAGE_IDS.has(i.image)) fail(`재료 ${i.id}: 그림 ${i.image} 없음`);
for (const e of Object.values(EQUIPMENT)) if (!IMAGE_IDS.has(e.image)) fail(`장비 ${e.id}: 그림 ${e.image} 없음`);
if (!IMAGE_IDS.has(GAS_STOVE.image)) fail('가스레인지 그림 없음');
for (const c of EXTRA_CARDS) if (!IMAGE_IDS.has(c.image)) fail(`추가 카드 ${c.id}: 그림 ${c.image} 없음`);
for (const c of [...CUSTOMER_CHARACTERS, TAKEOUT_CUSTOMER, GROUP_CUSTOMER]) if (!IMAGE_IDS.has(c.id)) fail(`손님 그림 ${c.id} 없음`);
for (const m of MASCOTS) if (!IMAGE_IDS.has(m.id)) fail(`마스코트 그림 ${m.id} 없음`);
for (const w of Object.values(WEATHER_IMAGE)) if (!IMAGE_IDS.has(w)) fail(`날씨 그림 ${w} 없음`);
if (IMAGE_IDS.size !== 96) fail(`그림 자산은 96개여야 하는데 ${IMAGE_IDS.size}개`);
if (AUDIO_IDS.size !== 35) fail(`소리 자산은 35개여야 하는데 ${AUDIO_IDS.size}개`);

// ---------- 5. 1일 차에 시작 코인만으로 만들 수 있는 메뉴 ----------
for (const pid of PRESET_IDS) {
  const ok = PRESETS[pid].menus.filter((mid) => {
    const m = MENUS[mid]!;
    if (m.equipment) return false;
    const cost = Object.entries(m.ingredients).reduce((a, [id, u]) => a + u * (DEFAULT_ECONOMY.ingredientPrices[id] ?? 0), 0) + (DEFAULT_ECONOMY.electricity[mid] ?? 0);
    return cost <= DEFAULT_ECONOMY.startCoins;
  });
  if (ok.length < 2) fail(`${pid}: 1일 차에 시작 코인만으로 만들 수 있는 메뉴가 ${ok.length}종 (2종 이상 필요)`);
}

if (errors.length) {
  console.error(`콘텐츠 검사 실패 ${errors.length}건`);
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}
console.log(`콘텐츠 검사 통과: 메뉴 ${Object.keys(MENUS).length}종, 선택지 ${Object.values(MENUS).reduce((a, m) => a + m.choices.length, 0)}개, 메뉴판 ${PRESET_IDS.length}종, 그림 ID ${IMAGE_IDS.size}개, 소리 ID ${AUDIO_IDS.size}개, 검사한 파일 ${sources.length}개`);
