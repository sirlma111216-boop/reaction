import type { ClientEnvelope, ClientView, RoomCommand, ServerMessage } from '../../shared/protocol';
import { store } from './store';
import { audio } from './audio';

export interface SendResult { ok: boolean; error?: string; stars?: number; paid?: number; result?: string }

/** 게임 화면이 쓰는 클라이언트 추상화. 서버(WebSocket)와 연습 모드(로컬)가 같은 인터페이스를 구현한다. */
export interface GameClient {
  send(cmd: RoomCommand): Promise<SendResult>;
  close(): void;
  readonly kind: 'ws' | 'local';
}

let cmdSeq = 0;
function nextCommandId(): string {
  cmdSeq += 1;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${cmdSeq}`;
}

export class WsClient implements GameClient {
  readonly kind = 'ws' as const;
  private ws: WebSocket | null = null;
  private pending = new Map<string, { resolve: (r: SendResult) => void; envelope: ClientEnvelope; sentAt: number }>();
  private closedByUser = false;
  private retry = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastDay = -1;
  private lastOperator = false;

  constructor(private code: string, private token: string) {
    this.connect();
  }

  private url(): string {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws?room=${encodeURIComponent(this.code)}&token=${encodeURIComponent(this.token)}`;
  }

  private connect(): void {
    if (this.closedByUser) return;
    store.setConnection(this.retry === 0 ? 'connecting' : 'reconnecting');
    const ws = new WebSocket(this.url());
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      store.setConnection('open');
      // 재연결 시 미응답 명령 재전송 (같은 commandId → 서버가 중복 처리하지 않음)
      for (const p of this.pending.values()) ws.send(JSON.stringify(p.envelope));
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 25_000);
    };
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try { msg = JSON.parse(String(ev.data)) as ServerMessage; } catch { return; }
      if (msg.type === 'view') this.onView(msg.view);
      else if (msg.type === 'ack') {
        const p = this.pending.get(msg.id);
        if (p) { this.pending.delete(msg.id); p.resolve({ ok: msg.ok, error: msg.error, stars: msg.stars, paid: msg.paid, result: msg.result }); store.setPending(this.pending.size); }
      } else if (msg.type === 'toast') { store.toast(msg.text, msg.level); }
      else if (msg.type === 'closed') { this.closedByUser = true; store.setConnection('closed', msg.reason); }
    };
    ws.onclose = (ev) => {
      if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
      if (this.closedByUser) { store.setConnection('closed', store.get().closedReason ?? (ev.code === 4001 ? '다른 기기에서 다시 접속했어요.' : null)); return; }
      if (ev.code === 4001 || ev.code === 4002 || ev.code === 4000) { this.closedByUser = true; store.setConnection('closed', ev.code === 4002 ? '선생님이 내보냈어요.' : ev.code === 4000 ? '방이 만료되었어요.' : '접속 정보가 바뀌었어요. 선생님께 새 접속을 요청하세요.'); return; }
      const delay = Math.min(8000, 500 * 2 ** this.retry++);
      store.setConnection('reconnecting');
      setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => {};
  }

  private onView(view: ClientView): void {
    const g = view.game;
    if (g) {
      if (this.lastDay !== -1 && g.day !== this.lastDay && g.phase === 'open') audio.sting('sting-day-open');
      if (g.phase === 'finished' && this.lastDay !== -2) { audio.sting('sting-final'); this.lastDay = -2; }
      else if (g.phase !== 'finished') this.lastDay = g.day;
      if (view.me.isOperator && !this.lastOperator) audio.sfx('sfx-turn');
      this.lastOperator = view.me.isOperator;
    }
    store.setView(view);
  }

  send(cmd: RoomCommand): Promise<SendResult> {
    const id = nextCommandId();
    const envelope: ClientEnvelope = { type: 'cmd', id, cmd };
    return new Promise((resolve) => {
      this.pending.set(id, { resolve, envelope, sentAt: Date.now() });
      store.setPending(this.pending.size);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(envelope));
      setTimeout(() => {
        const p = this.pending.get(id);
        if (p) { this.pending.delete(id); store.setPending(this.pending.size); resolve({ ok: false, error: '서버 응답이 없어요. 연결을 확인하세요.' }); }
      }, 12_000);
    });
  }

  close(): void {
    this.closedByUser = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    try { this.ws?.close(1000, 'bye'); } catch {}
    store.setConnection('closed');
  }
}

export async function api<T>(path: string, init: RequestInit & { teacherKey?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.teacherKey) headers['x-teacher-key'] = init.teacherKey;
  const res = await fetch(path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `요청 실패 (${res.status})`);
  return data;
}
