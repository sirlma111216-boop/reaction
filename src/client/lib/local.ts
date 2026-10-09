import type { GameState, PresetId } from '../../shared/types';
import type { ClientView, RoomCommand } from '../../shared/protocol';
import type { GameClient, SendResult } from './net';
import { createGame, cumulativeNet, TEAM_COLORS } from '../../shared/engine/state';
import { startGame, settleDay } from '../../shared/engine/phases';
import { applyTeamCommand } from '../../shared/engine/commands';
import { projectGame, stripTeam } from '../../shared/projection';
import { BOTS, makeExec } from '../../sim/bots';
import { subRng } from '../../shared/engine/rng';
import { store } from './store';
import { audio } from './audio';

/**
 * 연습 모드: 서버 없이 브라우저 안에서 같은 엔진으로 AI 카페 한 곳과 6일을 경쟁한다.
 * 내가 「오늘 영업 마감」을 누르면 AI 팀(learner 봇)이 행동하고 정산 1회 → 다음 날.
 */
export class LocalClient implements GameClient {
  readonly kind = 'local' as const;
  private state: GameState;
  private readonly me = { playerId: 'me', nick: '연습생', teamId: 'T1' };

  constructor(presetId: PresetId, days = 6, mascot = 'mascot-cat', name = '우리 카페') {
    this.state = createGame({
      seed: `practice-${Date.now()}`, presetId, daysTotal: days,
      teams: [
        { id: 'T1', name, color: TEAM_COLORS[0]!, mascot },
        { id: 'T2', name: 'AI 카페', color: TEAM_COLORS[1]!, mascot: 'mascot-fox' },
      ],
    });
    this.emit();
  }

  private emit(): void {
    const g = this.state;
    const teams = g.teamOrder.map((id) => {
      const t = g.teams[id]!;
      return { id, name: t.name, color: t.color, mascot: t.mascot, leaderId: id === 'T1' ? 'me' : 'ai', members: id === 'T1' ? ['me'] : ['ai'], ready: true, dayReady: t.ready, netUntilYesterday: cumulativeNet(t), netHistory: t.netHistory, operatorId: id === 'T1' ? 'me' : 'ai', actionsLeft: t.actionsLeft, connectedCount: 1 };
    });
    const view: ClientView = {
      serverNow: Date.now(),
      me: { playerId: 'me', nick: this.me.nick, role: 'student', teamId: 'T1', isLeader: true, isOperator: true },
      room: { code: 'PRACTC', status: g.phase === 'setup' ? 'lobby' : g.phase === 'finished' ? 'finished' : 'playing', locked: true, presetId: g.presetId, days: g.daysTotal, teacherNick: '연습', teacherPlayerId: 'ai', createdAt: Date.now(), expiresAt: Date.now() + 3600_000, joinUrl: '' },
      players: [{ id: 'me', nick: this.me.nick, role: 'student', teamId: 'T1', isLeader: true, connected: true }, { id: 'ai', nick: 'AI 점장', role: 'student', teamId: 'T2', isLeader: true, connected: true }],
      teams,
      game: g.phase === 'setup' ? null : projectGame(g, 'T1'),
      teacherTeams: [stripTeam(g.teams['T2']!)],
    };
    store.setView(view);
  }

  private botTurn(): void {
    const g = this.state;
    BOTS.learner.day(g, 'T2', { rng: subRng(g.seed, 'ai', g.day), exec: makeExec(g, 'T2') });
    applyTeamCommand(g, 'T2', { type: 'ready', on: true });
  }

  async send(cmd: RoomCommand): Promise<SendResult> {
    const g = this.state;
    if (cmd.type === 'start') {
      if (g.phase !== 'setup') return { ok: false, error: '이미 시작했어요.' };
      startGame(g);
      g.teams['T1']!.operatorId = 'me';
      g.teams['T2']!.operatorId = 'ai';
      this.emit();
      return { ok: true };
    }
    if (cmd.type === 'team') {
      const c = cmd.cmd.type === 'pin' ? { ...cmd.cmd, playerId: 'me', at: Date.now() } : cmd.cmd;
      const r = applyTeamCommand(g, 'T1', c);
      if (r.ok && c.type === 'ready' && c.on && g.phase === 'open') {
        this.botTurn();
        settleDay(g);
        if ((g.phase as string) !== 'finished') { g.teams['T1']!.operatorId = 'me'; g.teams['T2']!.operatorId = 'ai'; audio.sting('sting-day-open'); }
        else audio.sting('sting-final');
      }
      this.emit();
      return r;
    }
    return { ok: false, error: '연습 모드에서는 쓰지 않는 명령이에요.' };
  }

  close(): void {
    store.reset();
  }
}
