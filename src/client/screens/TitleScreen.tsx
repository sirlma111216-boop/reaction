import { useEffect, useState } from 'react';
import type { PresetId } from '../../shared/types';
import { DAY_OPTIONS, DEFAULT_DAYS, DEFAULT_PRESET, PRESETS, PRESET_IDS } from '../../shared/content';
import { api } from '../lib/net';
import { loadTeacherKey, saveTeacherKey, loadSession, roomFromUrl, loadRecentRooms, rememberRoom } from '../lib/session';
import { store } from '../lib/store';
import { audio } from '../lib/audio';
import { AssetImage, Backdrop } from '../components/AssetImage';
import { AudioSettings, Wordmark } from '../components/common';

export interface JoinResult { code: string; playerId: string; token: string; nick: string; role: 'student' | 'spectator' | 'teacher' }

export function TitleScreen({ onJoin, onPractice }: { onJoin: (r: JoinResult) => void; onPractice: (presetId: PresetId) => void }) {
  const [tab, setTab] = useState<'student' | 'teacher' | 'practice'>('student');
  const [audioOpen, setAudioOpen] = useState(false);
  useEffect(() => { audio.bgm('bgm-title'); }, []);
  return (
    <div className="screen title-screen">
      <Backdrop id="bg-title" />
      <div className="content title-panel">
        <Wordmark />
        <p className="center muted small">팀이 카페를 운영하며 과학 원리로 메뉴를 만들어요. 손님이 원한 결과를 내면 별 3개와 팁을 받아요. 순이익이 가장 큰 카페가 이겨요.</p>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'student'} className={tab === 'student' ? 'on' : ''} onClick={() => setTab('student')}>학생 입장</button>
          <button role="tab" aria-selected={tab === 'teacher'} className={tab === 'teacher' ? 'on' : ''} onClick={() => setTab('teacher')}>교사</button>
          <button role="tab" aria-selected={tab === 'practice'} className={tab === 'practice' ? 'on' : ''} onClick={() => setTab('practice')}>연습</button>
        </div>
        {tab === 'student' && <StudentJoin onJoin={onJoin} />}
        {tab === 'teacher' && <TeacherPanel onJoin={onJoin} />}
        {tab === 'practice' && <PracticePanel onPractice={onPractice} />}
        <div className="row center-row">
          <a className="btn btn-sm btn-ghost" href="/asset-review">자산 검수</a>
          <button className="btn btn-sm btn-ghost" onClick={() => setAudioOpen((v) => !v)}>소리 설정</button>
        </div>
        {audioOpen && <AudioSettings />}
        <p className="tiny muted center">실제로 따라 할 때는 선생님과 함께해요.</p>
      </div>
    </div>
  );
}

function PracticePanel({ onPractice }: { onPractice: (presetId: PresetId) => void }) {
  const [preset, setPreset] = useState<PresetId>(DEFAULT_PRESET);
  return (
    <div className="stack">
      <p className="small">서버 없이 AI 카페 한 곳과 6일을 경쟁해요. 점장은 항상 나예요.</p>
      <PresetPicker value={preset} onChange={setPreset} />
      <button className="btn btn-primary btn-block" onClick={() => onPractice(preset)}>연습 시작</button>
    </div>
  );
}

export function PresetPicker({ value, onChange }: { value: PresetId; onChange: (p: PresetId) => void }) {
  return (
    <div className="preset-list" role="radiogroup" aria-label="메뉴판">
      {PRESET_IDS.map((id) => {
        const p = PRESETS[id];
        return (
          <button key={id} role="radio" aria-checked={value === id} className={`preset ${value === id ? 'on' : ''}`} onClick={() => onChange(id)}>
            <b>{p.name}</b> <span className="small muted">메뉴 {p.menus.length}종</span>
            <span className="small">{p.units.join(' · ')}</span>
          </button>
        );
      })}
    </div>
  );
}

function StudentJoin({ onJoin }: { onJoin: (r: JoinResult) => void }) {
  const [code, setCode] = useState(roomFromUrl() ?? '');
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<{ status: string; teacherNick: string; players: number } | null>(null);
  const prev = loadSession();
  useEffect(() => {
    const c = code.toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(c)) { setInfo(null); return; }
    api<{ exists: boolean; status: string; teacherNick: string; players: number }>(`/api/rooms/${c}`).then((d) => setInfo(d.exists ? d : null)).catch(() => setInfo(null));
  }, [code]);
  const join = async () => {
    setBusy(true);
    try {
      const c = code.toUpperCase();
      const r = await api<{ playerId: string; token: string; role: 'student' | 'spectator' }>(`/api/rooms/${c}/join`, { method: 'POST', body: JSON.stringify({ nick }) });
      onJoin({ code: c, playerId: r.playerId, token: r.token, nick, role: r.role });
    } catch (e) { store.toast(e instanceof Error ? e.message : '입장하지 못했어요.', 'error'); }
    finally { setBusy(false); }
  };
  return (
    <div className="stack">
      {prev && prev.role !== 'teacher' && <button className="btn btn-ghost btn-block" onClick={() => onJoin(prev)}>이어서 하기: 방 {prev.code} · {prev.nick}</button>}
      <label className="field">방 코드<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="6자리" autoCapitalize="characters" inputMode="text" /></label>
      {info && <p className="small muted">{info.teacherNick} 선생님의 방 · {info.status === 'lobby' ? '대기 중' : info.status === 'playing' ? '영업 중 (구경만 할 수 있어요)' : '끝남'} · 학생 {info.players}명</p>}
      <label className="field">닉네임<input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={12} placeholder="12자 이내" /></label>
      <button className="btn btn-primary btn-block" disabled={busy || code.length !== 6 || !nick.trim()} onClick={join}>입장</button>
    </div>
  );
}

