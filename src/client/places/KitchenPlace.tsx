import { useMemo, useState } from 'react';
import type { GameView } from '../../shared/protocol';
import type { TeamState } from '../../shared/types';
import { EQUIPMENT, INGREDIENTS, MENUS, PRESETS, choiceElectricity, choiceUses, foodImage, resultReady, type Choice, type Menu } from '../../shared/content';
import { AssetImage } from '../components/AssetImage';
import { Coins, Modal, Tag } from '../components/common';
import { ResultScience } from '../components/Science';
import { audio } from '../lib/audio';
import type { Act } from './types';

type MenuStatus = { kind: 'ok' } | { kind: 'ingredients'; missing: string[] } | { kind: 'equipment'; equipment: string };

/** 선택지 가운데 하나라도 만들 수 있으면 「만들 수 있어요」 */
function menuStatus(m: Menu, team: TeamState): MenuStatus {
  if (m.equipment && !team.equipment.includes(m.equipment)) return { kind: 'equipment', equipment: m.equipment };
  let bestMissing: string[] | null = null;
  for (const c of m.choices) {
    const uses = choiceUses(m.id, c.id);
    const missing = Object.entries(uses).filter(([id, u]) => (team.stock[id] ?? 0) < u).map(([id, u]) => `${INGREDIENTS[id]!.name} ${u - (team.stock[id] ?? 0)}`);
    if (!missing.length) return { kind: 'ok' };
    if (!bestMissing || missing.length < bestMissing.length) bestMissing = missing;
  }
  return { kind: 'ingredients', missing: bestMissing ?? [] };
}

