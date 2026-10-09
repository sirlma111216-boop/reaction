/** 리액션 카페 — 공유 타입. 서버·연습 모드·시뮬레이터가 같은 엔진과 같은 상태 모양을 쓴다. */

export type PresetId = 'grade1' | 'grade2' | 'grade3' | 'chem';
export type Weather = 'sunny' | 'hot' | 'cold';
/** 메뉴·결과의 온도 (날씨 보너스용) */
export type Temperature = 'warm' | 'cold' | 'none';
export type ChangeKind = 'physical' | 'chemical' | 'both';

export interface EconomyConfig {
  version: string;
  startCoins: number;
  actionsPerDay: number;
  servingsPerMake: number;
  buyMaxKinds: number;
  buyMaxUnits: number;
  customersPerDay: number;
  /** 손님이 기다리는 날 수 (온 날 포함). 2 = 온 날과 그다음 날 */
  customerWaitDays: number;
  queueMax: number;
  tipPerServing: number;
  weatherBonusPerServing: number;
  groupServings: number;
  groupBonus: number;
  takeoutBonus: number;
  /** 2인분 주문 비율 (0~1) */
  twoServingRate: number;
  /** 긴급 지원 기준·지급 코인 */
  aidThreshold: number;
  aidCoins: number;
  ingredientPrices: Record<string, number>;
  equipmentPrices: Record<string, number>;
  /** 메뉴별 인분당 가격. 결과별 가격은 `menuId:result` 키 */
  menuPrices: Record<string, number>;
  /** 메뉴별 전기 요금 (1번 만들 때) */
  electricity: Record<string, number>;
}

export interface Product {
  id: string;
  menuId: string;
  result: string;
  servings: number;
  /** 완성되는 날. 하룻밤 음식은 만든 날 + 1 */
  readyDay: number;
  madeDay: number;
}

export interface Order {
  id: string;
  /** 손님 캐릭터 ID (연출용) */
  customer: string;
  menuId: string;
  want: string;
  servings: number;
  /** 인분당 가격 */
  price: number;
  takeout: boolean;
  arriveDay: number;
  /** 이 날 마감 정산 때 떠난다 */
  leaveDay: number;
}

export interface GroupOrder {
  id: string;
  menuId: string;
  want: string;
  servings: number;
  /** 인분당 가격 */
  price: number;
  openDay: number;
  dueDay: number;
}

export interface WasteEntry { menuId: string; result: string; servings: number }

export interface DayLedger {
  day: number;
  sales: number;
  tips: number;
  weatherBonus: number;
  takeoutBonus: number;
  groupBonus: number;
  ingredients: number;
  electricity: number;
  equipment: number;
  aid: number;
  waste: WasteEntry[];
  servedServings: number;
  /** 오늘 순이익 */
  net: number;
  /** 이날까지의 누적 순이익 */
  cumulative: number;
}

export interface Pin { playerId: string; target: string; label: string; at: number }

export interface GameEvent { day: number; teamId: string | null; type: string; text: string }

export interface MenuAttempt {
  tries: number;
  firstOk: boolean;
  hintUsed: boolean;
  /** 만들어 본 선택지 ID */
  choices: string[];
  /** 만들어 본 결과 키 */
  results: string[];
  /** 별 3개로 낸 적이 있는지 */
  threeStar: boolean;
}

export interface ServeRecord { day: number; menuId: string; result: string; servings: number; stars: number; group: boolean; paid: number; takeout: boolean }

export interface TeamState {
  id: string;
  name: string;
  color: string;
  mascot: string;
  coins: number;
  actionsLeft: number;
  /** 오늘 영업 마감 */
  ready: boolean;
  operatorId: string | null;
  stock: Record<string, number>;
  products: Product[];
  equipment: string[];
  customers: Order[];
  groupDone: string[];
  today: DayLedger;
  receipts: DayLedger[];
  attempts: Record<string, MenuAttempt>;
  pins: Pin[];
  served: ServeRecord[];
  /** 날짜별 누적 순이익 (receipts 와 같은 길이) */
  netHistory: number[];
}

export interface FinalTeamResult {
  teamId: string;
  name: string;
  color: string;
  mascot: string;
  rank: number;
  netProfit: number;
  coins: number;
  revenue: number;
  expenses: number;
  servedServings: number;
  avgStars: number;
  starsCount: number;
  wasteServings: number;
  topMenu: { menuId: string; servings: number } | null;
  awards: string[];
  /** 별 3개로 낸 메뉴 ID (우리 카페가 쓴 과학) */
  scienceMenus: string[];
}

export interface GameState {
  rulesVersion: 1;
  contentVersion: string;
  seed: string;
  presetId: PresetId;
  daysTotal: number;
  /** 0 = 시작 전 */
  day: number;
  phase: 'setup' | 'open' | 'finished';
  config: EconomyConfig;
  /** 저장되는 ID 카운터 */
  nextId: number;
  /** 날짜별 날씨 (index 0 = 1일 차). 시작할 때 고정 */
  weather: Weather[];
  groupOrders: GroupOrder[];
  teamOrder: string[];
  teams: Record<string, TeamState>;
  log: GameEvent[];
  results: FinalTeamResult[] | null;
  /** 정산 횟수 (화면·테스트에서 정산 1회를 확인) */
  settleCount: number;
}

export type TeamCommand =
  | { type: 'buy'; items: { ingredientId: string; units: number }[] }
  /** choice = 선택지 ID. M07 은 'cold+high' 같은 조합, M08 은 'syrup>milk>coffee' 같은 순서 */
  | { type: 'make'; menuId: string; choice: string }
  | { type: 'equip'; equipmentId: string }
  | { type: 'serve'; orderId: string; result: string }
  | { type: 'serveGroup'; groupOrderId: string; result: string }
  | { type: 'ready'; on: boolean }
  | { type: 'hint'; menuId: string }
  | { type: 'pin'; target: string; label: string; playerId?: string; at?: number };

export interface CommandResult { ok: boolean; error?: string; stars?: number; paid?: number; result?: string }
