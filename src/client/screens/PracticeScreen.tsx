import { useEffect, useMemo, useState } from 'react';
import type { PresetId } from '../../shared/types';
import { MASCOTS, PRESETS } from '../../shared/content';
import { LocalClient } from '../lib/local';
import { useAppState } from '../lib/store';
import { AssetImage, Backdrop } from '../components/AssetImage';
import { GameScreen } from './GameScreen';

/** 연습 (7.3-9): 서버 없이 AI 카페 한 곳과 6일 */
export function PracticeScreen({ presetId, onLeave }: { presetId: PresetId; onLeave: () => void }) {
  const [mascot, setMascot] = useState(MASCOTS[0]!.id);
  const [name, setName] = useState('우리 카페');
  const [started, setStarted] = useState(false);
  const client = useMemo(() => (started ? new LocalClient(presetId, 6, mascot, name || '우리 카페') : null), [started, presetId, mascot, name]);
  const { view } = useAppState();
  useEffect(() => () => client?.close(), [client]);
  useEffect(() => { if (client) void client.send({ type: 'start' }); }, [client]);
  if (!started) {
    return (
      <div className="screen title-screen">
        <Backdrop id="bg-lobby" />
        <div className="content title-panel stack">
          <h2>연습: {PRESETS[presetId].name}</h2>
          <label className="field">카페 이름<input value={name} onChange={(e) => setName(e.target.value)} maxLength={12} /></label>
          <div className="small"><b>마스코트</b></div>
          <div className="mascot-grid" role="radiogroup">
            {MASCOTS.map((m) => <button key={m.id} role="radio" aria-checked={mascot === m.id} className={`mascot ${mascot === m.id ? 'on' : ''}`} onClick={() => setMascot(m.id)}><AssetImage id={m.id} size={56} /><span className="small">{m.name}</span></button>)}
          </div>
          <button className="btn btn-primary btn-block" onClick={() => setStarted(true)}>6일 영업 시작</button>
          <button className="btn btn-ghost" onClick={onLeave}>처음으로</button>
        </div>
      </div>
    );
  }
  if (!client || !view || !view.game) return <div className="screen"><div className="content center"><p className="muted">준비 중…</p></div></div>;
  return <GameScreen view={view} client={client} onLeave={onLeave} />;
}
