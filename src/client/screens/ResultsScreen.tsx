import { useEffect, type ReactNode } from 'react';
import type { ClientView } from '../../shared/protocol';
import { MENUS } from '../../shared/content';
import { AssetImage, Backdrop } from '../components/AssetImage';
import { Coins, Tag } from '../components/common';
import { audio } from '../lib/audio';

/** 결과 화면 (7.3-5): 순이익 순위, 팀별 매출·지출·순이익, 평균 별점, 가장 많이 판 메뉴, 연출용 상, 우리 카페가 쓴 과학 */
export function ResultsScreen({ view, onLeave, headerExtra }: { view: ClientView; onLeave: () => void; headerExtra?: ReactNode }) {
  const results = view.game?.results ?? [];
  const mine = results.find((r) => r.teamId === view.me.teamId);
  useEffect(() => { audio.bgm('bgm-results'); }, []);
  return (
    <div className="screen results-screen">
      <Backdrop id="bg-results" />
      <div className="content stack">
        <header className="row-between">
          <h2>영업 결과</h2>
          <span className="row">{headerExtra}<button className="btn btn-ghost btn-sm" onClick={onLeave}>나가기</button></span>
        </header>
        <section className="card">
          <div className="card-title">순이익 순위</div>
          <ol className="rank-list">
            {results.map((r) => (
              <li key={r.teamId} className={`rank-item ${r.teamId === view.me.teamId ? 'mine' : ''}`} style={{ borderColor: r.color }}>
                <span className="rank-no">{r.rank}위</span>
                <AssetImage id={r.mascot} size={40} />
                <span className="rank-name"><b>{r.name}</b><span className="small muted">낸 인분 {r.servedServings} · 평균 별 {r.avgStars}</span></span>
                <span className="rank-net"><Coins n={r.netProfit} sign /></span>
              </li>
            ))}
          </ol>
        </section>
        <section className="card">
          <div className="card-title">카페별 기록</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>카페</th><th>매출</th><th>지출</th><th>순이익</th><th>평균 별점</th><th>가장 많이 판 메뉴</th><th>상</th></tr></thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.teamId}>
                    <td>{r.name}</td><td>{r.revenue}</td><td>{r.expenses}</td><td>{r.netProfit}</td><td>{r.avgStars}</td>
                    <td>{r.topMenu ? `${MENUS[r.topMenu.menuId]?.name ?? ''} ${r.topMenu.servings}인분` : '-'}</td>
                    <td>{r.awards.map((a) => <Tag key={a} tone="butter">{a}</Tag>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted">상은 연출용이에요. 순위에는 영향이 없어요. 별점왕: 평균 별점 최고, 과학 탐험가: 별 3개로 낸 메뉴 종류가 가장 많음, 알뜰왕: 폐기가 가장 적음.</p>
        </section>
        {mine && (
          <section className="card">
            <div className="card-title">우리 카페가 쓴 과학</div>
            {mine.scienceMenus.length === 0 ? <p className="muted small">별 3개로 낸 메뉴가 아직 없어요.</p> : (
              <ul className="science-list">
                {mine.scienceMenus.map((mid) => <li key={mid}><AssetImage id={MENUS[mid]!.image} size={40} /><span><b>{MENUS[mid]!.name}</b><br /><span className="small">{MENUS[mid]!.principle}</span></span></li>)}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
