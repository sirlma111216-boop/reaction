import type { Temperature } from '../types';

/**
 * 4.3·4.5 메뉴 13종. 문장은 구현 프롬프트에 적힌 그대로다. 과학 설명을 고치거나 새로 짓지 않는다.
 * ID 는 그림 파일 이름과 연결되므로 바꾸지 않는다.
 */

export interface Choice {
  /** 고정 ID. M07 은 'cold+high' 같은 조합, M08 은 'syrup>milk>coffee' 같은 순서 */
  id: string;
  label: string;
  result: string;
  /** 이 선택지가 실제로 쓰는 재료 (없으면 메뉴 재료 전부). 쓰지 않는 재료는 차감하지 않는다 */
  uses?: Record<string, number>;
  /** 이 선택지의 전기 요금 (없으면 메뉴 전기 요금). 전기 장비를 쓰지 않으면 0 */
  electricity?: number;
}

export interface MenuResult {
  key: string;
  name: string;
  fail: boolean;
  why: string;
  /** 손님이 원할 때의 말풍선. (실패) 결과에는 없다 */
  customerLine?: string;
  /** 결과별 온도·가격·완성 시점 (없으면 메뉴 값) */
  temperature?: Temperature;
  price?: number;
  ready?: 'now' | 'overnight';
  /** 변화 종류 표시 문장 (해당 결과에서만) */
  changeKindText?: string;
  /** 반응식 (해당 결과에서만) */
  equation?: string;
  /** 게임용 질량 표시 (M11 fluffy) */
  massNote?: string;
}

export type MenuUi =
  | { kind: 'single' }
  | { kind: 'two'; questions: { id: string; label: string; options: { id: string; label: string }[] }[] }
  | { kind: 'order'; liquids: { ingredientId: string; name: string; density: string }[] };

export interface Menu {
  id: string;
  name: string;
  ingredients: Record<string, number>;
  equipment: string | null;
  electricity: number;
  /** 인분당 가격 (결과별 가격이 있으면 results 에) */
  price: number;
  temperature: Temperature;
  ready: 'now' | 'overnight';
  unit: string;
  standards: string[];
  principle: string;
  question: string;
  ui: MenuUi;
  choices: Choice[];
  results: Record<string, MenuResult>;
  /** 메뉴 전체의 변화 종류 (모든 결과가 같을 때) */
  changeKindText?: string;
  safety?: string;
  /** 카드 아래 작은 글씨 */
  note?: string;
  /** 대표 그림 */
  image: string;
  /** 결과 연출 효과음 */
  sfx: string;
}

const EQ_BAKING_SODA = '2NaHCO₃ → Na₂CO₃ + H₂O + CO₂';