export function KitchenPlace({ game, team, act, canAct, pins, onPin }: { game: GameView; team: TeamState; act: Act; canAct: boolean; pins: Record<string, number>; onPin: (target: string, label: string) => void }) {
  const [making, setMaking] = useState<string | null>(null);
  const wanted = useMemo(() => new Set(team.customers.map((o) => o.menuId)), [team.customers]);
  const menus = useMemo(() => {
    const ids = PRESETS[game.presetId].menus.slice();
    ids.sort((a, b) => Number(wanted.has(b)) - Number(wanted.has(a)));
    return ids;
  }, [game.presetId, wanted]);
  return (
    <div className="place kitchen">
      <section className="card">
        <div className="card-title">메뉴</div>
        <div className="grid-cards">
          {menus.map((mid) => {
            const m = MENUS[mid]!;
            const st = menuStatus(m, team);
            const electricity = game.config.electricity[mid] ?? m.electricity;
            return (
              <div key={mid} className={`item-card menu ${st.kind === 'ok' ? 'can' : ''}`}>
                <button className="item-main" onClick={() => (canAct ? setMaking(mid) : onPin(`menu:${mid}`, m.name))} aria-label={`${m.name} ${canAct ? '만들기' : '추천'}`}>
                  <AssetImage id={m.image} size={72} />
                  <span className="item-name">{m.name}</span>
                  <span className="small muted">인분당 <Coins n={game.config.menuPrices[mid] ?? m.price} />{electricity > 0 && <> · 전기 {electricity}</>}</span>
                  {wanted.has(mid) && <Tag tone="coral">손님이 찾아요</Tag>}
                  {st.kind === 'ok' && <Tag tone="mint">만들 수 있어요</Tag>}
                  {st.kind === 'ingredients' && <Tag tone="line">재료가 모자라요: {st.missing.join(', ')}</Tag>}
                  {st.kind === 'equipment' && <Tag tone="line">{EQUIPMENT[st.equipment]?.name}가 필요해요</Tag>}
                  {pins[`menu:${mid}`] && <Tag tone="butter">추천 {pins[`menu:${mid}`]}</Tag>}
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <Storage team={team} day={game.day} />
      {making && <MakeFlow game={game} team={team} menuId={making} act={act} onClose={() => setMaking(null)} />}
    </div>
  );
}

export function Storage({ team, day }: { team: TeamState; day: number }) {
  return (
    <section className="card">
      <div className="card-title">보관함</div>
      {team.products.length === 0 ? <p className="muted small">아직 만든 음식이 없어요.</p> : (
        <ul className="storage-list">
          {team.products.map((p) => {
            const m = MENUS[p.menuId]!;
            const r = m.results[p.result]!;
            const when = p.readyDay > day ? '내일 아침 완성' : p.readyDay === day ? '오늘 만든 것' : '어제 만든 것 (오늘까지)';
            return (
              <li key={p.id} className="storage-item">
                <AssetImage id={foodImage(p.menuId, p.result, r.fail)} size={44} />
                <span><b>{r.name}</b> <span className="muted">({m.name})</span></span>
                <span className="small">{p.servings}인분 · {when}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** 만들기 세 단계: 레시피 → 조건 고르기 → 결과 */
function MakeFlow({ game, team, menuId, act, onClose }: { game: GameView; team: TeamState; menuId: string; act: Act; onClose: () => void }) {
  const m = MENUS[menuId]!;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [choice, setChoice] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ result: string } | null>(null);
  const cfg = game.config;
  const menuElec = cfg.electricity[menuId] ?? m.electricity;
  const waiting = team.customers.filter((o) => o.menuId === menuId);
  const chosen = choice ? m.choices.find((c) => c.id === choice) ?? null : null;
  const uses = chosen ? choiceUses(menuId, chosen.id) : m.ingredients;
  const elec = chosen ? choiceElectricity(menuId, chosen.id, menuElec) : menuElec;
  const missing = Object.entries(uses).filter(([id, u]) => (team.stock[id] ?? 0) < u);
  const lastDayOvernight = chosen && resultReady(menuId, chosen.result) === 'overnight' && game.day >= game.daysTotal;
  const confirm = async () => {
    if (!chosen) return;
    setBusy(true);
    const r = await act({ type: 'make', menuId, choice: chosen.id }, 'sfx-cook-start');
    setBusy(false);
    if (r.ok && r.result) { setDone({ result: r.result }); setStep(3); setTimeout(() => audio.sfx(m.sfx), 300); }
  };
  const showHint = () => { setHint(true); void act({ type: 'hint', menuId }); };
  return (
    <Modal title={`${m.name} 만들기`} onClose={onClose} closeLabel={step === 3 ? '닫기' : '취소'}>
      <div className="steps" aria-label="단계">
        {['레시피', '조건 고르기', '결과'].map((s, i) => <span key={s} className={`step ${step === i + 1 ? 'on' : ''}`}>{i + 1}. {s}</span>)}
      </div>
      {step === 1 && (
        <div className="stack">
          <div className="row"><AssetImage id={m.image} size={96} /><div className="stack-sm"><b>{m.name}</b><span className="small muted">{m.unit}</span></div></div>
          <div className="card-sub">
            <div className="small muted">재료 (만들기 1번)</div>
            <ul className="recipe-list">
              {Object.entries(m.ingredients).map(([id, u]) => <li key={id} className={(team.stock[id] ?? 0) < u ? 'lack' : ''}><AssetImage id={INGREDIENTS[id]!.image} size={28} /> {INGREDIENTS[id]!.name} {u} <span className="muted small">(가진 수 {team.stock[id] ?? 0})</span></li>)}
            </ul>
            <div className="small">전기 요금 {menuElec}코인 · 나오는 양 {cfg.servingsPerMake}인분{m.equipment && <> · 장비 {EQUIPMENT[m.equipment]!.name}</>}</div>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => setStep(2)}>조건 고르기</button>
        </div>
      )}
      {step === 2 && (
        <div className="stack">
          <p className="question">{m.question}</p>
          <ChoicePicker menu={m} value={choice} onChange={setChoice} />
          <div className="row-between">
            <button className="btn btn-ghost btn-sm" onClick={showHint}>원리 힌트</button>
            {chosen && <span className="small">{chosen.label}</span>}
          </div>
          {hint && <p className="hint-box">{m.principle}</p>}
          {waiting.length > 0 && (
            <div className="card-sub">
              <div className="small muted">이 메뉴를 기다리는 손님</div>
              {waiting.map((o) => <p key={o.id} className="bubble small">“{m.results[o.want]?.customerLine ?? ''}” <span className="muted">({o.servings}인분)</span></p>)}
            </div>
          )}
          {chosen && missing.length > 0 && <p className="warn small">재료가 모자라요: {missing.map(([id, u]) => `${INGREDIENTS[id]!.name} ${u - (team.stock[id] ?? 0)}`).join(', ')}</p>}
          {chosen && elec > team.coins && <p className="warn small">전기 요금 {elec}코인이 모자라요.</p>}
          {lastDayOvernight && <p className="warn small">오늘은 마지막 날이라 내일 아침에 완성되는 음식은 낼 수 없어요.</p>}
          <div className="row-between">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>이전</button>
            <button className="btn btn-primary" disabled={!chosen || missing.length > 0 || busy || team.actionsLeft <= 0 || team.ready || elec > team.coins} onClick={confirm}>만들기 (행동 1{elec > 0 ? `, 전기 ${elec}코인` : ''})</button>
          </div>
        </div>
      )}
      {step === 3 && done && (
        <ResultView menuId={menuId} result={done.result} presetId={game.presetId} onClose={onClose} />
      )}
    </Modal>
  );
}

export function ResultView({ menuId, result, presetId, onClose }: { menuId: string; result: string; presetId: GameView['presetId']; onClose: () => void }) {
  const m = MENUS[menuId]!;
  const r = m.results[result]!;
  return (
    <div className="stack result-view">
      <div className="result-hero">
        <AssetImage id={foodImage(menuId, result, r.fail)} size={160} />
        <h4>{r.name}</h4>
        {r.fail && <Tag tone="line">실패 결과 · 누구에게 내도 별 1개</Tag>}
        {resultReady(menuId, result) === 'overnight' && <Tag tone="butter">내일 아침 완성</Tag>}
      </div>
      <ResultScience menuId={menuId} result={result} presetId={presetId} />
      <button className="btn btn-primary btn-block" onClick={onClose}>보관함에 넣기</button>
    </div>
  );
}

/** 질문 종류에 따른 선택 조작: 단일 선택, 두 질문 조합(M07), 순서 배열(M08) */
function ChoicePicker({ menu, value, onChange }: { menu: Menu; value: string | null; onChange: (id: string) => void }) {
  if (menu.ui.kind === 'single') {
    return (
      <div className="choice-list" role="radiogroup">
        {menu.choices.map((c: Choice) => (
          <button key={c.id} role="radio" aria-checked={value === c.id} className={`choice ${value === c.id ? 'on' : ''}`} onClick={() => onChange(c.id)}>{c.label}</button>
        ))}
      </div>
    );
  }
  if (menu.ui.kind === 'two') return <TwoQuestions menu={menu} value={value} onChange={onChange} />;
  return <OrderPicker menu={menu} value={value} onChange={onChange} />;
}

function TwoQuestions({ menu, value, onChange }: { menu: Menu; value: string | null; onChange: (id: string) => void }) {
  const ui = menu.ui as Extract<Menu['ui'], { kind: 'two' }>;
  const parts = value ? value.split('+') : [];
  const [a, setA] = useState<string | null>(parts[0] ?? null);
  const [b, setB] = useState<string | null>(parts[1] ?? null);
  const pick = (qi: number, id: string) => {
    const na = qi === 0 ? id : a;
    const nb = qi === 1 ? id : b;
    if (qi === 0) setA(id); else setB(id);
    if (na && nb) onChange(`${na}+${nb}`);
  };
  return (
    <div className="stack">
      {ui.questions.map((q, qi) => (
        <div key={q.id} className="stack-sm">
          <div className="small"><b>{q.label}</b></div>
          <div className="choice-list row" role="radiogroup">
            {q.options.map((o) => { const sel = (qi === 0 ? a : b) === o.id; return <button key={o.id} role="radio" aria-checked={sel} className={`choice ${sel ? 'on' : ''}`} onClick={() => pick(qi, o.id)}>{o.label}</button>; })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 세 액체의 제시 순서는 시드·날짜·팀으로 섞인다 (부모가 넘긴 value 가 없으면 기본 순서) */
function OrderPicker({ menu, value, onChange }: { menu: Menu; value: string | null; onChange: (id: string) => void }) {
  const ui = menu.ui as Extract<Menu['ui'], { kind: 'order' }>;
  const [order, setOrder] = useState<string[]>(value ? value.split('>') : []);
  const remaining = ui.liquids.filter((l) => !order.includes(l.ingredientId));
  const push = (id: string) => {
    const next = [...order, id];
    setOrder(next);
    if (next.length === ui.liquids.length) onChange(next.join('>'));
  };
  const reset = () => { setOrder([]); };
  return (
    <div className="stack-sm">
      <div className="small muted">먼저 부을 것부터 차례로 누르세요. <span className="tiny">(밀도는 게임용 값)</span></div>
      <div className="row">
        {remaining.map((l) => <button key={l.ingredientId} className="choice" onClick={() => push(l.ingredientId)}><AssetImage id={INGREDIENTS[l.ingredientId]!.image} size={28} /> {l.name} <span className="tiny muted">{l.density}</span></button>)}
      </div>
      <div className="order-seq">
        {order.length === 0 ? <span className="muted small">아직 고르지 않았어요.</span> : order.map((id, i) => <span key={id} className="order-step">{i + 1}. {ui.liquids.find((l) => l.ingredientId === id)?.name}</span>)}
        {order.length > 0 && <button className="btn btn-ghost btn-sm" onClick={reset}>다시 고르기</button>}
      </div>
    </div>
  );
}
