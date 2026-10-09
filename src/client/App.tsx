import { lazy, Suspense, useEffect, useState } from 'react';
import type { PresetId } from '../shared/types';
import { WsClient } from './lib/net';
import { useAppState, store } from './lib/store';
import { loadSession, saveSession, loadTeacherKey, type StudentSession } from './lib/session';
import { audio } from './lib/audio';
import { TitleScreen, type JoinResult } from './screens/TitleScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { Toasts, ConnectionBadge } from './components/common';
import { Backdrop } from './components/AssetImage';

// 학생 대부분이 쓰지 않는 화면은 필요할 때 따로 받는다
const TeacherBoard = lazy(() => import('./screens/TeacherBoard').then((m) => ({ default: m.TeacherBoard })));
const PracticeScreen = lazy(() => import('./screens/PracticeScreen').then((m) => ({ default: m.PracticeScreen })));
const AssetReview = lazy(() => import('./screens/AssetReview').then((m) => ({ default: m.AssetReview })));

function Loading() {
  return <div className="screen"><Backdrop id="bg-lobby" /><div className="content center"><p className="muted">불러오는 중…</p></div></div>;
}

type Route = { kind: 'title' } | { kind: 'room'; session: StudentSession } | { kind: 'practice'; presetId: PresetId } | { kind: 'assets' };

export function App() {
  const [route, setRoute] = useState<Route>(() => {
    if (location.pathname === '/asset-review') return { kind: 'assets' };
    const s = loadSession();
    const urlRoom = new URL(location.href).searchParams.get('room');
    if (s && (!urlRoom || urlRoom.toUpperCase() === s.code)) return { kind: 'room', session: s };
    return { kind: 'title' };
  });
  const [client, setClient] = useState<WsClient | null>(null);
  const [teacherView, setTeacherView] = useState<'board' | 'team'>('board');
  const { view, connection, closedReason } = useAppState();

  useEffect(() => {
    if (route.kind !== 'room') { if (client) { client.close(); setClient(null); store.reset(); } return; }
    const c = new WsClient(route.session.code, route.session.token);
    setClient(c);
    return () => c.close();
  }, [route]); // client 는 route 가 바뀔 때만 다시 만든다


  const onJoin = (r: JoinResult) => {
    const s: StudentSession = { code: r.code, playerId: r.playerId, token: r.token, nick: r.nick, role: r.role };
    saveSession(s);
    audio.applyProfile(r.role === 'teacher' ? 'teacher' : 'student');
    setRoute({ kind: 'room', session: s });
  };
  const leave = () => {
    if (route.kind === 'room' && !confirm('나가면 이 기기의 접속 정보가 지워져요. 다시 들어오려면 선생님께 요청해야 할 수 있어요. 나갈까요?')) return;
    saveSession(null);
    setRoute({ kind: 'title' });
    audio.stopBgm();
    history.replaceState(null, '', '/');
  };

  if (route.kind === 'assets') return <Suspense fallback={<Loading />}><AssetReview onLeave={() => { history.replaceState(null, '', '/'); setRoute({ kind: 'title' }); }} /></Suspense>;
  if (route.kind === 'practice') return <><Suspense fallback={<Loading />}><PracticeScreen presetId={route.presetId} onLeave={() => { store.reset(); setRoute({ kind: 'title' }); }} /></Suspense><Toasts /></>;
  if (route.kind === 'title') return <><TitleScreen onJoin={onJoin} onPractice={(presetId) => setRoute({ kind: 'practice', presetId })} /><Toasts /></>;

  if (!client || !view) {
    return (
      <div className="screen title-screen">
        <Backdrop id="bg-lobby" />
        <div className="content title-panel center stack">
          {connection === 'closed' ? (
            <>
              <h2>연결이 끊겼어요</h2>
              <p className="muted">{closedReason ?? '방이 없거나 접속 정보가 맞지 않아요.'}</p>
              <button className="btn btn-primary" onClick={() => { saveSession(null); setRoute({ kind: 'title' }); }}>처음으로</button>
            </>
          ) : (
            <><p className="muted">방 {route.session.code}에 연결 중…</p><button className="btn btn-ghost btn-sm" onClick={() => { saveSession(null); setRoute({ kind: 'title' }); }}>취소</button></>
          )}
        </div>
        <Toasts />
      </div>
    );
  }

  const isTeacher = view.me.role === 'teacher';
  let screen: React.ReactNode;
  if (view.room.status === 'lobby' || !view.game) screen = <LobbyScreen view={view} client={client} onLeave={leave} />;
  else if (isTeacher && (teacherView === 'board' || !view.me.teamId)) screen = <TeacherBoard view={view} client={client} onLeave={leave} teacherKey={loadTeacherKey()} onSwitchToTeam={view.me.teamId ? () => setTeacherView('team') : undefined} />;
  else screen = <GameScreen view={view} client={client} onLeave={leave} headerExtra={isTeacher ? <button className="btn btn-sm btn-ghost" onClick={() => setTeacherView('board')}>교사 보드</button> : undefined} />;
  return <><Suspense fallback={<Loading />}>{screen}</Suspense><Toasts /><ConnectionBadge /></>;
}
