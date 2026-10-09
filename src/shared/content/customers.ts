/** 5.4 손님 캐릭터 ID. 연출일 뿐 규칙에는 영향이 없다. */
export const CUSTOMER_CHARACTERS: { id: string; name: string }[] = [
  { id: 'cust-01', name: '중학생' },
  { id: 'cust-02', name: '대학생' },
  { id: 'cust-03', name: '회사원' },
  { id: 'cust-04', name: '할머니' },
  { id: 'cust-05', name: '할아버지' },
  { id: 'cust-06', name: '아이와 보호자' },
  { id: 'cust-07', name: '운동하고 온 손님' },
  { id: 'cust-08', name: '여행자' },
];
export const TAKEOUT_CUSTOMER = { id: 'cust-takeout', name: '포장 손님' } as const;
export const GROUP_CUSTOMER = { id: 'cust-group', name: '단체 주문 담당자' } as const;

export function customerName(id: string): string {
  if (id === TAKEOUT_CUSTOMER.id) return TAKEOUT_CUSTOMER.name;
  if (id === GROUP_CUSTOMER.id) return GROUP_CUSTOMER.name;
  return CUSTOMER_CHARACTERS.find((c) => c.id === id)?.name ?? '손님';
}