export const MENUS: Record<string, Menu> = {
  M01: {
    id: 'M01', name: '질소 아이스크림',
    ingredients: { cream: 1, milk: 1, sugar: 1, 'liquid-nitrogen': 1 }, equipment: 'mixer', electricity: 1, price: 9, temperature: 'cold', ready: 'now',
    unit: '물질의 상태 변화', standards: ['9과04-04'],
    principle: '액체 질소(끓는점 약 −196 ℃)는 크림에서 열에너지를 흡수해 기체로 변해요(기화). 열에너지를 잃은 크림은 얼어요(응고).',
    question: '액체 질소를 얼마나 부을까요?',
    ui: { kind: 'single' },
    changeKindText: '물리 변화',
    safety: '액체 질소는 환기가 잘 되는 곳에서 보호 장갑을 끼고 다뤄요. 하얀 김이 다 사라진 뒤에 내요. 통의 뚜껑을 꽉 닫아 두면 안 돼요.',
    choices: [
      { id: 'much', label: '넉넉히 붓는다', result: 'hard' },
      { id: 'little', label: '조금만 붓는다', result: 'soft' },
    ],
    results: {
      hard: { key: 'hard', name: '단단한 아이스크림', fail: false, why: '기화하는 질소가 많을수록 크림에서 흡수하는 열에너지가 많아 단단하게 얼어요.', customerLine: '숟가락이 설 만큼 단단하게 얼려 주세요.' },
      soft: { key: 'soft', name: '부드러운 소프트 아이스크림', fail: false, why: '기화하는 질소가 적으면 흡수하는 열에너지도 적어 덜 얼어요.', customerLine: '살살 녹는 부드러운 걸로 주세요.' },
    },
    image: 'menu-m01', sfx: 'sfx-freeze',
  },
  M02: {
    id: 'M02', name: '드라이아이스 스모크 에이드',
    ingredients: { syrup: 1, 'dry-ice': 1 }, equipment: null, electricity: 0, price: 6, temperature: 'cold', ready: 'now',
    unit: '물질의 상태 변화', standards: ['9과04-03'],
    principle: '드라이아이스는 고체 이산화 탄소예요. 액체를 거치지 않고 바로 기체가 돼요(승화). 흰 연기처럼 보이는 것은 이산화 탄소가 아니라, 차가워진 공기 속 수증기가 액화해 생긴 작은 물방울이에요.',
    question: '바깥 컵의 드라이아이스 칸에 어떤 물을 부을까요?',
    ui: { kind: 'single' },
    changeKindText: '물리 변화',
    safety: '드라이아이스는 음료에 직접 넣지 않고 분리된 바깥 컵에 넣어요. 맨손으로 만지지 않아요.',
    choices: [
      { id: 'warm', label: '따뜻한 물', result: 'big' },
      { id: 'cold', label: '찬물', result: 'slow' },
    ],
    results: {
      big: { key: 'big', name: '하얀 김이 풍성한 에이드', fail: false, why: '따뜻한 물에서 열에너지를 빨리 얻어 승화가 빨라져요. 하얀 김은 많지만 금방 끝나요.', customerLine: '사진 찍게 하얀 김이 뭉게뭉게 나오면 좋겠어요!' },
      slow: { key: 'slow', name: '하얀 김이 잔잔하게 오래가는 에이드', fail: false, why: '찬물에서는 열에너지를 천천히 얻어 승화가 느려요.', customerLine: '천천히 마실 거라 하얀 김이 오래갔으면 해요.' },
    },
    image: 'menu-m02', sfx: 'sfx-fog',
  },
  M03: {
    id: 'M03', name: '허브티',
    ingredients: { tea: 1 }, equipment: null, electricity: 0, price: 3, temperature: 'warm', ready: 'now',
    unit: '물질의 상태 변화', standards: ['9과04-01'],
    principle: '물질을 이루는 입자는 스스로 움직여 퍼져 나가요(확산). 온도가 높을수록 입자가 활발하게 움직여 더 빨리 퍼져요.',
    question: '어떤 물에 우릴까요?',
    ui: { kind: 'single' },
    changeKindText: '물리 변화',
    choices: [
      { id: 'hot', label: '뜨거운 물', result: 'hot' },
      { id: 'cold', label: '찬물', result: 'coldbrew' },
    ],
    results: {
      hot: { key: 'hot', name: '따뜻한 허브티 (바로 완성)', fail: false, why: '뜨거운 물에서는 입자 운동이 활발해 차 성분이 빨리 퍼져요.', customerLine: '지금 바로 마실 따뜻한 차 주세요.', temperature: 'warm', price: 3, ready: 'now' },
      coldbrew: { key: 'coldbrew', name: '콜드브루 티 (내일 아침 완성)', fail: false, why: '찬물에서는 입자 운동이 느려 차 성분이 천천히 퍼져요. 하룻밤이 걸려요.', customerLine: '차갑게 천천히 우린 콜드브루 있나요?', temperature: 'cold', price: 5, ready: 'overnight' },
    },
    image: 'menu-m03-hot', sfx: 'sfx-pour',
  },
  M04: {
    id: 'M04', name: '뻥튀기',
    ingredients: { rice: 1 }, equipment: 'puffer', electricity: 0, price: 5, temperature: 'none', ready: 'now',
    unit: '기체의 성질', standards: ['9과06-02'],
    principle: '기체는 압력이 낮아지면 부피가 커져요. 뻥튀기 기계 안에서 높은 압력에 눌려 있던 쌀알 속 기체가, 뚜껑을 여는 순간 압력이 낮아지면서 크게 부풀어요.',
    question: '뚜껑을 언제 열까요?',
    ui: { kind: 'single' },
    safety: '뚜껑을 열 때 큰 소리가 나요. 주변에 알리고 열어요.',
    choices: [
      { id: 'high', label: '압력계가 높이 올라갔을 때 연다', result: 'big' },
      { id: 'low', label: '압력이 조금만 올랐을 때 연다', result: 'small' },
    ],
    results: {
      big: { key: 'big', name: '크고 바삭한 뻥튀기', fail: false, why: '기계 안의 압력이 높았던 만큼, 뚜껑을 열 때 압력이 크게 낮아져 쌀알 속 기체의 부피가 많이 커져요.', customerLine: '입에서 사르르 녹는 큰 뻥튀기 주세요.' },
      small: { key: 'small', name: '작고 오독오독한 튀밥', fail: false, why: '압력이 조금만 낮아져서 쌀알 속 기체의 부피도 조금만 커져요.', customerLine: '오독오독 씹히는 작은 튀밥이 좋아요.' },
    },
    image: 'menu-m04', sfx: 'sfx-puff',
  },
  M05: {
    id: 'M05', name: '마시멜로 핫초코',
    ingredients: { chocolate: 1, milk: 1, marshmallow: 1 }, equipment: 'oven', electricity: 1, price: 7, temperature: 'warm', ready: 'now',
    unit: '기체의 성질', standards: ['9과06-03'],
    principle: '기체는 온도가 높아지면 부피가 커져요. 마시멜로 속 작은 공기 방울이 데워지면 부피가 커져서 마시멜로가 부풀어요.',
    question: '마시멜로를 얼마나 데울까요?',
    ui: { kind: 'single' },
    choices: [
      { id: 'none', label: '데우지 않는다', result: 'plain', electricity: 0 },
      { id: 'light', label: '살짝 데운다', result: 'fluffy' },
      { id: 'long', label: '아주 오래 데운다', result: 'burnt' },
    ],
    results: {
      plain: { key: 'plain', name: '쫀득한 마시멜로 핫초코', fail: false, why: '오븐에 데우지 않아 마시멜로 속 기체의 부피가 거의 그대로예요.', customerLine: '마시멜로는 쫀득한 그대로 올려 주세요.' },
      fluffy: { key: 'fluffy', name: '폭신하게 부푼 마시멜로 핫초코', fail: false, why: '온도가 높아져 마시멜로 속 기체의 부피가 커졌어요.', customerLine: '마시멜로가 구름처럼 폭신했으면 좋겠어요.' },
      burnt: { key: 'burnt', name: '타 버린 마시멜로 핫초코', fail: true, why: '너무 오래 데우면 겉이 타고, 부풀었던 기체가 빠져나가 꺼져요.' },
    },
    image: 'menu-m05-fluffy', sfx: 'sfx-oven-ding',
  },
  M06: {
    id: 'M06', name: '초콜릿 퐁듀',
    ingredients: { chocolate: 2 }, equipment: null, electricity: 0, price: 5, temperature: 'warm', ready: 'now',
    unit: '열', standards: ['9과03-01', '9과03-02'],
    principle: '열은 온도가 높은 물체에서 낮은 물체로 이동하고, 두 물체의 온도가 같아지면 더 이동하지 않아요(열평형). 중탕하면 초콜릿은 뜨거운 물의 온도까지만 올라가서 타지 않아요.',
    question: '초콜릿을 어떻게 녹일까요?',
    ui: { kind: 'single' },
    choices: [
      { id: 'direct', label: '냄비에 넣고 불 위에서 바로 녹인다', result: 'burnt' },
      { id: 'bath', label: '뜨거운 물 위에 그릇을 올려 중탕한다', result: 'good' },
      { id: 'pour', label: '뜨거운 물을 초콜릿에 직접 붓는다', result: 'watery' },
    ],
    results: {
      burnt: { key: 'burnt', name: '타 버린 초콜릿', fail: true, why: '불꽃은 온도가 매우 높아서 초콜릿이 금방 타요.' },
      good: { key: 'good', name: '매끈한 초콜릿 퐁듀', fail: false, why: '그릇을 통해 열이 전달되고(전도), 초콜릿은 물의 온도까지만 올라가요.', customerLine: '과일 찍어 먹게 초콜릿 퐁듀 주세요.' },
      watery: { key: 'watery', name: '묽어진 초콜릿', fail: true, why: '녹기는 하지만 물이 섞여 묽어져요.' },
    },
    image: 'menu-m06', sfx: 'sfx-pour',
  },
  M07: {
    id: 'M07', name: '탄산 에이드',
    ingredients: { syrup: 1, co2: 1 }, equipment: 'carbonator', electricity: 0, price: 7, temperature: 'cold', ready: 'now',
    unit: '물질의 특성', standards: ['9과08-01'],
    principle: '기체는 물의 온도가 낮을수록, 압력이 높을수록 물에 많이 녹아요.',
    question: '물의 온도와 누르는 압력을 정하세요.',
    ui: {
      kind: 'two',
      questions: [
        { id: 'temp', label: '물의 온도는 어떻게 할까요?', options: [{ id: 'cold', label: '차갑게' }, { id: 'warm', label: '미지근하게' }] },
        { id: 'pressure', label: '누르는 압력은 어떻게 할까요?', options: [{ id: 'high', label: '높게' }, { id: 'low', label: '낮게' }] },
      ],
    },
    choices: [
      { id: 'cold+high', label: '차갑게 + 높게', result: 'strong' },
      { id: 'cold+low', label: '차갑게 + 낮게', result: 'medium' },
      { id: 'warm+high', label: '미지근하게 + 높게', result: 'medium' },
      { id: 'warm+low', label: '미지근하게 + 낮게', result: 'weak' },
    ],
    results: {
      strong: { key: 'strong', name: '톡 쏘는 탄산 에이드', fail: false, why: '온도가 낮고 압력이 높아 이산화 탄소가 물에 많이 녹았어요.', customerLine: '코가 찡할 만큼 톡 쏘게 해 주세요!' },
      medium: { key: 'medium', name: '탄산이 적당한 에이드', fail: false, why: '두 조건 가운데 하나만 맞아 이산화 탄소가 적당히 녹았어요.', customerLine: '탄산은 적당히 넣어 주세요.' },
      weak: { key: 'weak', name: '탄산이 순한 에이드', fail: false, why: '온도가 높고 압력이 낮아 이산화 탄소가 조금만 녹았어요.', customerLine: '동생이 마실 거라 탄산은 아주 약하게 부탁해요.' },
    },
    image: 'menu-m07', sfx: 'sfx-fizz',
  },
  M08: {
    id: 'M08', name: '층층 라테',
    ingredients: { syrup: 1, milk: 1, coffee: 1 }, equipment: null, electricity: 0, price: 7, temperature: 'cold', ready: 'now',
    unit: '물질의 특성', standards: ['9과08-01'],
    principle: '밀도가 큰 액체는 아래로, 밀도가 작은 액체는 위로 가요. 밀도가 큰 것부터 천천히 부으면 층이 생겨요.',
    question: '세 액체를 붓는 순서를 정하세요.',
    ui: {
      kind: 'order',
      liquids: [
        { ingredientId: 'syrup', name: '과일청', density: '1.30 g/mL' },
        { ingredientId: 'milk', name: '우유', density: '1.03 g/mL' },
        { ingredientId: 'coffee', name: '커피 원액', density: '1.00 g/mL' },
      ],
    },
    choices: [
      { id: 'syrup>milk>coffee', label: '과일청 → 우유 → 커피 원액', result: 'layered' },
      { id: 'syrup>coffee>milk', label: '과일청 → 커피 원액 → 우유', result: 'mixed' },
      { id: 'milk>syrup>coffee', label: '우유 → 과일청 → 커피 원액', result: 'mixed' },
      { id: 'milk>coffee>syrup', label: '우유 → 커피 원액 → 과일청', result: 'mixed' },
      { id: 'coffee>syrup>milk', label: '커피 원액 → 과일청 → 우유', result: 'mixed' },
      { id: 'coffee>milk>syrup', label: '커피 원액 → 우유 → 과일청', result: 'mixed' },
    ],
    results: {
      layered: { key: 'layered', name: '세 층이 또렷한 층층 라테', fail: false, why: '밀도가 큰 액체부터 부어서 밀도가 작은 액체가 위에 떠 있어요.', customerLine: '층이 또렷한 층층 라테 주세요.' },
      mixed: { key: 'mixed', name: '섞여 버린 라테', fail: true, why: '밀도가 작은 액체를 먼저 부으면, 나중에 부은 밀도 큰 액체가 가라앉으면서 섞여요.' },
    },
    image: 'menu-m08', sfx: 'sfx-pour',
  },
  M09: {
    id: 'M09', name: '록캔디',
    ingredients: { sugar: 2 }, equipment: null, electricity: 0, price: 6, temperature: 'none', ready: 'overnight',
    unit: '물질의 특성', standards: ['9과08-01', '9과08-03'],
    principle: '설탕은 물의 온도가 높을수록 많이 녹아요(용해도가 커져요). 뜨거운 물에 가득 녹인 뒤 식히면, 낮은 온도에서 더 녹아 있을 수 없는 설탕이 결정으로 나와요.',
    question: '설탕물을 어떻게 만들까요?',
    ui: { kind: 'single' },
    note: '실제로는 결정이 자라는 데 며칠이 걸려요.',
    choices: [
      { id: 'saturated', label: '뜨거운 물에 더 녹지 않을 때까지 녹인 뒤 천천히 식힌다', result: 'crystal' },
      { id: 'coldwater', label: '찬물에 녹을 만큼만 녹여 그대로 둔다', result: 'none' },
      { id: 'little', label: '뜨거운 물에 조금만 녹인 뒤 식힌다', result: 'none2' },
    ],
    results: {
      crystal: { key: 'crystal', name: '결정이 큼직한 록캔디', fail: false, why: '식으면서 용해도가 작아져, 더 녹아 있을 수 없는 설탕이 결정으로 나왔어요.', customerLine: '반짝이는 록캔디 주세요.' },
      none: { key: 'none', name: '결정이 거의 없는 막대', fail: true, why: '온도가 변하지 않아 용해도가 변하지 않았어요.' },
      none2: { key: 'none2', name: '결정이 거의 없는 막대', fail: true, why: '식은 뒤에도 다 녹아 있을 수 있는 양이라 결정이 나오지 않았어요.' },
    },
    image: 'menu-m09', sfx: 'sfx-sparkle',
  },
  M10: {
    id: 'M10', name: '달고나',
    ingredients: { sugar: 1, 'baking-soda': 1 }, equipment: null, electricity: 0, price: 4, temperature: 'none', ready: 'now',
    unit: '화학 반응의 규칙성', standards: ['9과16-01', '9과16-02'],
    principle: '설탕이 녹는 것은 물리 변화예요. 탄산수소 나트륨을 가열하면 분해되어 이산화 탄소 기체가 생기는데, 이것은 화학 변화예요. 이 기체가 달고나를 부풀려요.',
    question: '녹인 설탕에 탄산수소 나트륨을 넣을까요?',
    ui: { kind: 'single' },
    safety: '녹은 설탕은 매우 뜨거워요. 손에 닿지 않게 해요.',
    choices: [
      { id: 'add', label: '넣는다', result: 'puffed' },
      { id: 'skip', label: '넣지 않는다 (탄산수소 나트륨을 쓰지 않음)', result: 'candy', uses: { sugar: 1 } },
    ],
    results: {
      puffed: { key: 'puffed', name: '부풀어 바삭한 달고나', fail: false, why: '탄산수소 나트륨이 분해되면서 생긴 이산화 탄소가 달고나를 부풀렸어요.', customerLine: '부풀어서 바삭한 달고나 주세요.', changeKindText: '물리 변화(설탕이 녹음) + 화학 변화(탄산수소 나트륨의 분해)', equation: EQ_BAKING_SODA },
      candy: { key: 'candy', name: '투명하고 단단한 설탕 사탕', fail: false, why: '기체가 생기지 않아 부풀지 않았어요. 설탕이 녹았다가 다시 굳었어요.', customerLine: '투명하고 단단한 설탕 사탕이 좋아요.', changeKindText: '물리 변화' },
    },
    image: 'menu-m10-puffed', sfx: 'sfx-crack',
  },
  M11: {
    id: 'M11', name: '팬케이크',
    ingredients: { batter: 1, milk: 1, 'baking-soda': 1 }, equipment: 'griddle', electricity: 2, price: 8, temperature: 'warm', ready: 'now',
    unit: '화학 반응의 규칙성', standards: ['9과16-03'],
    principle: '반죽 속 탄산수소 나트륨이 열을 받아 분해되면 이산화 탄소가 생겨 반죽이 부풀어요. 구운 뒤 가벼워진 만큼은 빠져나간 기체의 질량이에요. 빠져나간 기체까지 합하면 반응 전과 후의 질량은 같아요(질량 보존 법칙).',
    question: '탄산수소 나트륨을 얼마나 넣을까요?',
    ui: { kind: 'single' },
    choices: [
      { id: 'none', label: '넣지 않는다 (탄산수소 나트륨을 쓰지 않음)', result: 'crepe', uses: { batter: 1, milk: 1 } },
      { id: 'recipe', label: '레시피대로 넣는다', result: 'fluffy' },
      { id: 'double', label: '두 배로 넣는다', result: 'bitter' },
    ],
    results: {
      crepe: { key: 'crepe', name: '얇은 크레페', fail: false, why: '기체가 생기지 않아 반죽이 부풀지 않았어요.', customerLine: '부풀지 않은 얇은 크레페로 주세요.' },
      fluffy: { key: 'fluffy', name: '폭신한 팬케이크', fail: false, why: '탄산수소 나트륨이 분해되면서 생긴 이산화 탄소가 반죽을 부풀렸어요.', customerLine: '폭신폭신한 팬케이크로 주세요!', changeKindText: '화학 변화', equation: EQ_BAKING_SODA, massNote: '굽기 전 반죽 200 g = 구운 팬케이크 188 g + 빠져나간 기체(수증기와 이산화 탄소) 12 g' },
      bitter: { key: 'bitter', name: '쓴맛이 나는 팬케이크', fail: true, why: '분해되고 남는 탄산 나트륨이 많아져 쓴맛이 나요.', changeKindText: '화학 변화', equation: EQ_BAKING_SODA },
    },
    image: 'menu-m11-fluffy', sfx: 'sfx-sizzle',
  },
  M12: {
    id: 'M12', name: '톡톡 레몬 소다',
    ingredients: { lemon: 1, sugar: 1, 'baking-soda': 1 }, equipment: null, electricity: 0, price: 5, temperature: 'cold', ready: 'now',
    unit: '화학 반응의 규칙성', standards: ['9과16-01'],
    principle: '레몬즙 속 시트르산과 탄산수소 나트륨이 만나면 이산화 탄소 기체가 생겨요. 이 이산화 탄소는 반응 전에는 없던 새로운 물질이에요. 새로운 물질이 생기는 변화가 화학 변화예요.',
    question: '탄산수소 나트륨을 언제 넣을까요?',
    ui: { kind: 'single' },
    changeKindText: '화학 변화',
    choices: [
      { id: 'serve', label: '손님에게 내기 바로 전에 넣는다', result: 'fizzy' },
      { id: 'morning', label: '아침에 미리 섞어 둔다', result: 'flat' },
    ],
    results: {
      fizzy: { key: 'fizzy', name: '거품이 톡톡 올라오는 레몬 소다', fail: false, why: '지금 막 반응이 일어나 이산화 탄소 기체가 생기고 있어요.', customerLine: '거품이 톡톡 터지는 레몬 소다 주세요.' },
      flat: { key: 'flat', name: '김이 빠진 레몬 물', fail: true, why: '반응이 이미 끝나서 이산화 탄소가 다 빠져나갔어요.' },
    },
    image: 'menu-m12', sfx: 'sfx-fizz',
  },
  M13: {
    id: 'M13', name: '온도 컵 코코아',
    ingredients: { chocolate: 1, milk: 1, 'reaction-pack': 1 }, equipment: null, electricity: 0, price: 7, temperature: 'none', ready: 'now',
    unit: '화학 반응의 규칙성', standards: ['9과16-06'],
    principle: '화학 반응이 일어날 때 열에너지를 내보내면 주변의 온도가 높아지고(발열 반응), 열에너지를 흡수하면 주변의 온도가 낮아져요(흡열 반응).',
    question: '컵 바닥 칸에서 어떤 반응을 일으킬까요?',
    ui: { kind: 'single' },
    changeKindText: '화학 변화',
    safety: '반응 물질은 음료와 섞이지 않는 바닥 칸에만 있어요. 산화 칼슘은 맨손으로 만지지 않아요.',
    choices: [
      { id: 'cao', label: '산화 칼슘 + 물', result: 'hot' },
      { id: 'citric', label: '탄산수소 나트륨 + 시트르산 + 물', result: 'cold' },
    ],
    results: {
      hot: { key: 'hot', name: '스스로 데워지는 핫 코코아', fail: false, why: '산화 칼슘과 물이 반응하면서 열에너지를 내보내 코코아가 데워졌어요.', customerLine: '소풍 가서 마실 거예요. 스스로 데워지는 컵으로 주세요.', temperature: 'warm', equation: 'CaO + H₂O → Ca(OH)₂' },
      cold: { key: 'cold', name: '스스로 차가워지는 아이스 코코아', fail: false, why: '반응하면서 주변의 열에너지를 흡수해 코코아가 차가워졌어요.', customerLine: '더운 날이라 스스로 차가워지는 컵이 좋아요.', temperature: 'cold' },
    },
    image: 'menu-m13-hot', sfx: 'sfx-fog',
  },
};

