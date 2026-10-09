/**
 * 8절 그림 96개·소리 35개 자산 ID. 파일 이름과 연결되므로 바꾸지 않는다.
 * 그림 파일이 없어도 앱은 점선 상자와 이름으로 동작한다.
 */
export type ImageGroup = 'background' | 'menu' | 'ingredient' | 'equipment' | 'customer' | 'mascot' | 'weather' | 'ui' | 'principle';

export interface ImageAsset { id: string; name: string; group: ImageGroup; width: number; height: number; alpha: boolean; usedIn: string }

/** 묶음별 변환 폭. 표시 크기에 맞는 변형만 받는다. */
export const VARIANT_WIDTHS: Record<ImageGroup, number[]> = {
  background: [1600, 800],
  menu: [512, 256, 128],
  ingredient: [512, 256, 128],
  equipment: [512, 256, 128],
  customer: [512, 256, 128],
  mascot: [512, 256, 128],
  weather: [128, 64],
  ui: [128, 64],
  principle: [960, 480],
};

const bg = (id: string, name: string, usedIn: string): ImageAsset => ({ id, name, group: 'background', width: 1920, height: 1080, alpha: false, usedIn });
const obj = (id: string, name: string, group: ImageGroup, usedIn: string): ImageAsset => ({ id, name, group, width: 1024, height: 1024, alpha: true, usedIn });
const icon = (id: string, name: string, group: ImageGroup, usedIn: string, alpha = true): ImageAsset => ({ id, name, group, width: 512, height: 512, alpha, usedIn });
const scene = (id: string, name: string): ImageAsset => ({ id, name, group: 'principle', width: 1280, height: 960, alpha: false, usedIn: '원리 노트 카드' });

