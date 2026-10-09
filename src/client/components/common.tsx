import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAppState } from '../lib/store';
import { AssetImage } from './AssetImage';
import { WEATHER_IMAGE, WEATHER_NAME } from '../../shared/content/assets';
import { audio } from '../lib/audio';

export function Modal({ title, onClose, children, wide, closeLabel = '닫기' }: { title: ReactNode; onClose?: () => void; children: ReactNode; wide?: boolean; closeLabel?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="modal-bg" onClick={onClose} role="presentation">
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head"><h3>{title}</h3>{onClose && <button className="btn btn-ghost btn-sm" onClick={onClose}>{closeLabel}</button>}</div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Toasts() {
  const { toasts } = useAppState();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className={`toast ${t.level}`}>{t.text}</div>)}
    </div>
  );
}

export function ConnectionBadge() {
  const { connection, closedReason, pendingCount } = useAppState();
  if (connection === 'open' && pendingCount === 0) return null;
  if (connection === 'idle') return null;
  const text = connection === 'connecting' ? '연결 중…' : connection === 'reconnecting' ? '다시 연결 중…' : connection === 'closed' ? (closedReason ?? '연결 종료') : pendingCount > 0 ? '서버 확인 중…' : '';
  return <div className="conn"><span className={`tag ${connection === 'closed' ? 'tag-coral' : 'tag-butter'}`}>{text}</span></div>;
}

/** 수치 + 아이콘 자리 (코인·행동·별점·전기 요금) */
export function Stat({ icon, label, value, className }: { icon: string; label: string; value: ReactNode; className?: string }) {
  return (
    <span className={`stat ${className ?? ''}`} title={label}>
      <AssetImage id={icon} size={20} label={label} />
      <span className="stat-label">{label}</span>
      <b className="stat-value">{value}</b>
    </span>
  );
}

export function Coins({ n, sign }: { n: number; sign?: boolean }) {
  return <span className="coins"><AssetImage id="ui-coin" size={16} label="코인" />{sign && n > 0 ? '+' : ''}{n}</span>;
}

export function Stars({ n, size = 18 }: { n: number; size?: number }) {
  return (
    <span className="stars" aria-label={`별 ${n}개`} title={`별 ${n}개`}>
      {[1, 2, 3].map((i) => <span key={i} className={`star ${i <= n ? 'on' : 'off'}`}><AssetImage id="ui-star" size={size} label="별" /></span>)}
      <span className="stars-text">별 {n}개</span>
    </span>
  );
}

export function WeatherChip({ w, label }: { w: string; label: string }) {
  return <span className="weather-chip"><AssetImage id={WEATHER_IMAGE[w] ?? 'weather-sunny'} size={22} label={WEATHER_NAME[w] ?? w} /><span>{label} {WEATHER_NAME[w] ?? w}</span></span>;
}

export function Tag({ children, tone = 'line' }: { children: ReactNode; tone?: 'line' | 'mint' | 'coral' | 'butter' | 'ink' }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

/** 안내 로봇과 안내 한 줄 */
export function GuideLine({ text }: { text: string }) {
  return (
    <div className="guide-line" role="status">
      <AssetImage id="npc-guide" size={32} label="안내" />
      <span>{text}</span>
    </div>
  );
}

export function AudioSettings() {
  return (
    <div className="card stack small">
      <label className="row"><input type="checkbox" checked={audio.bgmOn} onChange={(e) => { audio.setBgm(e.target.checked); }} /> 배경 음악</label>
      <label className="row"><input type="checkbox" checked={audio.sfxOn} onChange={(e) => { audio.setSfx(e.target.checked); }} /> 효과음</label>
      <label className="row">음악 음량 <input type="range" min={0} max={1} step={0.05} defaultValue={audio.bgmVolume} onChange={(e) => audio.setBgmVolume(Number(e.target.value))} /></label>
      <label className="row">효과음 음량 <input type="range" min={0} max={1} step={0.05} defaultValue={audio.sfxVolume} onChange={(e) => audio.setSfxVolume(Number(e.target.value))} /></label>
      <p className="muted">소리 파일이 없으면 무음으로 동작해요. 학생 기기는 배경 음악이 꺼져 있는 것이 기본이에요.</p>
    </div>
  );
}

export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <div className={`wordmark ${compact ? 'compact' : ''}`}>
      <AssetImage id="ui-logo" size={compact ? 32 : 72} label="로고" />
      <h1>리액션 카페</h1>
    </div>
  );
}
