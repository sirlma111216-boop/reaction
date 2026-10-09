import { useEffect, useState } from 'react';
import { AUDIO_ASSETS, IMAGE_ASSETS, type ImageGroup } from '../../shared/content/assets';
import { AssetImage } from '../components/AssetImage';
import { Wordmark } from '../components/common';
import { audioStatus, imageStatus } from '../lib/assets';

const GROUPS: [ImageGroup, string][] = [['background', '배경 7장'], ['menu', '메뉴 19장'], ['ingredient', '재료 16장'], ['equipment', '장비 7장'], ['customer', '손님 10장'], ['mascot', '마스코트 8장과 안내 캐릭터 1장'], ['weather', '날씨 3장'], ['ui', '화면 요소 11장'], ['principle', '원리 장면 14장']];

/** 자산 검수 (/asset-review): 모든 그림·소리 자리와 파일 유무를 한눈에 본다 */
export function AssetReview({ onLeave }: { onLeave: () => void }) {
  const [, force] = useState(0);
  useEffect(() => { const h = setTimeout(() => force((x) => x + 1), 1500); return () => clearTimeout(h); }, []);
  const imgOk = IMAGE_ASSETS.filter((a) => imageStatus(a.id) === 'ok').length;
  const audOk = AUDIO_ASSETS.filter((a) => audioStatus(a.id) === 'ok').length;
  return (
    <div className="screen asset-review">
      <div className="content stack">
        <header className="row-between">
          <Wordmark compact />
          <span className="row"><span className="tag tag-line">그림 {imgOk}/{IMAGE_ASSETS.length} · 소리 {audOk}/{AUDIO_ASSETS.length}</span><button className="btn btn-sm btn-ghost" onClick={onLeave}>처음으로</button></span>
        </header>
        <p className="small muted">원본 그림은 <code>assets-source/images/&lt;ID&gt;.png</code>, 소리는 <code>public/assets/audio/&lt;ID&gt;.mp3</code> 에 넣고 <code>npm run assets:build</code> 를 실행해요. 파일이 없는 자리는 점선 상자로 보여요.</p>
        {GROUPS.map(([g, title]) => (
          <section key={g} className="card">
            <div className="card-title">{title}</div>
            <div className="ar-grid">
              {IMAGE_ASSETS.filter((a) => a.group === g).map((a) => (
                <div key={a.id} className={`ar-cell ${imageStatus(a.id) === 'ok' ? '' : 'miss'}`}>
                  <AssetImage id={a.id} size={g === 'background' || g === 'principle' ? 160 : 96} />
                  <b className="small">{a.name}</b>
                  <code className="tiny">{a.id}</code>
                  <span className="tiny muted">{a.width}×{a.height}{a.alpha ? ' 투명' : ''} · {imageStatus(a.id) === 'ok' ? '파일 있음' : '파일 없음'}</span>
                  <span className="tiny muted">{a.usedIn}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
        <section className="card">
          <div className="card-title">소리 35개</div>
          <div className="table-wrap">
            <table className="table small">
              <thead><tr><th>ID</th><th>이름</th><th>종류</th><th>쓰이는 곳</th><th>파일</th></tr></thead>
              <tbody>{AUDIO_ASSETS.map((a) => <tr key={a.id} className={audioStatus(a.id) === 'ok' ? '' : 'miss'}><td><code>{a.id}</code></td><td>{a.name}</td><td>{a.kind}</td><td>{a.usedIn}</td><td>{audioStatus(a.id) === 'ok' ? '있음' : '없음'}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
