import { KentobotDomainEvent } from '@core/domain-event';

export type ChannelRaidedEventPayload = {
  raiderUserLogin: string;
  raiderUsername: string;
  viewerCount: number;
};

export type ChannelRaidedEvent =
  KentobotDomainEvent<ChannelRaidedEventPayload> & {
    type: 'channel-raided';
    source: 'twitch';
    version: 1;
  };
