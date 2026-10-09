/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from 'cloudflare:workers';

export interface RoomSummary {
  code: string;
  createdAt: number;
  presetId: string;
  days: number;
  status: string;
  teacherNick: string;
}

const MAX_AGE = 48 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX = 10;

/** 교사용 방 목록과 로그인 시도 제한. 방 자체의 권위는 각 Room DO 에 있다. */
export class DirectoryDurableObject extends DurableObject {
  private list: RoomSummary[] | null = null;
  private logins: Record<string, number[]> = {};

  private async load(): Promise<RoomSummary[]> {
    if (!this.list) this.list = (await this.ctx.storage.get<RoomSummary[]>('rooms')) ?? [];
    return this.list;
  }
  private async save(): Promise<void> {
    await this.ctx.storage.put('rooms', this.list ?? []);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/login-attempt' && request.method === 'POST') {
      // 같은 IP 에서 1분에 10번까지만 (9.2-4). 메모리에만 두고, 저장소 재시작 시 초기화된다.
      const body = (await request.json()) as { ip: string };
      const now = Date.now();
      const key = body.ip || 'unknown';
      const arr = (this.logins[key] ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
      if (arr.length >= LOGIN_MAX) { this.logins[key] = arr; return Response.json({ allowed: false }); }
      arr.push(now);
      this.logins[key] = arr;
      for (const k of Object.keys(this.logins)) if (!this.logins[k]!.some((t) => now - t < LOGIN_WINDOW_MS)) delete this.logins[k];
      return Response.json({ allowed: true });
    }
    const list = await this.load();
    const now = Date.now();
    const fresh = list.filter((r) => now - r.createdAt < MAX_AGE);
    if (fresh.length !== list.length) { this.list = fresh; await this.save(); }
    if (url.pathname === '/register' && request.method === 'POST') {
      const body = (await request.json()) as RoomSummary;
      this.list = [body, ...fresh.filter((r) => r.code !== body.code)].slice(0, 200);
      await this.save();
      return Response.json({ ok: true });
    }
    if (url.pathname === '/status' && request.method === 'POST') {
      const body = (await request.json()) as { code: string; status: string };
      const r = fresh.find((x) => x.code === body.code);
      if (r) { r.status = body.status; await this.save(); }
      return Response.json({ ok: true });
    }
    if (url.pathname === '/list') return Response.json({ rooms: fresh });
    return new Response('not found', { status: 404 });
  }
}
