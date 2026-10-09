import { useEffect, useState } from 'react';
import type { ClientView } from '../../shared/protocol';
import { MENUS, PRESETS, WEATHER_NAME } from '../../shared/content';
import type { GameClient } from '../lib/net';
import { store } from '../lib/store';
import { audio } from '../lib/audio';
import { AssetImage, Backdrop } from '../components/AssetImage';
import { Coins, Modal, Tag, WeatherChip } from '../components/common';
import { ResultsScreen } from './ResultsScreen';

/** 교사 보드 (7.3-6): 교실 화면에 띄우므로 글자를 크게 한다 */
export function TeacherBoard({ view, client, onLeave, teacherKey, onSwitchToTeam }: { view: ClientView; client: GameClient; onLeave: () => void; teacherKey: string | null; onSwitchToTeam?: () => void }) {
  const game = view.game!;
  const teams = view.teacherTeams ?? [];
  const [science, setScience] = useState(false);
  const [results, setResults] = useState(false);
  const [operatorFor, setOperatorFor] = useState<string | null>(null);
  useEffect(() => { audio.applyProfile('teacher'); audio.bgm(game.phase === 'finished' ? 'bgm-results' : game.day >= game.daysTotal ? 'bgm-lastday' : 'bgm-open'); }, [game.phase, game.day, game.daysTotal]);
  const send = async (cmd: Parameters<GameClient['send']>[0]) => { const r = await client.send(cmd); if (!r.ok) store.toast(r.error ?? '지금은 할 수 없어요.', 'error'); return r; };
  const paused = view.room.status === 'paused';
  const finished = game.phase === 'finished';
  const maxAbs = Math.max(10, ...teams.flatMap((t) => t.netHistory.map((n) => Math.abs(n))), ...teams.map((t) => Math.abs(t.coins - game.config.startCoins)));
  const exportUrl = (fmt: 'json' | 'csv') => `/api/rooms/${view.room.code}/export?format=${fmt}`;
  const download = async (fmt: 'json' | 'csv') => {
    if (!teacherKey) return;
    const res = await fetch(exportUrl(fmt), { headers: { 'x-teacher-key': teacherKey } });
    const blob = await res.blob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `reaction-cafe-${view.room.code}.${fmt}`; a.click();
  };
  if (results && finished) return <ResultsScreen view={view} onLeave={() => setResults(false)} headerExtra={<button className="btn btn-sm btn-ghost" onClick={() => setResults(false)}>교사 보드</button>} />;
  return (
    <div className="screen teacher-board">
      <Backdrop id="bg-counter" />
      <div className="content stack big-text">
        <header className="row-between">
          <h2>{finished ? '영업 끝' : `${game.day}일 차 / ${game.daysTotal}일`} <span className="small muted">방 {view.room.code} · {PRESETS[game.presetId].name}</span></h2>
          <span className="row">
            {!finished && <WeatherChip w={game.weatherToday} label="오늘" />}
            {!finished && game.weatherTomorrow && <WeatherChip w={game.weatherTomorrow} label="내일" />}
            {onSwitchToTeam && <button className="btn btn-sm btn-ghost" onClick={onSwitchToTeam}>내 카페 화면</button>}
            <button className="btn btn-sm btn-ghost" onClick={onLeave}>나가기</button>
          </span>
        </header>
        {!finished && (
          <section className="card row-between">
            <span>마감한 카페 <b>{game.readyCount} / {game.teamCount}</b> · 접속 {view.players.filter((p) => p.role !== 'teacher' && p.connected).length}명{paused && <Tag tone="coral">잠시 멈춤</Tag>}</span>
            <span className="row">
              <button className="btn btn-ghost" onClick={() => send({ type: paused ? 'resume' : 'pause' })}>{paused ? '다시 시작' : '잠시 멈춤'}</button>
              <button className="btn btn-coral" onClick={() => { if (confirm('오늘을 마지막 날로 삼아 결과를 낼까요?')) void send({ type: 'endGame' }); }}>조기 종료</button>
            </span>
          </section>
        )}
        <section className="card">
          <div className="card-title">카페별 누적 순이익</div>
          <div className="board-list">
            {teams.map((t) => {
              const pub = view.teams.find((x) => x.id === t.id);
              const op = view.players.find((p) => p.id === t.operatorId)?.nick ?? '-';
              const liveNet = t.coins - game.config.startCoins;
              return (
                <div key={t.id} className="board-row" style={{ borderColor: t.color }}>
                  <AssetImage id={t.mascot} size={44} />
                  <div className="board-main">
                    <div className="row-between"><b>{t.name}</b><span><Coins n={liveNet} sign /> <span className="small muted">(어제까지 {t.netHistory[t.netHistory.length - 1] ?? 0})</span></span></div>
                    <div className="bars" aria-label="날짜별 누적 순이익">
                      {t.netHistory.map((n, i) => <span key={i} className={`bar ${n < 0 ? 'neg' : ''}`} style={{ height: `${Math.max(2, (Math.abs(n) / maxAbs) * 40)}px`, background: t.color }} title={`${i + 1}일 차 ${n}`} />)}
                      {!finished && <span className="bar live" style={{ height: `${Math.max(2, (Math.abs(liveNet) / maxAbs) * 40)}px`, borderColor: t.color }} title={`오늘 ${liveNet}`} />}
                    </div>
                    <div className="small row">
                      {t.ready ? <Tag tone="mint">마감</Tag> : <Tag tone="line">영업 중 · 행동 {t.actionsLeft}</Tag>}
                      <span>점장 {op}</span>
                      <span className="muted">접속 {pub?.connectedCount ?? 0}/{pub?.members.length ?? 0}</span>
                      <span className="muted">손님 {t.customers.length} · 보관 {t.products.reduce((a, p) => a + p.servings, 0)}인분</span>
                    </div>
                  </div>
                  {!finished && (
                    <div className="stack-sm">
                      <button className="btn btn-sm btn-ghost" disabled={t.ready} onClick={() => send({ type: 'skipTeam', teamId: t.id })}>건너뛰기</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setOperatorFor(t.id)}>점장 넘기기</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        {view.teacherWeather && !finished && <p className="small muted">날씨 일정(교사만): {view.teacherWeather.map((w, i) => `${i + 1}일 ${WEATHER_NAME[w]}`).join(' · ')}</p>}
        <section className="card row">
          <button className="btn btn-ghost" onClick={() => setScience(true)}>오늘의 과학</button>
          {finished && <button className="btn btn-primary" onClick={() => setResults(true)}>결과 화면</button>}
          {finished && <button className="btn btn-ghost" onClick={() => download('json')}>결과 내보내기 (JSON)</button>}
          {finished && <button className="btn btn-ghost" onClick={() => download('csv')}>결과 내보내기 (CSV)</button>}
        </section>
      </div>
      {science && <TodayScience view={view} onClose={() => setScience(false)} />}
      {operatorFor && (
        <Modal title="점장 넘기기" onClose={() => setOperatorFor(null)}>
          <div className="stack-sm">
            {(view.teams.find((t) => t.id === operatorFor)?.members ?? []).map((m) => <button key={m} className="btn btn-ghost btn-block" onClick={async () => { await send({ type: 'setOperator', teamId: operatorFor, playerId: m }); setOperatorFor(null); }}>{view.players.find((p) => p.id === m)?.nick}{view.players.find((p) => p.id === m)?.connected ? '' : ' (끊김)'}</button>)}
          </div>
        </Modal>
      )}
    </div>
  );
}

/** 오늘의 과학 (7.3-7): 학급 전체가 만든 메뉴별 횟수, 첫 시도에 실패가 아닌 결과를 만든 팀의 비율, 원리 한 줄. 팀 단위 집계만. */
export function TodayScience({ view, onClose }: { view: ClientView; onClose: () => void }) {
  const game = view.game!;
  const teams = view.teacherTeams ?? [];
  const rows = PRESETS[game.presetId].menus.map((mid) => {
    const ats = teams.map((t) => t.attempts[mid]).filter((a): a is NonNullable<typeof a> => !!a && a.tries > 0);
    const tries = ats.reduce((a, x) => a + x.tries, 0);
    const firstOk = ats.filter((a) => a.firstOk).length;
    const threeStar = teams.filter((t) => t.attempts[mid]?.threeStar).length;
    return { mid, tries, teams: ats.length, firstOk, threeStar };
  });
  return (
    <Modal title="오늘의 과학" onClose={onClose} wide>
      <p className="small muted">학급 전체의 팀 단위 집계예요. 개인은 표시하지 않아요.</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>메뉴</th><th>만든 횟수</th><th>만든 카페</th><th>첫 시도 성공</th><th>별 3개 카페</th><th>원리 한 줄</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.mid}>
                <td><b>{MENUS[r.mid]!.name}</b></td><td>{r.tries}</td><td>{r.teams}</td><td>{r.teams ? `${Math.round((r.firstOk / r.teams) * 100)}% (${r.firstOk}/${r.teams})` : '-'}</td><td>{r.threeStar}</td><td className="small">{MENUS[r.mid]!.principle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
