/**
 * 원본 그림(assets-source/images/<ID>.png)을 크기별 WebP 로 변환하고, 소리 폴더를 읽어 index.json 을 갱신한다.
 * - 배경은 폭 1600·800, 물체와 캐릭터는 512·256·128, 날씨와 화면 요소는 128·64, 원리 장면은 폭 960·480.
 * - 파일이 없는 ID 는 index 에 missing 으로 남고 앱은 점선 상자를 보여 준다.
 * 사용: node scripts/build-assets.mjs [--src <dir>]
 */
import sharp from 'sharp';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const argSrc = process.argv.indexOf('--src');
const srcDir = argSrc >= 0 ? resolve(process.argv[argSrc + 1]) : join(root, 'assets-source', 'images');
const outDir = join(root, 'public', 'assets', 'images');
const audioDir = join(root, 'public', 'assets', 'audio');
mkdirSync(outDir, { recursive: true });
mkdirSync(audioDir, { recursive: true });

// 자산 목록은 코드의 단일 출처(src/shared/content/assets.ts)에서 읽는다 (tsx 로더 사용)
const { IMAGE_ASSETS, AUDIO_ASSETS, VARIANT_WIDTHS } = await import(pathToFileURL(join(root, 'node_modules', 'tsx', 'dist', 'loader.mjs')).href).then(() => import(pathToFileURL(join(root, 'src', 'shared', 'content', 'assets.ts')).href)).catch(async () => {
  // tsx 가 로더로 등록되지 않은 환경: tsx 의 register API 로 다시 시도
  const { register } = await import('tsx/esm/api');
  register();
  return import(pathToFileURL(join(root, 'src', 'shared', 'content', 'assets.ts')).href);
});

const results = [];
for (const a of IMAGE_ASSETS) {
  const candidates = [`${a.id}.png`, `${a.id}.PNG`, `${a.id}.jpg`, `${a.id}.jpeg`, `${a.id}.webp`];
  const found = candidates.map((c) => join(srcDir, c)).find((p) => existsSync(p));
  if (!found) { results.push({ id: a.id, status: 'missing' }); continue; }
  const meta = await sharp(found).metadata();
  if (a.alpha && !meta.hasAlpha) console.warn(`경고: ${a.id} 는 투명 배경이어야 하는데 알파 채널이 없습니다.`);
  const widths = VARIANT_WIDTHS[a.group];
  const variants = [];
  for (const w of widths) {
    const out = join(outDir, `${a.id}-${w}.webp`);
    const quality = a.group === 'background' || a.group === 'principle' ? 78 : 84;
    await sharp(found).resize({ width: Math.min(w, meta.width ?? w), withoutEnlargement: true }).webp({ quality, alphaQuality: 90, effort: 5 }).toFile(out);
    variants.push(w);
  }
  const kb = variants.reduce((acc, w) => acc + statSync(join(outDir, `${a.id}-${w}.webp`)).size, 0) / 1024;
  results.push({ id: a.id, status: 'ok', variants, alpha: !!meta.hasAlpha, width: meta.width, height: meta.height, kb: Math.round(kb) });
}
for (const r of results) console.log(r.status === 'ok' ? `${r.id.padEnd(24)} ${r.width}x${r.height} alpha=${r.alpha} ${r.variants.join('/')} ${r.kb}KB` : `${r.id.padEnd(24)} 없음 → 점선 상자`);
writeFileSync(join(outDir, 'index.json'), JSON.stringify({ builtAt: new Date().toISOString(), images: results }, null, 2));

const audioFiles = new Set(existsSync(audioDir) ? readdirSync(audioDir) : []);
const audio = AUDIO_ASSETS.map((a) => ({ id: a.id, status: audioFiles.has(`${a.id}.mp3`) ? 'ok' : 'missing' }));
writeFileSync(join(audioDir, 'index.json'), JSON.stringify({ builtAt: new Date().toISOString(), audio }, null, 2));
console.log(`그림 ${results.filter((r) => r.status === 'ok').length}/${results.length}, 소리 ${audio.filter((a) => a.status === 'ok').length}/${audio.length}`);
