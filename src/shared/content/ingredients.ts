import type { PresetId } from '../types';

export interface Ingredient { id: string; name: string; price: number; firstPreset: PresetId; image: string }

/** 4.1 재료 16종. 물과 얼음은 무료라 재료로 다루지 않는다. */
export const INGREDIENTS: Record<string, Ingredient> = {
  'milk': { id: 'milk', name: '우유', price: 1, firstPreset: 'grade1', image: 'ing-milk' },
  'cream': { id: 'cream', name: '생크림', price: 2, firstPreset: 'grade1', image: 'ing-cream' },
  'sugar': { id: 'sugar', name: '설탕', price: 1, firstPreset: 'grade1', image: 'ing-sugar' },
  'chocolate': { id: 'chocolate', name: '초콜릿', price: 2, firstPreset: 'grade1', image: 'ing-chocolate' },
  'tea': { id: 'tea', name: '찻잎', price: 1, firstPreset: 'grade1', image: 'ing-tea' },
  'syrup': { id: 'syrup', name: '과일청', price: 2, firstPreset: 'grade1', image: 'ing-syrup' },
  'rice': { id: 'rice', name: '쌀', price: 1, firstPreset: 'grade1', image: 'ing-rice' },
  'marshmallow': { id: 'marshmallow', name: '마시멜로', price: 1, firstPreset: 'grade1', image: 'ing-marshmallow' },
  'liquid-nitrogen': { id: 'liquid-nitrogen', name: '액체 질소', price: 3, firstPreset: 'grade1', image: 'ing-liquid-nitrogen' },
  'dry-ice': { id: 'dry-ice', name: '드라이아이스', price: 2, firstPreset: 'grade1', image: 'ing-dry-ice' },
  'coffee': { id: 'coffee', name: '커피 원액', price: 2, firstPreset: 'grade2', image: 'ing-coffee' },
  'co2': { id: 'co2', name: '이산화 탄소 카트리지', price: 2, firstPreset: 'grade2', image: 'ing-co2' },
  'lemon': { id: 'lemon', name: '레몬', price: 1, firstPreset: 'grade3', image: 'ing-lemon' },
  'batter': { id: 'batter', name: '반죽 믹스', price: 2, firstPreset: 'grade3', image: 'ing-batter' },
  'baking-soda': { id: 'baking-soda', name: '탄산수소 나트륨', price: 1, firstPreset: 'grade3', image: 'ing-baking-soda' },
  'reaction-pack': { id: 'reaction-pack', name: '반응 팩', price: 2, firstPreset: 'grade3', image: 'ing-reaction-pack' },
};

export const INGREDIENT_IDS = Object.keys(INGREDIENTS);
