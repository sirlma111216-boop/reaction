import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ClientView } from '../../shared/protocol';
import type { DayLedger, TeamCommand } from '../../shared/types';
import { MENUS, PRESETS } from '../../shared/content';
import { josa } from '../../shared/josa';
import { quoteServe } from '../../shared/engine/scoring';
import type { GameState } from '../../shared/types';
import type { GameClient } from '../lib/net';
import { audio } from '../lib/audio';
import { store } from '../lib/store';
import { prefGet, prefSet } from '../lib/session';
import { AssetImage, Backdrop } from '../components/AssetImage';
import { AudioSettings, Coins, GuideLine, Modal, Stat, Tag, WeatherChip } from '../components/common';
import { HelpModal } from '../components/Help';
import { Notebook } from '../components/Notebook';
import { MarketPlace, neededIngredients } from '../places/MarketPlace';
import { KitchenPlace } from '../places/KitchenPlace';
import { CounterPlace } from '../places/CounterPlace';
import type { Act } from '../places/types';
import { ResultsScreen } from './ResultsScreen';

type Place = 'market' | 'kitchen' | 'counter' | 'note';
const PLACES: { id: Place; name: string; icon: string; bg: string }[] = [
  { id: 'market', name: '시장', icon: 'ui-tab-market', bg: 'bg-market' },
  { id: 'kitchen', name: '주방', icon: 'ui-tab-kitchen', bg: 'bg-kitchen' },
  { id: 'counter', name: '카운터', icon: 'ui-tab-counter', bg: 'bg-counter' },
  { id: 'note', name: '원리 노트', icon: 'ui-tab-note', bg: 'bg-kitchen' },
];

