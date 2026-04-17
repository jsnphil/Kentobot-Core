import { KentobotDomainEvent } from '@core/domain-event';

export type StreamOnlineEventPayload = {
  startedAt: string;
  type: string;
};

export type StreamOnlineEvent =
  KentobotDomainEvent<StreamOnlineEventPayload> & {
    type: 'stream-online';
    source: 'twitch';
    version: 1;
  };
