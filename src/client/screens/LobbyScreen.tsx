import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { ClientView } from '../../shared/protocol';
import { MASCOTS, PRESETS } from '../../shared/content';
import { TEAM_COLORS, TEAM_COLOR_NAMES } from '../../shared/engine/state';
import type { GameClient } from '../lib/net';
import { store } from '../lib/store';
import { audio } from '../lib/audio';
import { AssetImage, Backdrop } from '../components/AssetImage';
import { Modal, Tag, Wordmark } from '../components/common';

/** 대기실 (7.3-2): 팀장이 카페를 만들고, 학생이 카페를 골라 들어가고, 교사가 시작한다 */
export function LobbyScreen({ view, client, onLeave }: { view: ClientView; client: GameClient; onLeave: () => void }) {
  const isTeacher = view.me.role === 'teacher';
  const me = view.players.find((p) => p.id === view.me.playerId);
  const myTeam = view.teams.find((t) => t.id === view.me.teamId) ?? null;
  const [creating, setCreating] = useState(false);
  useEffect(() => { audio.bgm('bgm-title'); }, []);
  const send = async (cmd: Parameters<GameClient['send']>[0]) => { const r = await client.send(cmd); if (!r.ok) store.toast(r.error ?? '지금은 할 수 없어요.', 'error'); return r; };
  const preset = PRESETS[view.room.presetId];
  return (
    <div className="screen lobby-screen">
      <Backdrop id="bg-lobby" />
      <div className="content stack">
        <header className="row-between">
          <Wordmark compact />
          <span className="row"><span className="small muted">방 {view.room.code}</span><button className="btn btn-ghost btn-sm" onClick={onLeave}>나가기</button></span>
        </header>
        {isTeacher && <TeacherLobby view={view} send={send} />}
        <section className="card">
          <div className="card-title">{preset.name} · {view.room.days}일 영업</div>
          <p className="small muted">{preset.units.join(' · ')}</p>
        </section>
        <section className="card">
          <div className="card-title">카페 {view.teams.length}곳</div>
          {view.teams.length === 0 && <p className="muted small">아직 카페가 없어요. 선생님이 임명한 팀장이 카페를 만들어요.</p>}
          <div className="team-grid">
            {view.teams.map((t) => (
              <div key={t.id} className={`team-card ${t.id === view.me.teamId ? 'mine' : ''}`} style={{ borderColor: t.color }}>
                <AssetImage id={t.mascot} size={56} />
                <b>{t.name}</b>
                <span className="small muted">{t.members.map((m) => view.players.find((p) => p.id === m)?.nick ?? '?').join(', ')}</span>
                {t.ready ? <Tag tone="mint">준비 완료</Tag> : <Tag tone="line">준비 중</Tag>}
                {!isTeacher && !view.me.teamId && t.members.length < 8 && <button className="btn btn-sm btn-primary" onClick={() => send({ type: 'joinTeam', teamId: t.id })}>들어가기</button>}
                {isTeacher && <TeacherTeamTools view={view} teamId={t.id} send={send} />}
              </div>
            ))}
          </div>
        </section>
        {!isTeacher && !view.me.teamId && me?.isLeader && <button className="btn btn-primary btn-block" onClick={() => setCreating(true)}>카페 만들기 (팀장)</button>}
        {isTeacher && !view.me.teamId && <button className="btn btn-ghost btn-block" onClick={() => setCreating(true)}>교사도 팀으로 참가하기</button>}
        {myTeam && (
          <section className="card stack-sm">
            <div className="card-title">우리 카페: {myTeam.name}</div>
            {view.me.isLeader && !isTeacher && <button className={`btn btn-block ${myTeam.ready ? 'btn-ghost' : 'btn-primary'}`} onClick={() => send({ type: 'ready', on: !myTeam.ready })}>{myTeam.ready ? '준비 취소' : '준비 완료'}</button>}
            {!view.me.isLeader && !isTeacher && <button className="btn btn-ghost btn-sm" onClick={() => send({ type: 'leaveTeam' })}>카페 나가기</button>}
            {isTeacher && <button className="btn btn-ghost btn-sm" onClick={() => send({ type: 'teacherLeaveTeam' })}>팀에서 나가기</button>}
            <p className="small muted">점장 순서: {myTeam.members.map((m) => view.players.find((p) => p.id === m)?.nick ?? '?').join(' → ')} (매일 다음 사람으로 바뀌어요)</p>
          </section>
        )}
        <section className="card">
          <div className="card-title">참가자 {view.players.filter((p) => p.role !== 'teacher').length}명</div>
          <div className="player-list">
            {view.players.filter((p) => p.role !== 'teacher').map((p) => (
              <span key={p.id} className={`player ${p.connected ? '' : 'off'}`}>
                {p.nick}{p.isLeader && <Tag tone="butter">팀장</Tag>}{!p.connected && <span className="tiny muted"> (끊김)</span>}
                {isTeacher && <button className="btn btn-xs btn-ghost" onClick={() => send({ type: 'appointLeader', playerId: p.id, on: !p.isLeader })}>{p.isLeader ? '팀장 해제' : '팀장 임명'}</button>}
                {isTeacher && <button className="btn btn-xs btn-ghost" onClick={() => { if (confirm(`${p.nick} 학생을 내보낼까요?`)) void send({ type: 'kickPlayer', playerId: p.id }); }}>내보내기</button>}
              </span>
            ))}
          </div>
        </section>
      </div>
      {creating && <CreateTeamModal view={view} onClose={() => setCreating(false)} onCreate={async (name, color, mascot) => { const r = await send(isTeacher ? { type: 'teacherJoinTeam', name, color, mascot } : { type: 'createTeam', name, color, mascot }); if (r.ok) setCreating(false); }} />}
    </div>
  );
}

