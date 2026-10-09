import type { ReactNode } from 'react';
import type { PresetId } from '../../shared/types';
import { MENUS, showsChangeKind } from '../../shared/content';
import { Tag } from './common';

/** 반응식: 유니코드 아래 첨자를 진짜 <sub> 로 바꾸고, + 와 → 경계에서만 줄을 바꾼다 */
const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

function FormulaBody({ formula }: { formula: string }) {
  const parts: ReactNode[] = [];
  let buf = '';
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i]!;
    if (ch in SUB) {
      let digits = '';
      while (i < formula.length && formula[i]! in SUB) digits += SUB[formula[i++]!];
      if (buf) { parts.push(buf); buf = ''; }
      parts.push(<sub key={i}>{digits}</sub>);
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf) parts.push(buf);
  return <>{parts}</>;
}

export function Equation({ text, inline }: { text: string; inline?: boolean }) {
  const tokens = text.split(/ (\+|→) /);
  return (
    <span className={`equation ${inline ? 'inline' : ''}`} aria-label={text}>
      {tokens.map((tok, i) => (tok === '+' || tok === '→' ? <span key={i} className="eq-op"> {tok} </span> : <span key={i} className="eq-term"><FormulaBody formula={tok} /></span>))}
    </span>
  );
}

/** 결과 화면의 과학 정보: 「왜 그럴까?」, 변화 종류·반응식(해당 메뉴·메뉴판), 질량 표시, 안전 한 줄 */
export function ResultScience({ menuId, result, presetId }: { menuId: string; result: string; presetId: PresetId }) {
  const m = MENUS[menuId];
  const r = m?.results[result];
  if (!m || !r) return null;
  const showKind = showsChangeKind(presetId);
  const kind = r.changeKindText ?? m.changeKindText;
  return (
    <div className="result-science stack-sm">
      <p className="why"><b>왜 그럴까?</b> {r.why}</p>
      {showKind && kind && <div><Tag tone="ink">{kind}</Tag></div>}
      {r.equation && <div className="eq-box"><Equation text={r.equation} /></div>}
      {r.massNote && <p className="small">{r.massNote} <span className="tiny muted">(게임용 값)</span></p>}
      {m.safety && <p className="safety small">{m.safety}</p>}
    </div>
  );
}
