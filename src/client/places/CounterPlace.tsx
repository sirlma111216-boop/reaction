import { useState } from 'react';
import type { GameView } from '../../shared/protocol';
import type { GameState, Order, TeamState } from '../../shared/types';
import { MENUS, customerName, foodImage, GROUP_CUSTOMER } from '../../shared/content';
import { quoteGroup, quoteServe } from '../../shared/engine/scoring';
import { AssetImage } from '../components/AssetImage';
import { Coins, Modal, Stars, Tag } from '../components/common';
import { audio } from '../lib/audio';
import type { Act } from './types';

/** 견적 계산에 쓸 최소 상태 (서버와 같은 함수를 쓴다) */
function quoteState(game: GameView): GameState {
  return { day: game.day, daysTotal: game.daysTotal, weather: [game.weatherToday], config: game.config } as unknown as GameState;
}

export function CounterPlace({ game, team, act, canAct, pins, onPin }: { game: GameView; team: TeamState; act: Act; canAct: boolean; pins: Record<string, number>; onPin: (target: string, label: string) => void }) {
  const [sel, setSel] = useState<{ kind: 'order'; order: Order } | { kind: 'group'; id: string } | null>(null);
  const [celebrate, setCelebrate] = useState<{ stars: number; paid: number } | null>(null);
  const qs = { ...quoteState(game), weather: Array.from({ length: game.day }, () => game.weatherToday) } as GameState;
  const resultsOf = (menuId: string) => Object.keys(MENUS[menuId]!.results);
  const servableCount = (o: Order) => resultsOf(o.menuId).filter((r) => quoteServe(qs, team, o, r)).length;
  const onServed = (stars: number, paid: number) => {
    setSel(null);
    setCelebrate({ stars, paid });
    audio.sfx('sfx-serve');
    setTimeout(() => audio.sfx(`sfx-stars-${stars}`), 250);
    setTimeout(() => audio.sfx(stars === 3 ? 'sfx-tip' : 'sfx-coin'), 600);
    setTimeout(() => setCelebrate(null), 2200);
  };
  return (
    <div className="place counter">
      <section className="card">
        <div className="card-title">손님 줄 <span className="small muted">{team.customers.length}명</span></div>
        {team.customers.length === 0 ? <p className="muted small">지금은 손님이 없어요. 내일 아침에 새 손님이 와요.</p> : (
          <div className="customer-list">
            {team.customers.map((o) => {
              const m = MENUS[o.menuId]!;
              const want = m.results[o.want]!;
              const n = servableCount(o);
              return (
                <div key={o.id} className={`customer ${n ? 'servable' : ''}`}>
                  <AssetImage id={o.customer} size={64} label={customerName(o.customer)} />
                  <div className="customer-body">
                    <p className="bubble">“{want.customerLine ?? want.name}”</p>
                    <div className="small"><b>{m.name}</b> · {want.name} · {o.servings}인분 · 대금 <Coins n={o.price * o.servings} />{o.takeout && <Tag tone="mint">포장 +{game.config.takeoutBonus}</Tag>}</div>
                    <div className="small muted">{o.leaveDay <= game.day ? '오늘까지' : '내일까지'}{pins[`order:${o.id}`] ? ` · 추천 ${pins[`order:${o.id}`]}` : ''}</div>
                  </div>
                  {canAct ? <button className="btn btn-sm btn-primary" disabled={!n || team.ready} onClick={() => setSel({ kind: 'order', order: o })}>{n ? `낼 수 있음 ${n}` : '음식 없음'}</button> : <button className="btn btn-sm btn-ghost" onClick={() => onPin(`order:${o.id}`, m.name)}>추천</button>}
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section className="card">
        <div className="card-title">단체 주문 게시판</div>
        {game.groupOrders.length === 0 ? <p className="muted small">지금은 단체 주문이 없어요.</p> : game.groupOrders.map((g) => {
          const m = MENUS[g.menuId]!;
          const done = team.groupDone.includes(g.id);
          const n = resultsOf(g.menuId).filter((r) => quoteGroup(qs, team, g.menuId, g.want, g.servings, g.price, r)).length;
          return (
            <div key={g.id} className="customer group">
              <AssetImage id={GROUP_CUSTOMER.id} size={64} label={GROUP_CUSTOMER.name} />
              <div className="customer-body">
                <p className="bubble">“{m.results[g.want]!.customerLine ?? m.results[g.want]!.name}”</p>
                <div className="small"><b>{m.name}</b> · {m.results[g.want]!.name} · {g.servings}인분 · 대금 <Coins n={g.price * g.servings} /> · 별 3개면 팁 {game.config.tipPerServing * g.servings}과 보너스 {game.config.groupBonus}</div>
                <div className="small muted">기한 {g.dueDay <= game.day ? '오늘까지' : '내일까지'} · {done ? '우리 카페는 냈어요' : '아직 안 냈어요'}</div>
              </div>
              {canAct && !done && <button className="btn btn-sm btn-primary" disabled={!n || team.ready} onClick={() => setSel({ kind: 'group', id: g.id })}>{n ? '내기' : '음식 없음'}</button>}
              {done && <Tag tone="mint">완료</Tag>}
            </div>
          );
        })}
      </section>
      {sel && sel.kind === 'order' && (
        <Modal title="어떤 음식을 낼까요?" onClose={() => setSel(null)}>
          <p className="small">{MENUS[sel.order.menuId]!.name} · 원하는 것: <b>{MENUS[sel.order.menuId]!.results[sel.order.want]!.name}</b> · {sel.order.servings}인분</p>
          <div className="serve-options">
            {resultsOf(sel.order.menuId).map((r) => {
              const q = quoteServe(qs, team, sel.order, r);
              if (!q) return null;
              const res = MENUS[sel.order.menuId]!.results[r]!;
              return (
                <button key={r} className="serve-option" onClick={async () => { const x = await act({ type: 'serve', orderId: sel.order.id, result: r }); if (x.ok) onServed(x.stars ?? q.stars, x.paid ?? q.total); }}>
                  <AssetImage id={foodImage(sel.order.menuId, r, res.fail)} size={56} />
                  <span className="stack-sm">
                    <b>{res.name}</b>
                    <Stars n={q.stars} size={14} />
                    <span className="small">예상 <Coins n={q.total} />{q.tip ? ` (팁 ${q.tip})` : ''}{q.weatherBonus ? ` (날씨 +${q.weatherBonus})` : ''}{q.takeoutBonus ? ` (포장 +${q.takeoutBonus})` : ''}{q.stale ? ' · 어제 만든 것' : ''}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
      {sel && sel.kind === 'group' && (() => {
        const g = game.groupOrders.find((x) => x.id === sel.id);
        if (!g) return null;
        return (
          <Modal title="단체 주문에 낼 음식" onClose={() => setSel(null)}>
            <div className="serve-options">
              {resultsOf(g.menuId).map((r) => {
                const q = quoteGroup(qs, team, g.menuId, g.want, g.servings, g.price, r);
                if (!q) return null;
                const res = MENUS[g.menuId]!.results[r]!;
                return (
                  <button key={r} className="serve-option" onClick={async () => { const x = await act({ type: 'serveGroup', groupOrderId: g.id, result: r }); if (x.ok) onServed(x.stars ?? q.stars, x.paid ?? q.total); }}>
                    <AssetImage id={foodImage(g.menuId, r, res.fail)} size={56} />
                    <span className="stack-sm"><b>{res.name}</b><Stars n={q.stars} size={14} /><span className="small">예상 <Coins n={q.total} /></span></span>
                  </button>
                );
              })}
            </div>
          </Modal>
        );
      })()}
      {celebrate && (
        <div className="celebrate" role="status">
          <Stars n={celebrate.stars} size={28} />
          <span className="celebrate-coins"><Coins n={celebrate.paid} sign /></span>
        </div>
      )}
    </div>
  );
}
