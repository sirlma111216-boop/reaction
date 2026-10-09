import type { PresetId } from '../types';

export interface ExtraCard { id: string; title: string; presets: PresetId[]; standards: string[]; image: string; text: string }

/** 4.6 원리 노트의 추가 카드 (장비 카드 세 장). 원리 노트에만 나온다. */
export const EXTRA_CARDS: ExtraCard[] = [
  {
    id: 'packaging', title: '보온 포장 세트', presets: ['grade1', 'grade2', 'grade3', 'chem'], standards: ['9과03-02'], image: 'eq-packaging',
    text: '이중벽 사이의 공기층은 전도를, 뚜껑은 대류를, 반짝이는 안쪽 면은 복사를 줄여요. 그래서 따뜻한 음료는 따뜻하게, 차가운 음료는 차갑게 오래 유지돼요.',
  },
  {
    id: 'electric', title: '전기 장비', presets: ['grade2', 'grade3', 'chem'], standards: ['9과14-03'], image: 'eq-oven',
    text: '전기 기구는 전기 에너지를 다른 에너지로 바꿔요. 미니 오븐과 전기 그리들은 열에너지로, 스탠드 믹서는 운동 에너지로 바꿔요. 소비 전력이 큰 기구일수록 같은 시간 동안 전기 에너지를 많이 써서 전기 요금이 더 들어요.',
  },
  {
    id: 'gas-stove', title: '가스레인지', presets: ['grade3', 'chem'], standards: ['9과16-02', '9과16-05'], image: 'principle-gas-stove',
    text: '메테인이 산소와 반응해 이산화 탄소와 물이 되는 화학 변화예요(연소). CH₄ + 2O₂ → CO₂ + 2H₂O. 계수의 비 1 : 2 : 1 : 2는 반응하거나 생기는 분자 수의 비예요. 물이 수증기일 때, 같은 온도와 압력에서 기체의 부피 비도 이와 같아요.',
  },
];