export const IMAGE_ASSETS: ImageAsset[] = [
  bg('bg-title', '타이틀 배경', '타이틀'),
  bg('bg-lobby', '대기실 배경', '대기실'),
  bg('bg-market', '시장 배경', '시장'),
  bg('bg-kitchen', '주방 배경', '주방'),
  bg('bg-counter', '카운터 배경', '카운터'),
  bg('bg-closing', '하루 마감 배경', '하루 마감 영수증'),
  bg('bg-results', '결과 배경', '결과'),

  obj('menu-m01', '질소 아이스크림', 'menu', '메뉴 카드, 만들기 결과, 보관함, 손님 주문'),
  obj('menu-m02', '드라이아이스 스모크 에이드', 'menu', '메뉴 카드, 만들기 결과, 보관함, 손님 주문'),
  obj('menu-m03-hot', '따뜻한 허브티', 'menu', '메뉴 카드, 만들기 결과, 보관함, 손님 주문'),
  obj('menu-m03-coldbrew', '콜드브루 티', 'menu', '만들기 결과, 보관함, 손님 주문'),
  obj('menu-m04', '뻥튀기', 'menu', '메뉴 카드, 만들기 결과, 보관함, 손님 주문'),
  obj('menu-m05-fluffy', '폭신한 마시멜로 핫초코', 'menu', '메뉴 카드, 만들기 결과, 보관함, 손님 주문'),
  obj('menu-m05-plain', '쫀득한 마시멜로 핫초코', 'menu', '만들기 결과, 보관함, 손님 주문'),
  obj('menu-m06', '초콜릿 퐁듀', 'menu', '메뉴 카드, 만들기 결과, 보관함, 손님 주문'),
  obj('menu-m07', '탄산 에이드', 'menu', '메뉴 카드, 만들기 결과, 보관함, 손님 주문'),
  obj('menu-m08', '층층 라테', 'menu', '메뉴 카드, 만들기 결과, 보관함, 손님 주문'),
  obj('menu-m09', '록캔디', 'menu', '메뉴 카드, 만들기 결과, 보관함, 손님 주문'),
  obj('menu-m10-puffed', '달고나', 'menu', '메뉴 카드, 만들기 결과, 보관함, 손님 주문'),
  obj('menu-m10-candy', '설탕 사탕', 'menu', '만들기 결과, 보관함, 손님 주문'),
  obj('menu-m11-fluffy', '팬케이크', 'menu', '메뉴 카드, 만들기 결과, 보관함, 손님 주문'),
  obj('menu-m11-crepe', '크레페', 'menu', '만들기 결과, 보관함, 손님 주문'),
  obj('menu-m12', '톡톡 레몬 소다', 'menu', '메뉴 카드, 만들기 결과, 보관함, 손님 주문'),
  obj('menu-m13-hot', '스스로 데워지는 핫 코코아', 'menu', '메뉴 카드, 만들기 결과, 보관함, 손님 주문'),
  obj('menu-m13-cold', '스스로 차가워지는 아이스 코코아', 'menu', '만들기 결과, 보관함, 손님 주문'),
  obj('menu-fail', '실패한 음식', 'menu', '만들기 결과(실패), 보관함'),

  obj('ing-milk', '우유', 'ingredient', '시장, 레시피'),
  obj('ing-cream', '생크림', 'ingredient', '시장, 레시피'),
  obj('ing-sugar', '설탕', 'ingredient', '시장, 레시피'),
  obj('ing-chocolate', '초콜릿', 'ingredient', '시장, 레시피'),
  obj('ing-tea', '찻잎', 'ingredient', '시장, 레시피'),
  obj('ing-syrup', '과일청', 'ingredient', '시장, 레시피'),
  obj('ing-rice', '쌀', 'ingredient', '시장, 레시피'),
  obj('ing-marshmallow', '마시멜로', 'ingredient', '시장, 레시피'),
  obj('ing-liquid-nitrogen', '액체 질소', 'ingredient', '시장, 레시피'),
  obj('ing-dry-ice', '드라이아이스', 'ingredient', '시장, 레시피'),
  obj('ing-coffee', '커피 원액', 'ingredient', '시장, 레시피'),
  obj('ing-co2', '이산화 탄소 카트리지', 'ingredient', '시장, 레시피'),
  obj('ing-lemon', '레몬', 'ingredient', '시장, 레시피'),
  obj('ing-batter', '반죽 믹스', 'ingredient', '시장, 레시피'),
  obj('ing-baking-soda', '탄산수소 나트륨', 'ingredient', '시장, 레시피'),
  obj('ing-reaction-pack', '반응 팩', 'ingredient', '시장, 레시피'),

  obj('eq-mixer', '스탠드 믹서', 'equipment', '시장의 장비 진열대, 주방, 원리 노트'),
  obj('eq-oven', '미니 오븐', 'equipment', '시장의 장비 진열대, 주방, 원리 노트'),
  obj('eq-puffer', '뻥튀기 기계', 'equipment', '시장의 장비 진열대, 주방, 원리 노트'),
  obj('eq-packaging', '보온 포장 세트', 'equipment', '시장의 장비 진열대, 주방, 원리 노트'),
  obj('eq-carbonator', '탄산 주입기', 'equipment', '시장의 장비 진열대, 주방, 원리 노트'),
  obj('eq-griddle', '전기 그리들', 'equipment', '시장의 장비 진열대, 주방, 원리 노트'),
  obj('eq-gas-stove', '가스레인지', 'equipment', '주방, 원리 노트'),

  obj('cust-01', '중학생', 'customer', '카운터의 손님 줄'),
  obj('cust-02', '대학생', 'customer', '카운터의 손님 줄'),
  obj('cust-03', '회사원', 'customer', '카운터의 손님 줄'),
  obj('cust-04', '할머니', 'customer', '카운터의 손님 줄'),
  obj('cust-05', '할아버지', 'customer', '카운터의 손님 줄'),
  obj('cust-06', '아이와 보호자', 'customer', '카운터의 손님 줄'),
  obj('cust-07', '운동하고 온 손님', 'customer', '카운터의 손님 줄'),
  obj('cust-08', '여행자', 'customer', '카운터의 손님 줄'),
  obj('cust-takeout', '포장 손님', 'customer', '카운터의 손님 줄'),
  obj('cust-group', '단체 주문 담당자', 'customer', '단체 주문 게시판'),

  obj('mascot-cat', '고양이', 'mascot', '팀 간판 (대기실, 상단 바, 결과, 교사 보드)'),
  obj('mascot-dog', '강아지', 'mascot', '팀 간판 (대기실, 상단 바, 결과, 교사 보드)'),
  obj('mascot-rabbit', '토끼', 'mascot', '팀 간판 (대기실, 상단 바, 결과, 교사 보드)'),
  obj('mascot-bear', '곰', 'mascot', '팀 간판 (대기실, 상단 바, 결과, 교사 보드)'),
  obj('mascot-fox', '여우', 'mascot', '팀 간판 (대기실, 상단 바, 결과, 교사 보드)'),
  obj('mascot-penguin', '펭귄', 'mascot', '팀 간판 (대기실, 상단 바, 결과, 교사 보드)'),
  obj('mascot-otter', '수달', 'mascot', '팀 간판 (대기실, 상단 바, 결과, 교사 보드)'),
  obj('mascot-owl', '부엉이', 'mascot', '팀 간판 (대기실, 상단 바, 결과, 교사 보드)'),
  obj('npc-guide', '안내 로봇', 'mascot', '도움말과 안내 한 줄 옆'),

  icon('weather-sunny', '맑음', 'weather', '상단 바의 오늘 날씨와 내일 예보'),
  icon('weather-hot', '더움', 'weather', '상단 바의 오늘 날씨와 내일 예보'),
  icon('weather-cold', '추움', 'weather', '상단 바의 오늘 날씨와 내일 예보'),

  icon('ui-logo', '로고 심벌', 'ui', '타이틀, 파비콘'),
  icon('ui-coin', '코인', 'ui', '코인 수치 옆'),
  icon('ui-action', '행동', 'ui', '남은 행동 옆'),
  icon('ui-star', '별점', 'ui', '별점 옆'),
  icon('ui-electric', '전기 요금', 'ui', '전기 요금 옆'),
  icon('ui-tab-market', '시장 탭', 'ui', '장소 전환 탭'),
  icon('ui-tab-kitchen', '주방 탭', 'ui', '장소 전환 탭'),
  icon('ui-tab-counter', '카운터 탭', 'ui', '장소 전환 탭'),
  icon('ui-tab-note', '원리 노트 탭', 'ui', '장소 전환 탭'),
  icon('ui-stamp-closed', '마감 도장', 'ui', '마감한 팀 표시, 영수증'),
  icon('ui-paper', '종이 무늬', 'ui', '바탕 (반복 타일)', false),

  scene('principle-m01', '기화와 열에너지 흡수'),
  scene('principle-m02', '승화'),
  scene('principle-m03', '확산과 온도'),
  scene('principle-m04', '압력과 기체의 부피'),
  scene('principle-m05', '온도와 기체의 부피'),
  scene('principle-m06', '열평형과 전도'),
  scene('principle-m07', '기체의 용해도'),
  scene('principle-m08', '밀도'),
  scene('principle-m09', '용해도와 결정'),
  scene('principle-m10', '물리 변화와 화학 변화'),
  scene('principle-m11', '기체 발생과 질량 보존'),
  scene('principle-m12', '기체 발생'),
  scene('principle-m13', '발열 반응과 흡열 반응'),
  scene('principle-gas-stove', '연소'),
];

