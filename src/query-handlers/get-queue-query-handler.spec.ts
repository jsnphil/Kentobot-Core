import { Stream } from '@domains/stream/models/stream';
import { GetQueueRequest } from '@queries/get-queue-request';
import { SongRequestStatus } from '../types/song-request';
import { StreamFactory } from '@domains/stream/factories/stream-factory';
import { GetQueueRequestHandler } from './get-queue-query-handler';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../domains/stream/models/stream');
vi.mock('@utils/utilities');

describe('GetQueryRequestHandler', () => {
  let getQueueRequestHandler: GetQueueRequestHandler;
  let mockStreamFactory: { createStream: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockStreamFactory = { createStream: vi.fn() };
    getQueueRequestHandler = new GetQueueRequestHandler(mockStreamFactory as unknown as StreamFactory);
  });

  it('should return the song queue when the stream exists', async () => {
    const mockStreamDate = '2023-10-01';
    const mockSongQueue = {
      getSongs: vi.fn().mockReturnValue([
        {
          id: '1',
          title: 'Song 1',
          requestedBy: 'Vin',
          duration: 300,
          status: SongRequestStatus.QUEUED
        },
        {
          id: '2',
          title: 'Song 2',
          requestedBy: 'Kelsier',
          duration: 300,
          status: SongRequestStatus.QUEUED
        }
      ])
    };

    (mockStreamFactory.createStream as any).mockResolvedValue({
      getSongQueue: vi.fn().mockReturnValue(mockSongQueue)
    } as unknown as Stream);

    const songQueue = await getQueueRequestHandler.execute(
      new GetQueueRequest(mockStreamDate)
    );

    expect(songQueue).toBeDefined();
    expect(songQueue.getSongs().length).toEqual(2);
    expect(songQueue.getSongs()[0].title).toEqual('Song 1');
    expect(songQueue.getSongs()[1].title).toEqual('Song 2');
  });

  it('should throw an error if the stream does not exist', async () => {
    (mockStreamFactory.createStream as any).mockRejectedValue(
      new Error('Stream not found')
    );

    await expect(
      getQueueRequestHandler.execute(new GetQueueRequest('2023-10-01'))
    ).rejects.toThrow('Stream not found');
  });
});

