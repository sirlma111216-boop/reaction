/**
 * 실서버(wrangler dev 또는 배포 URL) 통합 테스트.
 * 교사 로그인 → 방 생성 → 학생 N명 입장 → 팀장 임명 → 카페 생성·가입 → 시작 →
 * 점장 아닌 학생의 명령 거절, 중복 명령 ID, 재접속 복구, 다른 팀 비공개 정보 미전송, 잠시 멈춤, 팀 건너뛰기, 동시 마감에서 정산 1회 → 마지막 날까지 완주.
 * 사용: node scripts/e2e-ws.mjs [baseUrl] [students] [full=1]   (교사 아이디·비밀번호는 환경 변수 TEACHER_ID·TEACHER_PASSWORD)
 */
const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const STUDENTS = Number(process.argv[3] ?? 30);
const FULL = (process.argv[4] ?? '1') === '1';
const TEAMS = Math.min(6, Math.max(2, Math.floor(STUDENTS / 5)));
const wsBase = base.replace(/^http/, 'ws');
const PASSWORD = process.env.TEACHER_PASSWORD ?? '';
const TEACHER_ID = process.env.TEACHER_ID ?? 'teacher';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '○' : '×'} ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, init = {}) {
  const res = await fetch(base + path, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

class Client {
  constructor(name, code, token) {
    this.name = name; this.code = code; this.token = token; this.view = null; this.pending = new Map(); this.seq = 0; this.toasts = [];
    this.open();
  }
  open() {
    this.ws = new WebSocket(`${wsBase}/ws?room=${this.code}&token=${encodeURIComponent(this.token)}`);
    this.ready = new Promise((resolve, reject) => { this.ws.onopen = () => resolve(); this.ws.onerror = () => reject(new Error('ws error')); });
    this.ready.catch(() => {});
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === 'view') this.view = m.view;
      else if (m.type === 'ack') { const p = this.pending.get(m.id); if (p) { this.pending.delete(m.id); p(m); } }
      else if (m.type === 'toast') this.toasts.push(m.text);
    };
    this.closed = new Promise((resolve) => { this.ws.onclose = (ev) => resolve(ev.code); });
  }
  send(cmd, id) {
    const cid = id ?? `${this.name}-${++this.seq}`;
    return new Promise((resolve) => { this.pending.set(cid, resolve); this.ws.send(JSON.stringify({ type: 'cmd', id: cid, cmd })); setTimeout(() => { if (this.pending.has(cid)) { this.pending.delete(cid); resolve({ ok: false, error: 'timeout' }); } }, 15000); });
  }
  team(cmd, id) { return this.send({ type: 'team', cmd }, id); }
  async waitView(pred, ms = 10000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (this.view && pred(this.view)) return this.view; await sleep(80); }
    throw new Error(`waitView timeout (${this.name})`);
  }
  close() { this.ws.close(); }
}

