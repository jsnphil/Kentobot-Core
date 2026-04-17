import { BumpSongCommandHandler } from '@command-handlers/bump-song-command-handler';
import { BumpSongCommand } from '@commands/bump-song-command';
import { StreamFactory } from '@domains/stream/factories/stream-factory';
import { ChannelRaidedEvent } from '@domains/twitch/events/channel-raided-event';
import { handler } from './channel-raided-event-handler';
import { BumpType } from '../../types/song-request';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { any } from 'zod';

vi.mock('@domains/stream/factories/stream-factory');
vi.mock('@repositories/stream-repository');

describe('Channel raided event handler', () => {
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

  it('should execute a raid bump for a channel-raided event', async () => {
    const event: ChannelRaidedEvent = {
      type: 'channel-raided',
      source: 'twitch',
      version: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        raiderUserLogin: 'kaladin',
        raiderUsername: 'Kaladin',
        viewerCount: 100
      }
    };

    await handler(event);

    expect(bumpSongCommandHandlerSpy).toHaveBeenCalledWith({
      requestedBy: 'Kaladin',
      bumpType: BumpType.Raid
    });
  });
});