export const IMAGE_IDS = new Set(IMAGE_ASSETS.map((a) => a.id));
export const IMAGE_BY_ID: Record<string, ImageAsset> = Object.fromEntries(IMAGE_ASSETS.map((a) => [a.id, a]));

export interface AudioAsset { id: string; name: string; kind: 'bgm' | 'sting' | 'sfx'; usedIn: string }

export const AUDIO_ASSETS: AudioAsset[] = [
  { id: 'bgm-title', name: '타이틀 음악', kind: 'bgm', usedIn: '타이틀, 대기실' },
  { id: 'bgm-open', name: '영업 음악', kind: 'bgm', usedIn: '영업 화면' },
  { id: 'bgm-lastday', name: '마지막 날 음악', kind: 'bgm', usedIn: '마지막 날 영업 화면' },
  { id: 'bgm-closing', name: '마감 음악', kind: 'bgm', usedIn: '하루 마감 영수증' },
  { id: 'bgm-results', name: '결과 음악', kind: 'bgm', usedIn: '결과' },
  { id: 'sting-day-open', name: '새 날 시작', kind: 'sting', usedIn: '새 날 시작' },
  { id: 'sting-day-close', name: '정산 시작', kind: 'sting', usedIn: '모든 팀이 마감해 정산이 시작될 때' },
  { id: 'sting-group-order', name: '단체 주문 공개', kind: 'sting', usedIn: '단체 주문 공개' },
  { id: 'sting-final', name: '최종 순위 발표', kind: 'sting', usedIn: '최종 순위 발표' },
  { id: 'sfx-tap', name: '버튼', kind: 'sfx', usedIn: '버튼' },
  { id: 'sfx-tab', name: '장소 전환', kind: 'sfx', usedIn: '장소 전환' },
  { id: 'sfx-invalid', name: '거절된 행동', kind: 'sfx', usedIn: '거절된 행동' },
  { id: 'sfx-turn', name: '점장 알림', kind: 'sfx', usedIn: '내가 오늘의 점장이 됨' },
  { id: 'sfx-buy', name: '장보기', kind: 'sfx', usedIn: '장보기' },
  { id: 'sfx-equip', name: '장비 설치', kind: 'sfx', usedIn: '장비 설치' },
  { id: 'sfx-cook-start', name: '만들기 확정', kind: 'sfx', usedIn: '만들기 확정' },
  { id: 'sfx-freeze', name: '질소 아이스크림', kind: 'sfx', usedIn: 'M01 결과' },
  { id: 'sfx-fog', name: '하얀 김', kind: 'sfx', usedIn: 'M02, M13 결과' },
  { id: 'sfx-pour', name: '붓기', kind: 'sfx', usedIn: 'M03, M06, M08 결과' },
  { id: 'sfx-puff', name: '뻥튀기', kind: 'sfx', usedIn: 'M04 결과' },
  { id: 'sfx-oven-ding', name: '오븐 알림', kind: 'sfx', usedIn: 'M05 결과' },
  { id: 'sfx-fizz', name: '탄산', kind: 'sfx', usedIn: 'M07, M12 결과' },
  { id: 'sfx-sparkle', name: '결정', kind: 'sfx', usedIn: 'M09 결과' },
  { id: 'sfx-crack', name: '달고나', kind: 'sfx', usedIn: 'M10 결과' },
  { id: 'sfx-sizzle', name: '팬케이크', kind: 'sfx', usedIn: 'M11 결과' },
  { id: 'sfx-stars-3', name: '별 3개', kind: 'sfx', usedIn: '별점 연출' },
  { id: 'sfx-stars-2', name: '별 2개', kind: 'sfx', usedIn: '별점 연출' },
  { id: 'sfx-stars-1', name: '별 1개', kind: 'sfx', usedIn: '별점 연출' },
  { id: 'sfx-customer-in', name: '새 손님', kind: 'sfx', usedIn: '새 손님' },
  { id: 'sfx-customer-out', name: '손님이 떠남', kind: 'sfx', usedIn: '손님이 떠남' },
  { id: 'sfx-serve', name: '음식 내기', kind: 'sfx', usedIn: '음식 내기' },
  { id: 'sfx-coin', name: '대금 받음', kind: 'sfx', usedIn: '대금 받음' },
  { id: 'sfx-tip', name: '팁 받음', kind: 'sfx', usedIn: '팁 받음' },
  { id: 'sfx-ready', name: '오늘 영업 마감', kind: 'sfx', usedIn: '오늘 영업 마감' },
  { id: 'sfx-waste', name: '폐기', kind: 'sfx', usedIn: '폐기' },
];