(async () => {
  const t0 = Date.now();
  if (!PASSWORD) { console.error('TEACHER_PASSWORD 환경 변수가 필요합니다 (.dev.vars 와 같은 값).'); process.exit(2); }
  const health = await api('/api/health');
  check('서버 응답', health.status === 200 && health.data.teacherReady === true, health.data.teacherReady ? '' : '교사 비밀번호 미설정');
  const bad = await api('/api/teacher/login', { method: 'POST', body: JSON.stringify({ id: TEACHER_ID, password: 'wrong-' + PASSWORD }) });
  check('잘못된 비밀번호 거절', bad.status === 401);
  const login = await api('/api/teacher/login', { method: 'POST', body: JSON.stringify({ id: TEACHER_ID, password: PASSWORD }) });
  check('교사 로그인', login.status === 200 && !!login.data.teacherKey);
  const key = login.data.teacherKey;
  check('교사 키 없이 방 생성 거절', (await api('/api/rooms', { method: 'POST', body: JSON.stringify({}) })).status === 401);
  const room = await api('/api/rooms', { method: 'POST', headers: { 'x-teacher-key': key }, body: JSON.stringify({ nick: '김선생', presetId: 'grade3', days: 6 }) });
  check('방 생성', room.status === 200 && /^[A-Z0-9]{6}$/.test(room.data.code ?? ''), room.data.code);
  const code = room.data.code;
  const info = await api(`/api/rooms/${code}`);
  check('방 정보 (메뉴판·영업일)', info.data.presetId === 'grade3' && info.data.days === 6);
  const teacher = new Client('teacher', code, room.data.teacherToken);
  await teacher.ready;
  await teacher.waitView((v) => v.me.role === 'teacher');
  check('교사 WS 연결·투영', teacher.view.me.role === 'teacher' && teacher.view.room.code === code);
  const students = [];
  for (let i = 0; i < STUDENTS; i++) {
    const j = await api(`/api/rooms/${code}/join`, { method: 'POST', body: JSON.stringify({ nick: `학생${i + 1}` }) });
    if (j.status !== 200) { check(`학생${i + 1} 입장`, false, JSON.stringify(j.data)); continue; }
    const c = new Client(`s${i + 1}`, code, j.data.token); c.playerId = j.data.playerId; students.push(c);
  }
  await Promise.all(students.map((s) => s.ready));
  check('중복 닉네임 거절', (await api(`/api/rooms/${code}/join`, { method: 'POST', body: JSON.stringify({ nick: '학생1' }) })).status === 409);
  const badTok = new Client('bad', code, 'not-a-token');
  const badCode = await badTok.closed.catch(() => 0);
  check('잘못된 토큰 WS 거절', badCode !== 1000 && badCode !== undefined);
  await teacher.waitView((v) => v.players.length >= STUDENTS + 1);
  check(`학생 ${STUDENTS}명 입장 확인`, teacher.view.players.filter((p) => p.role === 'student').length === STUDENTS);
  const s1 = students[0];
  await s1.waitView((v) => !!v.me.playerId);
  check('학생의 교사 명령 거절', !(await s1.send({ type: 'start' })).ok);
  check('임명 안 된 학생의 카페 생성 거절', !(await s1.send({ type: 'createTeam', name: '무단', color: '#000', mascot: 'mascot-cat' })).ok);
  const leaders = students.slice(0, TEAMS);
  for (const l of leaders) await teacher.send({ type: 'appointLeader', playerId: l.playerId, on: true });
  for (const [i, l] of leaders.entries()) { await l.waitView((v) => v.me.isLeader); check(`카페 생성 ${l.name}`, (await l.send({ type: 'createTeam', name: `카페${i + 1}`, color: '#2FA98C', mascot: 'mascot-cat' })).ok); }
  await teacher.waitView((v) => v.teams.length === TEAMS);
  const teamIds = teacher.view.teams.map((t) => t.id);
  check('마스코트·색 중복은 자동으로 다른 것 배정', new Set(teacher.view.teams.map((t) => t.mascot)).size === TEAMS);
  const others = students.slice(TEAMS);
  const joins = await Promise.all(others.map((s, i) => s.send({ type: 'joinTeam', teamId: teamIds[i % TEAMS] })));
  check('학생 카페 가입', joins.every((j) => j.ok), `${joins.filter((j) => j.ok).length}/${others.length}`);
  check('두 번 가입 거절', !(await others[0].send({ type: 'joinTeam', teamId: teamIds[1] })).ok);
  for (const l of leaders) await l.send({ type: 'ready', on: true });
  check('영업 시작', (await teacher.send({ type: 'start' })).ok);
  await teacher.waitView((v) => v.room.status === 'playing' && v.game?.day === 1);
  check('1일 차 시작, 제한시간 없음', teacher.view.game.phase === 'open' && teacher.view.game.day === 1);
  check('교사 투영에 전 팀 상태', (teacher.view.teacherTeams ?? []).length === TEAMS);
  check('시작 코인 20·행동 3', teacher.view.teacherTeams.every((t) => t.coins === 20 && t.actionsLeft === 3));
  check('1일 차 손님 3명은 장비 없는 메뉴', teacher.view.teacherTeams.every((t) => t.customers.length === 3 && t.customers.every((o) => ['M02', 'M03', 'M06', 'M08', 'M09', 'M10', 'M12', 'M13'].includes(o.menuId))));
  const spec = await api(`/api/rooms/${code}/join`, { method: 'POST', body: JSON.stringify({ nick: '늦은학생' }) });
  check('경기 중 입장은 관전자', spec.status === 200 && spec.data.role === 'spectator');

  const opOf = (teamId) => { const gt = teacher.view.teacherTeams.find((t) => t.id === teamId); return students.find((s) => s.playerId === gt.operatorId); };
  await leaders[0].waitView((v) => v.game?.phase === 'open');
  const team0 = leaders[0].view.game.myTeam;
  const members0 = leaders[0].view.teams.find((t) => t.id === team0.id).members;
  const op = opOf(team0.id);
  const nonOp = students.find((s) => members0.includes(s.playerId) && s.playerId !== op.playerId);
  if (nonOp) {
    await nonOp.waitView((v) => !!v.game?.myTeam);
    check('점장 아닌 팀원의 장보기 거절', !(await nonOp.team({ type: 'buy', items: [{ ingredientId: 'tea', units: 1 }] })).ok);
    check('점장 아닌 팀원의 추천 허용', (await nonOp.team({ type: 'pin', target: 'menu:M03', label: '허브티' })).ok);
    check('점장 아닌 팀원의 힌트 허용', (await nonOp.team({ type: 'hint', menuId: 'M03' })).ok);
    check('점장 아닌 팀원의 마감 거절', !(await nonOp.team({ type: 'ready', on: true })).ok);
  }
  const dupId = 'dup-cmd-1';
  const r1 = await op.team({ type: 'buy', items: [{ ingredientId: 'tea', units: 2 }] }, dupId);
  const r2 = await op.team({ type: 'buy', items: [{ ingredientId: 'tea', units: 2 }] }, dupId);
  await op.waitView((v) => v.game.myTeam.stock['tea'] === 2, 5000).catch(() => {});
  check('점장 장보기 성공', r1.ok, r1.error);
  check('중복 commandId 는 같은 결과·한 번만 적용', r2.ok === r1.ok && op.view.game.myTeam.stock['tea'] === 2 && op.view.game.myTeam.actionsLeft === 2 && op.view.game.myTeam.coins === 18);
  check('장보기 한도 초과 거절', !(await op.team({ type: 'buy', items: [{ ingredientId: 'sugar', units: 7 }] })).ok);
  check('없는 장비 메뉴 만들기 거절', !(await op.team({ type: 'make', menuId: 'M01', choice: 'much' })).ok);
  const mk = await op.team({ type: 'make', menuId: 'M03', choice: 'hot' });
  check('만들기 성공 (허브티, 뜨거운 물)', mk.ok && mk.result === 'hot', mk.error);
  await op.waitView((v) => v.game.myTeam.products.some((p) => p.menuId === 'M03'), 5000).catch(() => {});
  check('보관함에 2인분', op.view.game.myTeam.products.find((p) => p.menuId === 'M03')?.servings === 2);
  const rawView = JSON.stringify(op.view);
  check('학생 투영에 다른 팀 상태 없음', !rawView.includes('"teacherTeams"') && !rawView.includes('"teacherWeather"'));
  check('학생 투영에 내일 예보까지만', op.view.game.weatherTomorrow !== undefined && !('weather' in op.view.game));
  const hotOrder = op.view.game.myTeam.customers.find((o) => o.menuId === 'M03' && o.want === 'hot');
  if (hotOrder) {
    const sv = await op.team({ type: 'serve', orderId: hotOrder.id, result: 'hot' });
    check('음식 내기 (별 3개, 행동 소모 없음)', sv.ok && sv.stars === 3, sv.error);
    await op.waitView((v) => v.game.myTeam.customers.every((o) => o.id !== hotOrder.id), 5000).catch(() => {});
    check('음식 내기는 행동을 쓰지 않음', op.view.game.myTeam.actionsLeft === 1);
  } else {
    check('음식 내기 (손님 없음 → 거절 확인)', !(await op.team({ type: 'serve', orderId: 'none', result: 'hot' })).ok);
  }
  // 재접속
  op.close(); await op.closed; op.open(); await op.ready; await op.waitView((v) => !!v.game);
  check('재접속 후 상태 복구', op.view.game.myTeam.id === team0.id && op.view.game.day === 1 && op.view.game.myTeam.actionsLeft === 1);
  await sleep(2000);
  check('시간이 흘러도 날짜·행동이 그대로', teacher.view.game.day === 1 && op.view.game.myTeam.actionsLeft === 1);

  // 마감 흐름
  const rr = await op.team({ type: 'ready', on: true });
  check('오늘 영업 마감', rr.ok, rr.error ?? '');
  await teacher.waitView((v) => v.game.readyCount === 1);
  check('한 팀만 마감하면 정산되지 않음', teacher.view.game.day === 1);
  check('마감 뒤 행동 거절', !(await op.team({ type: 'buy', items: [{ ingredientId: 'sugar', units: 1 }] })).ok);
  check('마감 취소', (await op.team({ type: 'ready', on: false })).ok);
  check('멈춤', (await teacher.send({ type: 'pause' })).ok);
  check('멈춤 중 명령 거절', !(await op.team({ type: 'ready', on: true })).ok);
  check('다시 시작', (await teacher.send({ type: 'resume' })).ok);
  for (const tid of teamIds) { const o = opOf(tid); await o.team({ type: 'ready', on: true }); }
  await teacher.waitView((v) => v.game.day === 2, 8000);
  await sleep(400);
  check('모든 팀 마감 → 정산 정확히 1회 (2일 차)', teacher.view.game.day === 2 && teacher.view.game.settleCount === 1);
  check('다음 날 마감 상태 초기화·행동 3', teacher.view.game.readyCount === 0 && teacher.view.teacherTeams.every((t) => t.actionsLeft === 3));
  check('영수증 저장', teacher.view.teacherTeams.every((t) => t.receipts.length === 1));
  check('점장이 다음 팀원으로 바뀜', teacher.view.teacherTeams.some((t) => t.operatorId !== op.playerId));
  // 건너뛰기 + 동시 마감(중복 전송)
  const opsNow = teamIds.map(opOf);
  await Promise.all([teacher.send({ type: 'skipTeam', teamId: teamIds[0] }), ...opsNow.slice(1).map((o) => o.team({ type: 'ready', on: true })), ...opsNow.slice(1).map((o) => o.team({ type: 'ready', on: true }))]);
  await teacher.waitView((v) => v.game.day === 3, 8000);
  await sleep(400);
  check('건너뛰기 + 동시 마감 → 정산 1회 (3일 차)', teacher.view.game.day === 3 && teacher.view.game.settleCount === 2);
  check('3일 차 단체 주문 공개', teacher.view.game.groupOrders.length === 1 && teacher.view.game.groupOrders[0].openDay === 3);
  check('학생의 건너뛰기 거절', !(await students[0].send({ type: 'skipTeam', teamId: teamIds[0] })).ok);
  check('팀장의 점장 넘기기', (await leaders[0].send({ type: 'setOperator', teamId: teamIds[0], playerId: leaders[0].playerId })).ok);
  if (FULL) {
    let guard = 0;
    while (teacher.view.room.status !== 'finished' && guard++ < 12) {
      const day = teacher.view.game.day;
      for (const tid of teamIds) { const o = opOf(tid); if (o) await o.team({ type: 'ready', on: true }); }
      await teacher.waitView((v) => v.room.status === 'finished' || v.game.day > day, 8000).catch(() => {});
    }
    check('6일 완주·결과 생성', teacher.view.room.status === 'finished' && Array.isArray(teacher.view.game.results) && teacher.view.game.results.length === TEAMS);
    check('결과 순위 1~N', teacher.view.game.results.map((r) => r.rank).sort().join(',') === teamIds.map((_, i) => i + 1).join(','));
    const ops = new Set(); for (const s of students) for (const t of s.toasts) if (t.includes('점장')) ops.add(s.name);
    check('점장이 여러 팀원에게 순환', ops.size > TEAMS, `${ops.size}명이 점장 알림 수신`);
    check('끝난 뒤 명령 거절', !(await opOf(teamIds[0])?.team({ type: 'ready', on: true }))?.ok);
    const exp = await api(`/api/rooms/${code}/export`, { headers: { 'x-teacher-key': key } });
    check('교사 결과 내보내기 (JSON)', exp.status === 200 && Array.isArray(exp.data.results) && !!exp.data.receipts);
    const csv = await fetch(`${base}/api/rooms/${code}/export?format=csv`, { headers: { 'x-teacher-key': key } });
    check('교사 결과 내보내기 (CSV)', csv.status === 200 && (await csv.text()).includes('순이익'));
  }
  const list = await api('/api/rooms', { headers: { 'x-teacher-key': key } });
  check('교사 방 목록', list.status === 200 && list.data.rooms.some((r) => r.code === code));
  teacher.close(); for (const s of students) s.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n통과 ${results.length - failed.length}/${results.length}, 소요 ${Math.round((Date.now() - t0) / 1000)}s`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('E2E 예외:', e); process.exit(1); });
