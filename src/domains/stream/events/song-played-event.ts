import { KentobotDomainEvent } from '@core/domain-event';

export type SongPlayedEventPayload = {
  songId: string;
  requestedBy: string;
  title: string;
  duration: number;
  playedAt: string;
};

export type SongPlayedEvent = KentobotDomainEvent<SongPlayedEventPayload> & {
  type: 'song-played';
  source: 'kentobot.streaming.system';
  version: 1;
};
