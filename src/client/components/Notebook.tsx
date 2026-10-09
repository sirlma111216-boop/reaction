import type { PresetId, TeamState } from '../../shared/types';
import { EXTRA_CARDS, MENUS, PRESETS, showsChangeKind } from '../../shared/content';
import { AssetImage } from './AssetImage';
import { Tag } from './common';
import { Equation } from './Science';

/**
 * 원리 노트 (7.3-8). 메뉴판에 있는 메뉴와 장비의 원리 카드.
 * 한 번이라도 만든 메뉴는 만들어 본 결과의 「왜 그럴까?」까지, 아직 안 만든 메뉴는 원리 한 줄만.
 */
export function Notebook({ presetId, team }: { presetId: PresetId; team: TeamState | null }) {
  const preset = PRESETS[presetId];
  const showKind = showsChangeKind(presetId);
  return (
    <div className="notebook stack">
      <p className="small muted">실제로 따라 할 때는 선생님과 함께해요.</p>
      {preset.menus.map((mid) => {
        const m = MENUS[mid]!;
        const at = team?.attempts[mid];
        const tried = at && at.tries > 0 ? at.results : [];
        return (
          <section key={mid} className="card note-card">
            <div className="note-head">
              <AssetImage id={`principle-${mid.toLowerCase()}`} size={160} />
              <div className="stack-sm">
                <h4>{m.name}</h4>
                <span className="small muted">{m.unit} ({m.standards.join(', ')})</span>
                <p className="principle">{m.principle}</p>
                {showKind && m.changeKindText && <Tag tone="ink">{m.changeKindText}</Tag>}
              </div>
            </div>
            {tried.length > 0 && (
              <div className="note-results">
                <div className="small muted">만들어 본 결과</div>
                {tried.map((rk) => {
                  const r = m.results[rk]!;
                  return (
                    <div key={rk} className="note-result">
                      <b>{r.name}</b>
                      <span>{r.why}</span>
                      {showKind && r.changeKindText && <Tag tone="ink">{r.changeKindText}</Tag>}
                      {r.equation && <Equation text={r.equation} />}
                    </div>
                  );
                })}
              </div>
            )}
            {m.note && <p className="tiny muted">{m.note}</p>}
            {m.safety && <p className="safety small">{m.safety}</p>}
          </section>
        );
      })}
      {EXTRA_CARDS.filter((c) => c.presets.includes(presetId)).map((c) => (
        <section key={c.id} className="card note-card">
          <div className="note-head">
            <AssetImage id={c.image} size={120} />
            <div className="stack-sm">
              <h4>{c.title}</h4>
              <span className="small muted">({c.standards.join(', ')})</span>
              <p className="principle"><EquationText text={c.text} /></p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

/** 문장 안의 반응식(화살표가 있는 구절)만 수식으로 표시 */
function EquationText({ text }: { text: string }) {
  const m = text.match(/([A-Za-z0-9₀-₉()]+(?: \+ [A-Za-z0-9₀-₉()]+)* → [A-Za-z0-9₀-₉()]+(?: \+ [A-Za-z0-9₀-₉()]+)*)/);
  if (!m || m.index === undefined) return <>{text}</>;
  return <>{text.slice(0, m.index)}<Equation text={m[1]!} inline />{text.slice(m.index + m[1]!.length)}</>;
}
