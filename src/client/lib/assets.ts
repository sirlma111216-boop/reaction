import { IMAGE_BY_ID, VARIANT_WIDTHS } from '../../shared/content/assets';

/**
 * 그림 자산 로더. `public/assets/images/index.json`(npm run assets:build 가 만든다)으로 파일 유무를 안다.
 * 파일이 없으면 null 을 돌려주고, AssetImage 가 점선 상자와 이름을 보여 준다.
 */
export interface ImageIndexEntry { id: string; status: 'ok' | 'missing'; variants?: number[]; alpha?: boolean; width?: number; height?: number }
export interface AudioIndexEntry { id: string; status: 'ok' | 'missing' }

let images: Record<string, ImageIndexEntry> | null = null;
let audioIndex: Record<string, AudioIndexEntry> | null = null;
const failed = new Set<string>();

export async function loadAssetIndex(): Promise<void> {
  const [img, aud] = await Promise.allSettled([
    fetch('/assets/images/index.json').then((r) => (r.ok ? (r.json() as Promise<{ images: ImageIndexEntry[] }>) : Promise.reject(new Error('no index')))),
    fetch('/assets/audio/index.json').then((r) => (r.ok ? (r.json() as Promise<{ audio: AudioIndexEntry[] }>) : Promise.reject(new Error('no index')))),
  ]);
  images = img.status === 'fulfilled' ? Object.fromEntries(img.value.images.map((i) => [i.id, i])) : {};
  audioIndex = aud.status === 'fulfilled' ? Object.fromEntries(aud.value.audio.map((a) => [a.id, a])) : {};
}

export function imageStatus(id: string): 'ok' | 'missing' | 'unknown' {
  if (failed.has(id)) return 'missing';
  if (!images) return 'unknown';
  return images[id]?.status === 'ok' ? 'ok' : 'missing';
}

/** 표시 폭에 맞는 변형 파일 URL. 없으면 null */
export function imageSrc(id: string, displayWidth: number): string | null {
  if (failed.has(id)) return null;
  const entry = images?.[id];
  if (!entry || entry.status !== 'ok') return null;
  const group = IMAGE_BY_ID[id]?.group ?? 'menu';
  const widths = (entry.variants && entry.variants.length ? entry.variants : VARIANT_WIDTHS[group]).slice().sort((a, b) => a - b);
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
  const want = displayWidth * dpr;
  const pick = widths.find((w) => w >= want) ?? widths[widths.length - 1]!;
  return `/assets/images/${id}-${pick}.webp`;
}

export function imageSrcSet(id: string): string | null {
  const entry = images?.[id];
  if (!entry || entry.status !== 'ok' || failed.has(id)) return null;
  const group = IMAGE_BY_ID[id]?.group ?? 'menu';
  const widths = entry.variants && entry.variants.length ? entry.variants : VARIANT_WIDTHS[group];
  return widths.map((w) => `/assets/images/${id}-${w}.webp ${w}w`).join(', ');
}

export function markFailed(id: string): void {
  failed.add(id);
}

export function audioAvailable(id: string): boolean {
  return audioIndex?.[id]?.status === 'ok';
}

export function audioStatus(id: string): 'ok' | 'missing' | 'unknown' {
  if (!audioIndex) return 'unknown';
  return audioIndex[id]?.status === 'ok' ? 'ok' : 'missing';
}
