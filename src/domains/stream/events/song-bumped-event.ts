import { BumpType } from '../../../types/song-request';
import { KentobotDomainEvent } from '@core/events/domain-event';

export type SongBumpedEventPayload = {
  songId: string;
  bumpPosition: number;
  bumpType: BumpType;
};

export type SongBumpedEvent = KentobotDomainEvent<SongBumpedEventPayload> & {
  type: 'song-bumped-in-queue';
  payload: SongBumpedEventPayload;
  source: 'kentobot.streaming.system';
  version: 1;
};