export const MENU_IDS = Object.keys(MENUS);

/** 결과의 온도 (결과별 값이 없으면 메뉴 값) */
export function resultTemperature(menuId: string, result: string): Temperature {
  const m = MENUS[menuId];
  if (!m) return 'none';
  return m.results[result]?.temperature ?? m.temperature;
}

/** 결과의 완성 시점 */
export function resultReady(menuId: string, result: string): 'now' | 'overnight' {
  const m = MENUS[menuId];
  if (!m) return 'now';
  return m.results[result]?.ready ?? m.ready;
}

/** 손님이 원할 수 있는 결과 ((실패) 아님) */
export function wantableResults(menuId: string): string[] {
  const m = MENUS[menuId];
  if (!m) return [];
  return Object.values(m.results).filter((r) => !r.fail).map((r) => r.key);
}

/** 선택지가 만드는 결과 */
export function choiceResult(menuId: string, choiceId: string): string | null {
  const c = MENUS[menuId]?.choices.find((x) => x.id === choiceId);
  return c ? c.result : null;
}

/** 어떤 결과를 만드는 선택지 (첫 번째) */
export function choiceFor(menuId: string, result: string): Choice | null {
  return MENUS[menuId]?.choices.find((c) => c.result === result) ?? null;
}

/** 선택지가 실제로 쓰는 재료 */
export function choiceUses(menuId: string, choiceId: string): Record<string, number> {
  const m = MENUS[menuId];
  if (!m) return {};
  const c = m.choices.find((x) => x.id === choiceId);
  return c?.uses ?? m.ingredients;
}

/** 선택지의 전기 요금 */
export function choiceElectricity(menuId: string, choiceId: string, menuElectricity: number): number {
  const c = MENUS[menuId]?.choices.find((x) => x.id === choiceId);
  return c?.electricity ?? menuElectricity;
}

/** 메뉴 ID 를 소문자 자산 접두사로: M01 → m01 */
export const menuSlug = (menuId: string) => menuId.toLowerCase();
