import { KentobotDomainEvent } from '@core/domain-event';

import { UserRedeemedChannelRewardEvent } from '@domains/twitch/events/user-redeemed-channel-reward';
import { UserCheeredEvent } from '@domains/twitch/events/user-cheered-event';
import { UserGiftedSubscriptionEvent } from '@domains/twitch/events/user-gifted-subscription-event';
import { UserResubscriptionEvent } from '@domains/twitch/events/user-resubscribed-event';
import { UserSubscribedEvent } from '@domains/twitch/events/user-subscribed-event';
import { StreamOnlineEvent } from '@domains/twitch/events/stream-online-event';
import { StreamOfflineEvent } from '@domains/twitch/events/stream-offline-event';
import { ChannelRaidedEvent } from '@domains/twitch/events/channel-raided-event';
import { TwitchEvent, TwitchSubscription } from '../../types/twitch';

export class TwitchEventMapper {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static toDomainEvent(body: any): KentobotDomainEvent<any> | null {
    const twitchSubscription = body.subscription as TwitchSubscription;
    const twitchEvent = body.event as TwitchEvent;

    const type = twitchSubscription.type;
    switch (type) {
      case 'channel.subscribe': {
        return {
          type: 'user-subscribed',
          source: 'twitch',
          version: 1,
          occurredAt: twitchSubscription.created_at ?? new Date().toISOString(),
          payload: {
            userLogin: twitchEvent.user_login,
            username: twitchEvent.user_name, // changed
            isGift: twitchEvent.is_gift
          }
        } as UserSubscribedEvent;
      }
      case 'channel.subscription.gift': {
        return {
          type: 'user-gifted-subscription',
          source: 'twitch',
          version: 1,
          occurredAt: twitchSubscription.created_at ?? new Date().toISOString(),
          payload: {
            userLogin: twitchEvent.user_login,
            username: twitchEvent.user_name, // changed
            total: twitchEvent.total,
            tier: twitchEvent.tier
          }
        } as UserGiftedSubscriptionEvent;
      }
      case 'channel.subscription.message': {
        return {
          type: 'user-resubscribed',
          source: 'twitch',
          version: 1,
          occurredAt: twitchSubscription.created_at ?? new Date().toISOString(),
          payload: {
            userLogin: twitchEvent.user_login,
            username: twitchEvent.user_name, // changed
            totalMonths: twitchEvent.cumulative_months,
            streakMonths: twitchEvent.streak_months,
            durationMonths: twitchEvent.duration_months,
            tier: twitchEvent.tier
          }
        } as UserResubscriptionEvent;
      }
      case 'channel.cheer': {
        return {
          type: 'user-cheered',
          source: 'twitch',
          version: 1,
          occurredAt: twitchSubscription.created_at ?? new Date().toISOString(),
          payload: {
            userLogin: twitchEvent.user_login,
            username: twitchEvent.user_name, // changed
            bits: twitchEvent.bits
          }
        } as UserCheeredEvent;
      }
      case 'channel.channel_points_custom_reward_redemption.add': {
        return {
          type: 'user-redeemed-channel-reward',
          source: 'twitch',
          version: 1,
          occurredAt: twitchSubscription.created_at ?? new Date().toISOString(),
          payload: {
            userLogin: twitchEvent.user_login,
            username: twitchEvent.user_name, // changed
            rewardId: twitchEvent.reward?.id,
            rewardTitle: twitchEvent.reward?.title,
            redeemedAt: twitchEvent.redeemed_at
          }
        } as UserRedeemedChannelRewardEvent;
      }
      case 'stream.online': {
        return {
          type: 'stream-online',
          source: 'twitch',
          version: 1,
          occurredAt: twitchSubscription.created_at ?? new Date().toISOString(),
          payload: {
            type: twitchEvent.type,
            startedAt: twitchEvent.started_at
          }
        } as StreamOnlineEvent;
      }
      case 'stream.offline': {
        return {
          type: 'stream-offline',
          source: 'twitch',
          occurredAt: twitchSubscription.created_at ?? new Date().toISOString(),
          version: 1,
          payload: {}
        } as StreamOfflineEvent;
      }
      case 'channel.raid': {
        return {
          type: 'channel-raided',
          source: 'twitch',
          version: 1,
          occurredAt: twitchSubscription.created_at ?? new Date().toISOString(),
          payload: {
            raiderUserLogin: twitchEvent.from_broadcaster_user_login,
            raiderUsername: twitchEvent.from_broadcaster_user_name,
            viewerCount: twitchEvent.viewers
          }
        } as ChannelRaidedEvent;
      }
      default:
        return null;
    }
  }
}
