import { useState } from 'react';
import { Modal } from './common';
import { AssetImage } from './AssetImage';

/** 7.5 처음 쓰는 학생을 위한 도움말 4장 */
const CARDS: { title: string; image: string; lines: string[] }[] = [
  { title: '1. 시장에서 재료를 사요', image: 'ui-tab-market', lines: ['재료 카드를 눌러 장바구니에 담아요.', '한 번에 4종류, 합계 6개까지 살 수 있어요.', '장보기는 행동 1번을 써요.'] },
  { title: '2. 주방에서 만들며 조건을 골라요', image: 'ui-tab-kitchen', lines: ['메뉴를 고르고 과학 원리에 따라 조건 하나를 골라요.', '원리 힌트는 무료예요. 몇 번이든 볼 수 있어요.', '만들기 1번에 2인분이 나와요.'] },
  { title: '3. 카운터에서 손님에게 내요', image: 'ui-tab-counter', lines: ['손님이 원한 결과와 같으면 별 3개와 팁을 받아요.', '음식 내기는 행동을 쓰지 않아요.', '어제 만든 음식은 별점이 1 줄어요.'] },
  { title: '4. 오늘 영업을 마감해요', image: 'ui-stamp-closed', lines: ['할 일을 마치면 「오늘 영업 마감」을 눌러요.', '모든 카페가 마감하면 다음 날이 열려요.', '실제로 따라 할 때는 선생님과 함께해요.'] },
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const c = CARDS[i]!;
  return (
    <Modal title="리액션 카페 안내" onClose={onClose}>
      <div className="help-card">
        <AssetImage id={c.image} size={72} />
        <h4>{c.title}</h4>
        <ul>{c.lines.map((l) => <li key={l}>{l}</li>)}</ul>
      </div>
      <div className="row-between">
        <button className="btn btn-ghost" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>이전</button>
        <span className="muted small">{i + 1} / {CARDS.length}</span>
        {i < CARDS.length - 1 ? <button className="btn btn-primary" onClick={() => setI((x) => x + 1)}>다음</button> : <button className="btn btn-primary" onClick={onClose}>시작하기</button>}
      </div>
    </Modal>
  );
}
