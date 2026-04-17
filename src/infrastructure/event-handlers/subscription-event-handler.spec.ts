import { UserGiftedSubscriptionEvent } from '@domains/twitch/events/user-gifted-subscription-event';
import { UserResubscriptionEvent } from '@domains/twitch/events/user-resubscribed-event';
import { UserSubscribedEvent } from '@domains/twitch/events/user-subscribed-event';
import { handler } from './subscription-event-handler';
import { StreamFactory } from '@domains/stream/factories/stream-factory';
import { BumpSongCommandHandler } from '@command-handlers/bump-song-command-handler';
import { BumpSongCommand } from '@commands/bump-song-command';
import { BumpType } from '../../types/song-request';
import { Logger } from '@aws-lambda-powertools/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@domains/stream/factories/stream-factory');
vi.mock('@repositories/stream-repository');

describe('Subscription Event Handler', () => {
  let bumpSongCommandHandlerSpy: any;

  beforeEach(() => {
    vi.resetAllMocks();

    const mockStream = {
      bumpSongForUser: vi.fn().mockResolvedValue(undefined)
    };
    (StreamFactory.prototype.createStream as any).mockResolvedValue(mockStream);

    bumpSongCommandHandlerSpy = vi.spyOn(
      BumpSongCommandHandler.prototype,
      'execute'
    );
  });

  // Add your tests here
  it('should execute a sub bump for a user-subscribed event', async () => {
    const event: UserSubscribedEvent = {
      type: 'user-subscribed',
      source: 'twitch',
      version: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        username: 'Kaladin',
        isGift: false,
        userLogin: 'kaladin'
      }
    };

    await handler(event);

    expect(bumpSongCommandHandlerSpy).toHaveBeenCalledWith({
      requestedBy: 'Kaladin',
      bumpType: BumpType.Sub
    });
  });

  it('should not execute a sub bump for a user-subscribed event for a gift sub', async () => {
    const event: UserSubscribedEvent = {
      type: 'user-subscribed',
      source: 'twitch',
      version: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        username: 'Kaladin',
        isGift: true,
        userLogin: 'kaladin'
      }
    };

    await handler(event);

    expect(bumpSongCommandHandlerSpy).not.toHaveBeenCalled();
  });

  it('should execute a gift sub bump for a user-gifted-subscription event', async () => {
    const event: UserGiftedSubscriptionEvent = {
      type: 'user-gifted-subscription',
      source: 'twitch',
      version: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        username: 'Dalinar',
        userLogin: '',
        total: 0,
        tier: 'dalinar'
      }
    };

    await handler(event);

    expect(bumpSongCommandHandlerSpy).toHaveBeenCalledWith({
      requestedBy: 'Dalinar',
      bumpType: BumpType.GiftedSub
    });
  });

  it('should execute a sub bump for a user-resubscribed event', async () => {
    const event: UserResubscriptionEvent = {
      type: 'user-resubscribed',
      source: 'twitch',
      version: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        username: 'Shallan',
        userLogin: '',
        totalMonths: 0,
        streakMonths: 0,
        durationMonths: 0,
        tier: 'shallan'
      }
    };

    await handler(event);

    expect(bumpSongCommandHandlerSpy).toHaveBeenCalledWith({
      requestedBy: 'Shallan',
      bumpType: BumpType.Sub
    });
  });

  it('should log an error when an unknown event is received', async () => {
    const loggerSpy = vi.spyOn(Logger.prototype, 'error');

    const event: any = {
      type: 'unknown-event',
      source: 'twitch',
      version: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        username: 'Shallan',
        userLogin: '',
        totalMonths: 0,
        streakMonths: 0,
        durationMonths: 0,
        tier: 'shallan'
      }
    };

    await handler(event);

    expect(loggerSpy).toHaveBeenCalledWith(
      'Unknown subscription event type, exiting...'
    );
  });
});
