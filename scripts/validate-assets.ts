/**
 * 자산 검수: npm run assets:validate
 * 8절 목록의 ID 별 파일 유무, 형식(RIFF/WEBP), 투명 배경 여부를 검사해 reports/asset-coverage.json 에 쓴다.
 * 파일이 없다는 것만으로 실패하지 않고 목록으로 보고한다. 형식이 틀린 파일이 있으면 종료 코드 1.
 */
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUDIO_ASSETS, IMAGE_ASSETS, VARIANT_WIDTHS } from '../src/shared/content/assets';

const root = process.cwd();
const imgDir = join(root, 'public', 'assets', 'images');
const audioDir = join(root, 'public', 'assets', 'audio');
const reportDir = join(root, 'reports');
mkdirSync(reportDir, { recursive: true });

interface FileCheck { file: string; ok: boolean; reason?: string; width?: number; height?: number; alpha?: boolean }

async function checkFile(file: string, wantAlpha: boolean): Promise<FileCheck> {
  const p = join(imgDir, file);
  if (!existsSync(p)) return { file, ok: false, reason: '파일 없음' };
  const buf = readFileSync(p);
  const magic = buf.subarray(0, 4).toString('ascii') + buf.subarray(8, 12).toString('ascii');
  if (magic !== 'RIFFWEBP') return { file, ok: false, reason: `WebP 가 아님 (${magic})` };
  const m = await sharp(p).metadata();
  if (wantAlpha && !m.hasAlpha) return { file, ok: false, reason: '투명 배경(알파) 없음', width: m.width, height: m.height, alpha: false };
  return { file, ok: true, width: m.width, height: m.height, alpha: !!m.hasAlpha };
}

async function main() {
  const problems: string[] = [];
  const images = [];
  for (const a of IMAGE_ASSETS) {
    const files = VARIANT_WIDTHS[a.group].map((w) => `${a.id}-${w}.webp`);
    const checks = await Promise.all(files.map((f) => checkFile(f, a.alpha)));
    const present = checks.filter((c) => c.reason !== '파일 없음');
    const status = present.length === 0 ? 'missing' : present.every((c) => c.ok) && present.length === files.length ? 'ok' : 'problem';
    if (status === 'problem') problems.push(`${a.id}: ${checks.filter((c) => !c.ok).map((c) => `${c.file} ${c.reason}`).join(', ')}`);
    images.push({ id: a.id, name: a.name, group: a.group, recommended: `${a.width}×${a.height}${a.alpha ? ' 투명' : ''}`, usedIn: a.usedIn, status, files: checks });
  }
  const audioFiles = new Set(existsSync(audioDir) ? readdirSync(audioDir) : []);
  const audio = AUDIO_ASSETS.map((a) => ({ id: a.id, name: a.name, kind: a.kind, usedIn: a.usedIn, status: audioFiles.has(`${a.id}.mp3`) ? 'ok' : 'missing' }));
  const report = {
    generatedAt: new Date().toISOString(),
    note: '파일이 없는 자산은 점선 상자(그림)와 무음(소리)으로 동작한다. 형식 문제만 실패로 친다.',
    summary: { images: images.length, imagesOk: images.filter((i) => i.status === 'ok').length, imagesMissing: images.filter((i) => i.status === 'missing').length, imagesProblem: problems.length, audio: audio.length, audioOk: audio.filter((a) => a.status === 'ok').length },
    images, audio, problems,
  };
  writeFileSync(join(reportDir, 'asset-coverage.json'), JSON.stringify(report, null, 2));
  console.log(`그림 ${report.summary.imagesOk}/${report.summary.images} (없음 ${report.summary.imagesMissing}, 문제 ${problems.length}) · 소리 ${report.summary.audioOk}/${report.summary.audio}`);
  for (const p of problems) console.log('  문제:', p);
  const missing = images.filter((i) => i.status === 'missing').map((i) => i.id);
  if (missing.length) console.log(`  없는 그림 (${missing.length}): ${missing.join(', ')}`);
  const missingAudio = audio.filter((a) => a.status === 'missing').map((a) => a.id);
  if (missingAudio.length) console.log(`  없는 소리 (${missingAudio.length}): ${missingAudio.join(', ')}`);
  console.log('보고서: reports/asset-coverage.json');
  if (problems.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
