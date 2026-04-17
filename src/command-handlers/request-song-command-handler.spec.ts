import { RequestSongCommandHandler } from './request-song-command-handler';
import { RequestSongCommand } from '@commands/request-song-command';
import { StreamRepository } from '@domains/stream/stream-repository';
import { Song } from '@domains/stream/models/song';
import { Stream } from '@domains/stream/models/stream';
import { generateStreamDate } from '@utils/utilities';
import { vi, describe, beforeEach, it, expect } from 'vitest';

import { EventOutboxRepository } from '@repositories/event-outbox-repository';

vi.mock('@domains/stream/models/song');
vi.mock('@domains/stream/models/stream');
vi.mock('@utils/utilities');
vi.mock('@repositories/event-outbox-repository');

describe('RequestSongCommandHandler', () => {
  let handler: RequestSongCommandHandler;
  let mockStreamRepository: StreamRepository;

  beforeEach(() => {
    mockStreamRepository = {
      loadStream: vi.fn(),
      saveStream: vi.fn()
    };
    handler = new RequestSongCommandHandler(mockStreamRepository);
  });

  it('should throw an error if the stream is not found', async () => {
    (generateStreamDate as any).mockReturnValue('2023-01-01');
    (mockStreamRepository.loadStream as any).mockResolvedValue(null);

    const command = new RequestSongCommand('Syl', 'song123');

    await expect(handler.execute(command)).rejects.toThrow('Stream not found');
  });

  it('should add a song to the stream queue and save the stream', async () => {
    const mockStreamData = { id: 'stream123' };
    const mockStream = {
      addSongToQueue: vi.fn(),
      getDomainEvents: vi.fn().mockReturnValue([]),
      clearDomainEvents: vi.fn()
    };
    const mockSong = { id: 'song123', requestedBy: 'user123' };

    (generateStreamDate as any).mockReturnValue('2023-01-01');
    (mockStreamRepository.loadStream as any).mockResolvedValue(mockStreamData);
    (Stream.load as any).mockReturnValue(mockStream);
    (Song.create as any).mockResolvedValue(mockSong);

    const command = new RequestSongCommand('song123', 'Dalinar');

    const result = await handler.execute(command);

    expect(mockStreamRepository.loadStream).toHaveBeenCalledTimes(1);
    expect(mockStreamRepository.loadStream).toHaveBeenCalledWith('2023-01-01');
    expect(Stream.load).toHaveBeenCalledWith(mockStreamData);
    expect(Song.create).toHaveBeenCalledWith('Dalinar', 'song123');
    expect(mockStream.addSongToQueue).toHaveBeenCalledWith(mockSong);
    expect(mockStreamRepository.saveStream).toHaveBeenCalledWith(mockStream);
    expect(EventOutboxRepository.saveEvents).toHaveBeenCalledWith([]);
    expect(result).toBe(mockSong);
  });
});
