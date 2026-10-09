import { prefGet, prefSet } from './session';
import { audioAvailable } from './assets';

/**
 * 소리: 파일이 있을 때만 재생하고, 없으면 무음으로 동작한다.
 * 기본값은 교실 사용에 맞춘다. 학생 기기: BGM 꺼짐, 효과음 켜짐(60%). 교사 화면: BGM과 짧은 음악 켜짐.
 * 첫 터치 전에는 재생하지 않는다.
 */
class AudioManager {
  private unlocked = false;
  private bgmEl: HTMLAudioElement | null = null;
  private bgmId: string | null = null;
  private lastPlay: Record<string, number> = {};
  private profileApplied = false;
  bgmOn = prefGet('bgm', '0') === '1';
  sfxOn = prefGet('sfx', '1') === '1';
  bgmVolume = Number(prefGet('bgmVol', '0.35'));
  sfxVolume = Number(prefGet('sfxVol', '0.6'));

  init(): void {
    const unlock = () => {
      this.unlocked = true;
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      if (this.bgmOn && this.bgmId) this.bgm(this.bgmId);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
  }

  /** 역할에 맞는 기본값. 사용자가 한 번이라도 바꿨으면 그대로 둔다. */
  applyProfile(role: 'teacher' | 'student'): void {
    if (this.profileApplied) return;
    this.profileApplied = true;
    if (prefGet('bgm', '') === '' && role === 'teacher') { this.bgmOn = true; }
  }

  setBgm(on: boolean): void { this.bgmOn = on; prefSet('bgm', on ? '1' : '0'); if (!on) this.stopBgm(); else if (this.bgmId) this.bgm(this.bgmId); }
  setSfx(on: boolean): void { this.sfxOn = on; prefSet('sfx', on ? '1' : '0'); }
  setBgmVolume(v: number): void { this.bgmVolume = v; prefSet('bgmVol', String(v)); if (this.bgmEl) this.bgmEl.volume = v; }
  setSfxVolume(v: number): void { this.sfxVolume = v; prefSet('sfxVol', String(v)); }

  bgm(id: string): void {
    this.bgmId = id;
    if (!this.bgmOn || !this.unlocked || !audioAvailable(id)) { if (this.bgmEl && this.bgmEl.dataset['id'] !== id) this.stopBgm(); return; }
    if (this.bgmEl && this.bgmEl.dataset['id'] === id) return;
    this.stopBgm();
    const el = new Audio(`/assets/audio/${id}.mp3`);
    el.loop = true; el.volume = this.bgmVolume; el.dataset['id'] = id;
    el.play().catch(() => {});
    this.bgmEl = el;
  }
  stopBgm(): void { if (this.bgmEl) { try { this.bgmEl.pause(); } catch {} this.bgmEl = null; } }

  /** 효과음. 같은 소리의 중복 재생을 150ms 안에서는 막는다. */
  sfx(id: string): void {
    if (!this.sfxOn || !this.unlocked || !audioAvailable(id)) return;
    const now = Date.now();
    if (now - (this.lastPlay[id] ?? 0) < 150) return;
    this.lastPlay[id] = now;
    const el = new Audio(`/assets/audio/${id}.mp3`);
    el.volume = this.sfxVolume;
    el.play().catch(() => {});
  }
  /** 짧은 음악(한 번). BGM 설정을 따른다. */
  sting(id: string): void {
    if (!this.bgmOn || !this.unlocked || !audioAvailable(id)) return;
    const el = new Audio(`/assets/audio/${id}.mp3`);
    el.volume = this.bgmVolume;
    el.play().catch(() => {});
  }
}

export const audio = new AudioManager();
