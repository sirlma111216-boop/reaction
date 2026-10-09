import type { PresetId } from '../types';

export interface Equipment {
  id: string;
  name: string;
  price: number;
  /** 1번 쓸 때 전기 요금 */
  electricity: number;
  /** 화면용 효과 설명 */
  effect: string;
  /** 이 장비로 만들 수 있는 메뉴 */
  enables: string[];
  firstPreset: PresetId;
  image: string;
}

/** 4.2 장비 6종. 가스레인지는 모든 팀이 처음부터 갖고 있어 여기 없다. */
export const EQUIPMENT: Record<string, Equipment> = {
  'mixer': { id: 'mixer', name: '스탠드 믹서', price: 8, electricity: 1, effect: '질소 아이스크림을 만들 수 있어요', enables: ['M01'], firstPreset: 'grade1', image: 'eq-mixer' },
  'oven': { id: 'oven', name: '미니 오븐', price: 6, electricity: 1, effect: '마시멜로 핫초코를 만들 수 있어요', enables: ['M05'], firstPreset: 'grade1', image: 'eq-oven' },
  'puffer': { id: 'puffer', name: '뻥튀기 기계', price: 6, electricity: 0, effect: '뻥튀기를 만들 수 있어요', enables: ['M04'], firstPreset: 'grade1', image: 'eq-puffer' },
  'packaging': { id: 'packaging', name: '보온 포장 세트', price: 6, electricity: 0, effect: '매일 포장 손님이 1명 더 와요 (주문당 +2코인)', enables: [], firstPreset: 'grade1', image: 'eq-packaging' },
  'carbonator': { id: 'carbonator', name: '탄산 주입기', price: 8, electricity: 0, effect: '탄산 에이드를 만들 수 있어요', enables: ['M07'], firstPreset: 'grade2', image: 'eq-carbonator' },
  'griddle': { id: 'griddle', name: '전기 그리들', price: 7, electricity: 2, effect: '팬케이크를 만들 수 있어요', enables: ['M11'], firstPreset: 'grade3', image: 'eq-griddle' },
};

export const EQUIPMENT_IDS = Object.keys(EQUIPMENT);

/** 기본 장비: 살 필요가 없고 원리 노트에 카드로만 나온다. */
export const GAS_STOVE = { id: 'gas-stove', name: '가스레인지', image: 'eq-gas-stove' } as const;