function TeacherPanel({ onJoin }: { onJoin: (r: JoinResult) => void }) {
  const [key, setKey] = useState<string | null>(loadTeacherKey());
  const [id, setId] = useState('teacher');
  const [pw, setPw] = useState('');
  const [nick, setNick] = useState('선생님');
  const [preset, setPreset] = useState<PresetId>(DEFAULT_PRESET);
  const [days, setDays] = useState<number>(DEFAULT_DAYS);
  const [busy, setBusy] = useState(false);
  const [rooms, setRooms] = useState<{ code: string; status: string; presetId: string; days: number; createdAt: number }[]>([]);
  const recent = loadRecentRooms();
  useEffect(() => {
    if (!key) return;
    api<{ ok: boolean }>('/api/teacher/verify', { teacherKey: key }).then((d) => { if (!d.ok) { saveTeacherKey(null); setKey(null); } }).catch(() => {});
    api<{ rooms: typeof rooms }>('/api/rooms', { teacherKey: key }).then((d) => setRooms(d.rooms.filter((r) => r.status !== 'finished').slice(0, 5))).catch(() => {});
  }, [key]);
  const login = async () => {
    setBusy(true);
    try {
      const r = await api<{ teacherKey: string }>('/api/teacher/login', { method: 'POST', body: JSON.stringify({ id, password: pw }) });
      saveTeacherKey(r.teacherKey); setKey(r.teacherKey); setPw('');
    } catch (e) { store.toast(e instanceof Error ? e.message : '로그인하지 못했어요.', 'error'); }
    finally { setBusy(false); }
  };
  const create = async () => {
    if (!key) return;
    setBusy(true);
    try {
      const r = await api<{ code: string; teacherToken: string; playerId: string }>('/api/rooms', { method: 'POST', teacherKey: key, body: JSON.stringify({ nick, presetId: preset, days }) });
      rememberRoom({ code: r.code, teacherToken: r.teacherToken, playerId: r.playerId, at: Date.now(), presetId: preset });
      onJoin({ code: r.code, playerId: r.playerId, token: r.teacherToken, nick, role: 'teacher' });
    } catch (e) { store.toast(e instanceof Error ? e.message : '방을 만들지 못했어요.', 'error'); }
    finally { setBusy(false); }
  };
  const reopen = async (code: string) => {
    if (!key) return;
    try {
      const r = await api<{ code: string; teacherToken: string; playerId: string }>(`/api/rooms/${code}/teacher`, { teacherKey: key });
      onJoin({ code: r.code, playerId: r.playerId, token: r.teacherToken, nick, role: 'teacher' });
    } catch (e) { store.toast(e instanceof Error ? e.message : '방을 열지 못했어요.', 'error'); }
  };
  if (!key) {
    return (
      <div className="stack">
        <label className="field">아이디<input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" /></label>
        <label className="field">비밀번호<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" onKeyDown={(e) => { if (e.key === 'Enter') void login(); }} /></label>
        <button className="btn btn-primary btn-block" disabled={busy || !pw} onClick={login}>교사 로그인</button>
      </div>
    );
  }
  return (
    <div className="stack">
      <label className="field">교사 닉네임<input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={12} /></label>
      <div className="small"><b>메뉴판</b></div>
      <PresetPicker value={preset} onChange={setPreset} />
      <div className="small"><b>영업일 수</b></div>
      <div className="row" role="radiogroup">
        {DAY_OPTIONS.map((d) => <button key={d} role="radio" aria-checked={days === d} className={`choice ${days === d ? 'on' : ''}`} onClick={() => setDays(d)}>{d}일</button>)}
      </div>
      <button className="btn btn-primary btn-block" disabled={busy} onClick={create}>새 방 만들기</button>
      {(rooms.length > 0 || recent.length > 0) && (
        <div className="card-sub stack-sm">
          <div className="small muted">최근 방</div>
          {[...new Map([...rooms.map((r) => [r.code, r.code] as const), ...recent.map((r) => [r.code, r.code] as const)]).keys()].slice(0, 5).map((c) => <button key={c} className="btn btn-ghost btn-sm" onClick={() => reopen(c)}>방 {c} 다시 열기</button>)}
        </div>
      )}
      <button className="btn btn-ghost btn-sm" onClick={() => { saveTeacherKey(null); setKey(null); }}>교사 로그아웃</button>
    </div>
  );
}

export { AssetImage };
