import type { EconomyConfig } from '../types';
import { INGREDIENTS } from '../content/ingredients';
import { EQUIPMENT } from '../content/equipment';
import { MENUS } from '../content/menus';

/**
 * 3.6 초깃값. 모두 조정 가능하다. 시뮬레이션으로 바꾼 값과 이유는 docs/DECISIONS.md 에 적는다.
 * 과학 내용·재료 구성·조건과 결과·행동 수 3·만들기 1번의 인분 2 는 여기서 바꾸지 않는다.
 */
function buildDefault(): EconomyConfig {
  const ingredientPrices: Record<string, number> = {};
  for (const i of Object.values(INGREDIENTS)) ingredientPrices[i.id] = i.price;
  const equipmentPrices: Record<string, number> = {};
  for (const e of Object.values(EQUIPMENT)) equipmentPrices[e.id] = e.price;
  const menuPrices: Record<string, number> = {};
  const electricity: Record<string, number> = {};
  for (const m of Object.values(MENUS)) {
    menuPrices[m.id] = m.price;
    for (const r of Object.values(m.results)) if (r.price !== undefined) menuPrices[`${m.id}:${r.key}`] = r.price;
    electricity[m.id] = m.electricity;
  }
  return {
    version: 'economy-1.0',
    startCoins: 20,
    actionsPerDay: 3,
    servingsPerMake: 2,
    buyMaxKinds: 4,
    buyMaxUnits: 6,
    customersPerDay: 3,
    customerWaitDays: 2,
    queueMax: 8,
    tipPerServing: 1,
    weatherBonusPerServing: 1,
    groupServings: 4,
    groupBonus: 6,
    takeoutBonus: 2,
    twoServingRate: 0.7,
    aidThreshold: 4,
    aidCoins: 4,
    ingredientPrices,
    equipmentPrices,
    menuPrices,
    electricity,
  };
}

export const DEFAULT_ECONOMY: EconomyConfig = applyTuning(buildDefault());

/**
 * 시뮬레이션으로 조정한 값 (docs/DECISIONS.md 참고).
 * 초깃값(4절 표)에서 바뀐 항목만 여기 적어, 무엇이 바뀌었는지 한눈에 보이게 한다.
 */
function applyTuning(c: EconomyConfig): EconomyConfig {
  // 1차 조정: 장비가 필요한 메뉴의 인분당 가격을 2코인씩 올렸다.
  // 하루 행동 3번이 병목이라 장비는 「만들기 1번의 이익」을 키울 때만 값어치가 있는데,
  // 초깃값에서는 장비 메뉴와 장비 없는 메뉴의 이익이 거의 같아 장비를 사는 쪽이 늘 졌다 (investor 승률 1% vs frugal 39%).
  // 2차 조정: 2코인으로는 investor 15% vs frugal 33%(비 2.2)라 1코인을 더 올렸다 (600경기 비교: 비 1.3).
  c.menuPrices['M01'] = 12;
  c.menuPrices['M04'] = 8;
  c.menuPrices['M05'] = 10;
  c.menuPrices['M07'] = 10;
  c.menuPrices['M11'] = 11;
  c.version = 'economy-1.2';
  return c;
}

export function cloneConfig(c: EconomyConfig): EconomyConfig {
  return JSON.parse(JSON.stringify(c)) as EconomyConfig;
}

/** 결과의 인분당 가격 */
export function menuPrice(config: EconomyConfig, menuId: string, result: string): number {
  return config.menuPrices[`${menuId}:${result}`] ?? config.menuPrices[menuId] ?? 0;
}
