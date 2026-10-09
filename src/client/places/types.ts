import type { TeamCommand } from '../../shared/types';
import type { SendResult } from '../lib/net';

/** 장소 화면이 팀 명령을 보내는 함수. 성공하면 효과음을 낸다 */
export type Act = (cmd: TeamCommand, sfx?: string) => Promise<SendResult>;
