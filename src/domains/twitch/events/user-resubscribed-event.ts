import { KentobotDomainEvent } from '@core/domain-event';

export type UserResubscriptionEventPayload = {
  userLogin: string;
  username: string;
  totalMonths: number;
  streakMonths: number;
  durationMonths: number;
  tier: string;
};

export type UserResubscriptionEvent =
  KentobotDomainEvent<UserResubscriptionEventPayload> & {
    type: 'user-resubscribed';
    source: 'twitch';
    version: 1;
  };
