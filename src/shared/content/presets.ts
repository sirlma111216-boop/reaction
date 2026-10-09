import type { PresetId } from '../types';

export interface Preset {
  id: PresetId;
  name: string;
  menus: string[];
  equipment: string[];
  /** 다루는 단원 (메뉴판 선택 화면에 보여 준다) */
  units: string[];
}

/** 4.4 메뉴판 4종. 기본값은 1학년 메뉴판. */
export const PRESETS: Record<PresetId, Preset> = {
  grade1: {
    id: 'grade1', name: '1학년 메뉴판',
    menus: ['M01', 'M02', 'M03', 'M04', 'M05', 'M06'],
    equipment: ['mixer', 'oven', 'puffer', 'packaging'],
    units: ['열', '물질의 상태 변화', '기체의 성질'],
  },
  grade2: {
    id: 'grade2', name: '2학년 메뉴판',
    menus: ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09'],
    equipment: ['mixer', 'oven', 'puffer', 'packaging', 'carbonator'],
    units: ['열', '물질의 상태 변화', '기체의 성질', '물질의 특성', '전기와 자기(전기 에너지의 전환)'],
  },
  grade3: {
    id: 'grade3', name: '3학년 메뉴판',
    menus: ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09', 'M10', 'M11', 'M12', 'M13'],
    equipment: ['mixer', 'oven', 'puffer', 'packaging', 'carbonator', 'griddle'],
    units: ['열', '물질의 상태 변화', '기체의 성질', '물질의 특성', '전기와 자기(전기 에너지의 전환)', '화학 반응의 규칙성'],
  },
  chem: {
    id: 'chem', name: '화학 반응 집중 메뉴판',
    menus: ['M02', 'M03', 'M06', 'M10', 'M11', 'M12', 'M13'],
    equipment: ['griddle', 'packaging'],
    units: ['화학 반응의 규칙성 중심'],
  },
};

export const PRESET_IDS: PresetId[] = ['grade1', 'grade2', 'grade3', 'chem'];
export const DEFAULT_PRESET: PresetId = 'grade1';
export const DAY_OPTIONS = [6, 8, 10] as const;
export const DEFAULT_DAYS = 8;

/** 변화 종류 표시는 3학년 메뉴판과 화학 반응 집중 메뉴판에서만 */
export function showsChangeKind(presetId: PresetId): boolean {
  return presetId === 'grade3' || presetId === 'chem';
}
