import { WebSocketService } from '@services/web-socket-service';
import { Logger } from '@aws-lambda-powertools/logger';
import { handler } from './stream-event-handler';
import { StreamEvent } from '../../../types/event-types';
import { DynamoDBStreamRepository } from '@repositories/stream-repository';
import { Stream } from '@domains/stream/models/stream';
import { SongQueue } from '@domains/stream/models/song-queue';
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest';

vi.mock('@services/web-socket-service');
vi.mock('@aws-lambda-powertools/logger');
vi.mock('@repositories/stream-repository');
vi.mock('@domains/stream/models/stream');
vi.mock('@utils/utilities', () => ({
  generateStreamDate: vi.fn().mockReturnValue('2026-04-05')
}));

describe('stream-event-handler', () => {
  let webSocketServiceMock;
  let loggerMock;

  beforeEach(() => {
    webSocketServiceMock = {
      broadcast: vi.fn()
    };
    loggerMock = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn()
    };

    vi.mocked(WebSocketService).mockImplementation(function () {
      return webSocketServiceMock as any;
    });
    vi.mocked(Logger).mockImplementation(function () {
      return loggerMock as any;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should broadcast a song-added message when detailType is song-added-to-queue', async () => {
    const mockSongs = [
      {
        id: '1',
        title: 'Test Song',
        requestedBy: 'User1',
        duration: 300,
        status: 'queued'
      }
    ];
    const mockQueue = {
      getSongs: vi.fn().mockReturnValue(mockSongs)
    } as unknown as SongQueue;
    const mockStream = { getSongQueue: vi.fn().mockReturnValue(mockQueue) };

    (DynamoDBStreamRepository.prototype.loadStream as any).mockResolvedValue({ id: 'stream123' });
    (Stream.load as any).mockReturnValue(mockStream);

    const event = {
      'detail-type': StreamEvent.SONG_ADDED_TO_QUEUE,
      detail: {}
    };

    const expectedMessage = JSON.stringify({
      event: 'song-added-to-queue',
      data: {
        songQueue: [
          {
            songId: '1',
            title: 'Test Song',
            requestedBy: 'User1',
            duration: 300,
            status: 'queued'
          }
        ]
      }
    });

    const broadcastSpy = vi
      .spyOn(WebSocketService.prototype, 'broadcast')
      .mockImplementation(() => Promise.resolve());

    await handler(event);
    expect(broadcastSpy).toHaveBeenCalledWith(expectedMessage);
  });

  it('should broadcast a song-removed message when detailType is song-removed-from-queue', async () => {
    const event = {
      'detail-type': StreamEvent.SONG_REMOVED_FROM_QUEUE,
      detail: {
        songId: '1'
      }
    };

    const expectedMessage = JSON.stringify({
      event: 'song-removed-from-queue',
      data: {
        songId: '1'
      }
    });

    const broadcastSpy = vi
      .spyOn(WebSocketService.prototype, 'broadcast')
      .mockImplementation(() => Promise.resolve());

    await handler(event);
    expect(broadcastSpy).toHaveBeenCalledWith(expectedMessage);
  });

  it('should broadcast a song-moved message when detailType is song-moved', async () => {
    const event = {
      'detail-type': StreamEvent.SONG_MOVED,
      detail: {
        songId: '1',
        position: 2
      }
    };

    const expectedMessage = JSON.stringify({
      event: 'song-moved-in-queue',
      data: {
        songId: '1',
        position: 2
      }
    });

    const broadcastSpy = vi
      .spyOn(WebSocketService.prototype, 'broadcast')
      .mockImplementation(() => Promise.resolve());

    await handler(event);
    expect(broadcastSpy).toHaveBeenCalledWith(expectedMessage);
  });

  it('should broadcast a song-bumped message when detailType is song-bumped', async () => {
    const event = {
      'detail-type': StreamEvent.SONG_BUMPED,
      detail: {
        songId: '1',
        position: 2
      }
    };

    const expectedMessage = JSON.stringify({
      event: 'song-bumped-in-queue',
      data: {
        songId: '1',
        position: 2
      }
    });

    const broadcastSpy = vi
      .spyOn(WebSocketService.prototype, 'broadcast')
      .mockImplementation(() => Promise.resolve());

    await handler(event);
    expect(broadcastSpy).toHaveBeenCalledWith(expectedMessage);
  });
});