export const AUDIO_IDS = new Set(AUDIO_ASSETS.map((a) => a.id));

/** 음식 그림: menu-<메뉴>-<결과> 가 있으면 그것, 없으면 menu-<메뉴>. (실패) 결과는 menu-fail */
export function foodImage(menuId: string, result: string, fail: boolean): string {
  if (fail) return 'menu-fail';
  const slug = menuId.toLowerCase();
  const specific = `menu-${slug}-${result}`;
  if (IMAGE_IDS.has(specific)) return specific;
  return `menu-${slug}`;
}

export const MASCOTS: { id: string; name: string }[] = [
  { id: 'mascot-cat', name: '고양이' },
  { id: 'mascot-dog', name: '강아지' },
  { id: 'mascot-rabbit', name: '토끼' },
  { id: 'mascot-bear', name: '곰' },
  { id: 'mascot-fox', name: '여우' },
  { id: 'mascot-penguin', name: '펭귄' },
  { id: 'mascot-otter', name: '수달' },
  { id: 'mascot-owl', name: '부엉이' },
];
export const MASCOT_IDS = MASCOTS.map((m) => m.id);

export const WEATHER_IMAGE: Record<string, string> = { sunny: 'weather-sunny', hot: 'weather-hot', cold: 'weather-cold' };
export const WEATHER_NAME: Record<string, string> = { sunny: '맑음', hot: '더움', cold: '추움' };
