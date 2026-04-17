import { KentobotDomainEvent } from '@core/domain-event';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type StreamOfflinePayload = {};

export type StreamOfflineEvent = KentobotDomainEvent<StreamOfflinePayload> & {
  type: 'stream-offline';
  source: 'twitch';
  version: 1;
};
