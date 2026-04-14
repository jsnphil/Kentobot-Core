import { KentobotDomainEvent } from '@core/events/domain-event';

export type SongAddedToQueueEventPayload = {
  songId: string;
  requestedBy: string;
  title: string;
  duration: number;
};

export type SongAddedToQueueEvent =
  KentobotDomainEvent<SongAddedToQueueEventPayload> & {
    type: 'song-added-to-queue';
    payload: SongAddedToQueueEventPayload;
    source: 'kentobot.streaming.system';
    version: 1;
  };
