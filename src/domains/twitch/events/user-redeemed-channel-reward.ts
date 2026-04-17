import { KentobotDomainEvent } from '@core/domain-event';

export type UserRedeemedChannelRewardEventPayload = {
  userLogin: string;
  username: string;
  rewardId: string;
  rewardTitle: string;
  redeemedAt: string;
};

export type UserRedeemedChannelRewardEvent =
  KentobotDomainEvent<UserRedeemedChannelRewardEventPayload> & {
    type: 'channel-point-redemption';
    source: 'twitch';
    version: 1;
  };