export function GameScreen({ view, client, onLeave, headerExtra }: { view: ClientView; client: GameClient; onLeave: () => void; headerExtra?: ReactNode }) {
  const game = view.game!;
  const team = game.myTeam;
  const [place, setPlace] = useState<Place>('market');
  const [help, setHelp] = useState(() => prefGet('helpSeen', '0') !== '1');
  const [audioOpen, setAudioOpen] = useState(false);
  const [receipt, setReceipt] = useState<DayLedger | null>(null);
  const [seenSettle, setSeenSettle] = useState(game.settleCount);
  const isOperator = view.me.isOperator;
  const canAct = isOperator && view.room.status === 'playing' && game.phase === 'open';
  const lastDay = game.day >= game.daysTotal;

  useEffect(() => { audio.bgm(game.phase === 'finished' ? 'bgm-results' : lastDay ? 'bgm-lastday' : 'bgm-open'); }, [game.phase, lastDay]);

  // 정산이 끝나면 영수증을 띄운다
  useEffect(() => {
    if (!team) return;
    if (game.settleCount > seenSettle && team.receipts.length) {
      setReceipt(team.receipts[team.receipts.length - 1]!);
      setSeenSettle(game.settleCount);
      audio.sting('sting-day-close');
    }
  }, [game.settleCount, seenSettle, team]);

  const act: Act = async (cmd: TeamCommand, sfx?: string) => {
    const r = await client.send({ type: 'team', cmd });
    if (!r.ok) { store.toast(r.error ?? '지금은 할 수 없어요.', 'error'); audio.sfx('sfx-invalid'); }
    else if (sfx) audio.sfx(sfx);
    return r;
  };
  const pin = (target: string, label: string) => { void act({ type: 'pin', target, label }, 'sfx-tap'); store.toast(`${label}에 추천 표시를 남겼어요.`, 'info'); };
  const pins = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of team?.pins ?? []) out[p.target] = (out[p.target] ?? 0) + 1;
    return out;
  }, [team?.pins]);

  if (game.phase === 'finished' && game.results) return <ResultsScreen view={view} onLeave={onLeave} headerExtra={headerExtra} />;
  if (!team) {
    return (
      <div className="screen game-screen">
        <Backdrop id="bg-lobby" />
        <div className="content center stack">
          <h2>구경하는 중이에요</h2>
          <p className="muted">선생님이 팀에 넣어 주면 참여할 수 있어요.</p>
          <button className="btn btn-ghost" onClick={onLeave}>나가기</button>
        </div>
      </div>
    );
  }

  const operatorNick = view.players.find((p) => p.id === team.operatorId)?.nick ?? '팀원';
  const guide = guideText({ view, place, canAct, operatorNick });
  const qs = { day: game.day, daysTotal: game.daysTotal, weather: Array.from({ length: game.day }, () => game.weatherToday), config: game.config } as unknown as GameState;
  const servable = team.customers.filter((o) => Object.keys(MENUS[o.menuId]!.results).some((r) => quoteServe(qs, team, o, r))).length;
  const needed = Object.keys(neededIngredients(team)).length;
  const wantedMakeable = team.customers.filter((o) => { const m = MENUS[o.menuId]!; return !m.equipment || team.equipment.includes(m.equipment); }).length;
  const badge: Record<Place, string | null> = { market: needed ? `필요해요 ${needed}` : null, kitchen: wantedMakeable ? `찾는 메뉴 ${wantedMakeable}` : null, counter: servable ? `낼 수 있음 ${servable}` : null, note: null };
  const toggleReady = () => act({ type: 'ready', on: !team.ready }, 'sfx-ready');
  const current = PLACES.find((p) => p.id === place)!;

  return (
    <div className="screen game-screen">
      <Backdrop id={current.bg} />
      <header className="topbar">
        <div className="topbar-row">
          <span className="team-sign" style={{ borderColor: team.color }}><AssetImage id={team.mascot} size={28} /><b>{team.name}</b></span>
          <span className="day-chip">{game.day}일 차 / {game.daysTotal}일{lastDay && <Tag tone="coral">마지막 날</Tag>}</span>
          <WeatherChip w={game.weatherToday} label="오늘" />
          {game.weatherTomorrow && <WeatherChip w={game.weatherTomorrow} label="내일" />}
          <span className="spacer" />
          {headerExtra}
          <button className="btn btn-ghost btn-sm" onClick={() => setHelp(true)}>도움말</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAudioOpen((v) => !v)}>소리</button>
          <button className="btn btn-ghost btn-sm" onClick={onLeave}>나가기</button>
        </div>
        <div className="topbar-row">
          <Stat icon="ui-coin" label="코인" value={team.coins} />
          <span className="stat" title="남은 행동"><AssetImage id="ui-action" size={20} label="행동" /><span className="stat-label">행동</span><span className="action-boxes" aria-label={`남은 행동 ${team.actionsLeft}`}>{[0, 1, 2].map((i) => <span key={i} className={`abox ${i < team.actionsLeft ? 'on' : ''}`} />)}<b>{team.actionsLeft}</b></span></span>
          <span className="stat"><span className="stat-label">오늘의 점장</span><b>{operatorNick}</b></span>
          <span className="spacer" />
          <span className="small muted">마감 {game.readyCount}/{game.teamCount}</span>
          {isOperator && <button className={`btn ${team.ready ? 'btn-ghost' : 'btn-coral'}`} onClick={toggleReady}>{team.ready ? '마감 취소' : '오늘 영업 마감'}</button>}
          {team.ready && <span className="closed-stamp"><AssetImage id="ui-stamp-closed" size={28} label="마감" />마감함</span>}
        </div>
        <GuideLine text={guide} />
        {audioOpen && <AudioSettings />}
      </header>
      <nav className="place-tabs" role="tablist" aria-label="장소">
        {PLACES.map((p) => (
          <button key={p.id} role="tab" aria-selected={place === p.id} className={`place-tab ${place === p.id ? 'on' : ''}`} onClick={() => { setPlace(p.id); audio.sfx('sfx-tab'); }}>
            <AssetImage id={p.icon} size={24} label={p.name} />
            <span>{p.name}</span>
            {badge[p.id] && <span className="badge">{badge[p.id]}</span>}
          </button>
        ))}
      </nav>
      <main className="content place-content">
        {place === 'market' && <MarketPlace game={game} team={team} act={act} canAct={canAct} pins={pins} onPin={pin} />}
        {place === 'kitchen' && <KitchenPlace game={game} team={team} act={act} canAct={canAct} pins={pins} onPin={pin} />}
        {place === 'counter' && <CounterPlace game={game} team={team} act={act} canAct={canAct} pins={pins} onPin={pin} />}
        {place === 'note' && <Notebook presetId={game.presetId} team={team} />}
      </main>
      {help && <HelpModal onClose={() => { setHelp(false); prefSet('helpSeen', '1'); }} />}
      {receipt && <ReceiptModal ledger={receipt} teamName={team.name} onClose={() => setReceipt(null)} nextDay={game.day} daysTotal={game.daysTotal} />}
    </div>
  );
}

