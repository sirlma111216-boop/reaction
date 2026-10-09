import { useMemo, useState } from 'react';
import type { GameView } from '../../shared/protocol';
import type { TeamState } from '../../shared/types';
import { EQUIPMENT, INGREDIENTS, MENUS, PRESETS } from '../../shared/content';
import { josa } from '../../shared/josa';
import { AssetImage } from '../components/AssetImage';
import { Coins, Tag } from '../components/common';
import type { Act } from './types';

/** 선택한 메뉴판의 메뉴에 쓰이는 재료 (메뉴에서 자동으로 뽑는다) */
function shopList(presetId: GameView['presetId']): string[] {
  const set = new Set<string>();
  for (const mid of PRESETS[presetId].menus) for (const ing of Object.keys(MENUS[mid]!.ingredients)) set.add(ing);
  return Object.keys(INGREDIENTS).filter((id) => set.has(id));
}

/** 손님이 주문한 메뉴에 필요한데 모자라는 재료 */
export function neededIngredients(team: TeamState): Record<string, number> {
  const need: Record<string, number> = {};
  for (const o of team.customers) for (const [id, u] of Object.entries(MENUS[o.menuId]!.ingredients)) need[id] = Math.max(need[id] ?? 0, u);
  const out: Record<string, number> = {};
  for (const [id, u] of Object.entries(need)) if ((team.stock[id] ?? 0) < u) out[id] = u - (team.stock[id] ?? 0);
  return out;
}

export function MarketPlace({ game, team, act, canAct, pins, onPin }: { game: GameView; team: TeamState; act: Act; canAct: boolean; pins: Record<string, number>; onPin: (target: string, label: string) => void }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const cfg = game.config;
  const shop = useMemo(() => shopList(game.presetId), [game.presetId]);
  const needed = useMemo(() => neededIngredients(team), [team]);
  const kinds = Object.keys(cart).filter((k) => cart[k]! > 0);
  const units = kinds.reduce((a, k) => a + cart[k]!, 0);
  const cost = kinds.reduce((a, k) => a + cart[k]! * (cfg.ingredientPrices[k] ?? 0), 0);
  const add = (id: string) => {
    const nk = kinds.includes(id) ? kinds.length : kinds.length + 1;
    if (nk > cfg.buyMaxKinds || units + 1 > cfg.buyMaxUnits) return;
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  };
  const remove = (id: string) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) - 1) }));
  const buy = async () => {
    const r = await act({ type: 'buy', items: kinds.map((k) => ({ ingredientId: k, units: cart[k]! })) }, 'sfx-buy');
    if (r.ok) setCart({});
  };
  const equipment = PRESETS[game.presetId].equipment;
  return (
    <div className="place market">
      <section className="card">
        <div className="card-title">재료</div>
        <div className="grid-cards">
          {shop.map((id) => {
            const ing = INGREDIENTS[id]!;
            const have = team.stock[id] ?? 0;
            const inCart = cart[id] ?? 0;
            return (
              <div key={id} className={`item-card ${inCart ? 'selected' : ''}`}>
                <button className="item-main" onClick={() => (canAct ? add(id) : onPin(`ing:${id}`, ing.name))} aria-label={`${ing.name} ${canAct ? '담기' : '추천'}`}>
                  <AssetImage id={ing.image} size={64} />
                  <span className="item-name">{ing.name}</span>
                  <span className="item-price"><Coins n={cfg.ingredientPrices[id] ?? ing.price} /></span>
                  <span className="small muted">가진 수 {have}</span>
                  {needed[id] && <Tag tone="coral">필요해요 {needed[id]}</Tag>}
                  {pins[`ing:${id}`] && <Tag tone="butter">추천 {pins[`ing:${id}`]}</Tag>}
                </button>
                {inCart > 0 && (
                  <div className="qty-row">
                    <button className="btn btn-sm btn-ghost" onClick={() => remove(id)} aria-label="하나 빼기">−</button>
                    <b>{inCart}</b>
                    <button className="btn btn-sm btn-ghost" onClick={() => add(id)} aria-label="하나 더">+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      {canAct && (
        <section className="card cart">
          <div className="card-title">장바구니 <span className="small muted">({kinds.length}/{cfg.buyMaxKinds}종류 · {units}/{cfg.buyMaxUnits}개)</span></div>
          {kinds.length === 0 ? <p className="muted small">재료 카드를 누르면 담겨요.</p> : (
            <ul className="cart-list">
              {kinds.map((k) => <li key={k}>{INGREDIENTS[k]!.name} × {cart[k]} <span className="muted">= {cart[k]! * (cfg.ingredientPrices[k] ?? 0)}코인</span></li>)}
            </ul>
          )}
          <div className="row-between">
            <span>합계 <Coins n={cost} /> {cost > team.coins && <Tag tone="coral">코인이 {cost - team.coins} 모자라요</Tag>}</span>
            <button className="btn btn-primary" disabled={!kinds.length || cost > team.coins || team.actionsLeft <= 0 || team.ready} onClick={buy}>사기 (행동 1)</button>
          </div>
        </section>
      )}
      <section className="card">
        <div className="card-title">장비 진열대</div>
        <div className="grid-cards">
          {equipment.map((id) => {
            const eq = EQUIPMENT[id]!;
            const owned = team.equipment.includes(id);
            const price = cfg.equipmentPrices[id] ?? eq.price;
            return (
              <div key={id} className={`item-card equip ${owned ? 'owned' : ''}`}>
                <AssetImage id={eq.image} size={72} />
                <span className="item-name">{eq.name}</span>
                <span className="small">{eq.enables.length ? `${eq.enables.map((m) => MENUS[m]!.name).join(', ')}${josa(MENUS[eq.enables[eq.enables.length - 1]!]!.name, '을/를')} 만들 수 있어요` : eq.effect}</span>
                <span className="small muted">쓸 때마다 전기 요금 {eq.electricity}코인</span>
                {owned ? <Tag tone="mint">설치됨</Tag> : canAct ? <button className="btn btn-sm btn-primary" disabled={price > team.coins || team.actionsLeft <= 0 || team.ready} onClick={() => act({ type: 'equip', equipmentId: id }, 'sfx-equip')}>설치 <Coins n={price} /> (행동 1)</button> : <span className="row"><Coins n={price} /><button className="btn btn-sm btn-ghost" onClick={() => onPin(`eq:${id}`, eq.name)}>추천</button></span>}
                {pins[`eq:${id}`] && <Tag tone="butter">추천 {pins[`eq:${id}`]}</Tag>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
