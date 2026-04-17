import { KentobotDomainEvent } from '@core/domain-event';

export type SongRemovedFromQueueEventPayload = {
  songId: string;
};

export type SongRemovedFromQueueEvent =
  KentobotDomainEvent<SongRemovedFromQueueEventPayload> & {
    type: 'song-removed-from-queue';
    payload: SongRemovedFromQueueEventPayload;
    source: 'kentobot.streaming.system';
    version: 1;
  };