function CreateTeamModal({ view, onClose, onCreate }: { view: ClientView; onClose: () => void; onCreate: (name: string, color: string, mascot: string) => void }) {
  const usedColors = new Set(view.teams.map((t) => t.color));
  const usedMascots = new Set(view.teams.map((t) => t.mascot));
  const [name, setName] = useState('');
  const [color, setColor] = useState(TEAM_COLORS.find((c) => !usedColors.has(c)) ?? TEAM_COLORS[0]!);
  const [mascot, setMascot] = useState(MASCOTS.find((m) => !usedMascots.has(m.id))?.id ?? MASCOTS[0]!.id);
  return (
    <Modal title="카페 만들기" onClose={onClose}>
      <div className="stack">
        <label className="field">카페 이름<input value={name} onChange={(e) => setName(e.target.value)} maxLength={12} placeholder="12자 이내" /></label>
        <div className="small"><b>팀 색</b></div>
        <div className="row" role="radiogroup">
          {TEAM_COLORS.map((c) => <button key={c} role="radio" aria-checked={color === c} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} disabled={usedColors.has(c)} onClick={() => setColor(c)} aria-label={TEAM_COLOR_NAMES[c] ?? c}><span className="tiny">{TEAM_COLOR_NAMES[c]}</span></button>)}
        </div>
        <div className="small"><b>마스코트</b></div>
        <div className="mascot-grid" role="radiogroup">
          {MASCOTS.map((m) => <button key={m.id} role="radio" aria-checked={mascot === m.id} className={`mascot ${mascot === m.id ? 'on' : ''}`} disabled={usedMascots.has(m.id)} onClick={() => setMascot(m.id)}><AssetImage id={m.id} size={56} /><span className="small">{m.name}</span></button>)}
        </div>
        <button className="btn btn-primary btn-block" disabled={!name.trim()} onClick={() => onCreate(name.trim(), color, mascot)}>만들기</button>
      </div>
    </Modal>
  );
}

function TeacherLobby({ view, send }: { view: ClientView; send: (cmd: Parameters<GameClient['send']>[0]) => Promise<{ ok: boolean }> }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => { QRCode.toDataURL(view.room.joinUrl, { width: 220, margin: 1 }).then(setQr).catch(() => setQr(null)); }, [view.room.joinUrl]);
  const readyTeams = view.teams.filter((t) => t.members.length > 0);
  return (
    <section className="card teacher-lobby">
      <div className="row">
        <div className="stack-sm">
          <div className="small muted">방 코드</div>
          <div className="room-code">{view.room.code}</div>
          <div className="small">입장 링크: <a href={view.room.joinUrl}>{view.room.joinUrl}</a></div>
          <div className="small muted">{PRESETS[view.room.presetId].name} · {view.room.days}일</div>
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={() => send({ type: 'lock', on: !view.room.locked })}>{view.room.locked ? '입장 열기' : '입장 잠그기'}</button>
            <button className="btn btn-primary" disabled={readyTeams.length === 0} onClick={() => { if (confirm(`카페 ${readyTeams.length}곳으로 시작할까요? 팀에 들어가지 않은 학생은 구경만 해요.`)) void send({ type: 'start' }); }}>영업 시작</button>
          </div>
        </div>
        {qr && <img className="qr" src={qr} alt="입장 QR 코드" width={160} height={160} />}
      </div>
    </section>
  );
}

function TeacherTeamTools({ view, teamId, send }: { view: ClientView; teamId: string; send: (cmd: Parameters<GameClient['send']>[0]) => Promise<{ ok: boolean }> }) {
  const [open, setOpen] = useState(false);
  const team = view.teams.find((t) => t.id === teamId)!;
  const free = view.players.filter((p) => p.role !== 'teacher' && !p.teamId);
  return (
    <div className="stack-sm">
      <button className="btn btn-xs btn-ghost" onClick={() => setOpen((v) => !v)}>{open ? '닫기' : '관리'}</button>
      {open && (
        <div className="stack-sm small">
          {free.length > 0 && <label>학생 넣기 <select onChange={(e) => { if (e.target.value) void send({ type: 'movePlayer', playerId: e.target.value, teamId }); }} defaultValue=""><option value="">선택</option>{free.map((p) => <option key={p.id} value={p.id}>{p.nick}</option>)}</select></label>}
          {team.members.length > 1 && <label>팀장 교체 <select onChange={(e) => { if (e.target.value) void send({ type: 'setTeamLeader', teamId, playerId: e.target.value }); }} defaultValue=""><option value="">선택</option>{team.members.map((m) => <option key={m} value={m}>{view.players.find((p) => p.id === m)?.nick}</option>)}</select></label>}
          {team.members.map((m) => <button key={m} className="btn btn-xs btn-ghost" onClick={() => send({ type: 'movePlayer', playerId: m, teamId: null })}>{view.players.find((p) => p.id === m)?.nick} 빼기</button>)}
          <button className="btn btn-xs btn-ghost" onClick={() => { if (confirm('이 카페를 해산할까요?')) void send({ type: 'disbandTeam', teamId }); }}>해산</button>
        </div>
      )}
    </div>
  );
}