function guideText({ view, place, canAct, operatorNick }: { view: ClientView; place: Place; canAct: boolean; operatorNick: string }): string {
  const game = view.game!;
  const team = game.myTeam!;
  if (view.room.status === 'paused') return '선생님이 게임을 잠시 멈췄어요.';
  if (!view.me.isOperator) return `오늘의 점장은 ${operatorNick}${josa(operatorNick, '이에요/예요')}. 추천으로 도와주세요.`;
  if (team.ready) return '오늘 영업을 마감했어요. 다른 카페를 기다려요.';
  if (!canAct) return '잠시 기다려 주세요.';
  const hasStock = Object.values(team.stock).some((n) => n > 0);
  const hasFood = team.products.some((p) => p.readyDay <= game.day);
  if (game.day === 1) {
    if (!hasStock && !hasFood && team.actionsLeft === 3) return '시장에서 재료를 사요.';
    if (hasStock && !hasFood) return '주방에서 만들어요.';
    if (hasFood && team.customers.length) return '카운터에서 손님에게 내요.';
    if (team.actionsLeft === 0 || !team.customers.length) return '오늘 영업을 마감해요.';
  }
  if (team.actionsLeft === 0) return hasFood && team.customers.length ? '행동을 다 썼어요. 음식을 내고 마감해요.' : '행동을 다 썼어요. 오늘 영업을 마감해요.';
  if (place === 'market') return `행동이 ${team.actionsLeft}번 남았어요. 손님이 찾는 메뉴의 재료를 사요.`;
  if (place === 'kitchen') return '메뉴를 고르고 조건을 골라 만들어요. 원리 힌트는 무료예요.';
  if (place === 'counter') return hasFood ? '손님을 골라 음식을 내요. 음식 내기는 행동을 쓰지 않아요.' : '낼 음식이 없어요. 주방에서 만들어요.';
  return '원리 노트는 언제든 볼 수 있어요.';
}

/** 하루 마감 영수증 (7.3-4) */
export function ReceiptModal({ ledger, teamName, onClose, nextDay, daysTotal }: { ledger: DayLedger; teamName: string; onClose: () => void; nextDay: number; daysTotal: number }) {
  useEffect(() => { audio.bgm('bgm-closing'); return () => { audio.bgm(nextDay >= daysTotal ? 'bgm-lastday' : 'bgm-open'); }; }, [nextDay, daysTotal]);
  const wasteN = ledger.waste.reduce((a, w) => a + w.servings, 0);
  return (
    <Modal title={`${ledger.day}일 차 영수증`} onClose={onClose} closeLabel={`${nextDay}일 차로`}>
      <div className="receipt">
        <div className="receipt-head"><b>{teamName}</b><AssetImage id="ui-stamp-closed" size={40} label="마감" /></div>
        <Row k="오늘 매출" v={ledger.sales} />
        <Row k="팁" v={ledger.tips} />
        {ledger.weatherBonus > 0 && <Row k="날씨 보너스" v={ledger.weatherBonus} />}
        {ledger.takeoutBonus > 0 && <Row k="포장 보너스" v={ledger.takeoutBonus} />}
        {ledger.groupBonus > 0 && <Row k="단체 주문 보너스" v={ledger.groupBonus} />}
        {ledger.aid > 0 && <Row k="긴급 지원" v={ledger.aid} />}
        <Row k="재료비" v={-ledger.ingredients} />
        <Row k="전기 요금" v={-ledger.electricity} />
        <Row k="장비 구입" v={-ledger.equipment} />
        <div className="receipt-row"><span>폐기한 음식</span><span>{wasteN ? ledger.waste.map((w) => `${MENUS[w.menuId]!.results[w.result]!.name} ${w.servings}인분`).join(', ') : '없음'}</span></div>
        <div className="receipt-row total"><span>오늘 순이익</span><Coins n={ledger.net} sign /></div>
        <div className="receipt-row total"><span>누적 순이익</span><Coins n={ledger.cumulative} sign /></div>
      </div>
      <button className="btn btn-primary btn-block" onClick={onClose}>{nextDay}일 차 시작</button>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return <div className="receipt-row"><span>{k}</span><span>{v > 0 ? '+' : ''}{v}</span></div>;
}

export { PRESETS };
