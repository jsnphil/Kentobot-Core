import { SavePlayedSongCommandHandler } from './save-played-song-command-handler';
import { SavePlayedSongCommand } from '@commands/save-played-song-command';
import { StreamFactory } from '@domains/stream/factories/stream-factory';
import { StreamRepository } from '@domains/stream/stream-repository';
import { Song } from '@domains/stream/models/song';
import { SongRequestStatus } from '../types/song-request';
import { vi, describe, beforeEach, it, expect } from 'vitest';

vi.mock('@domains/stream/models/song');

describe('SavePlayedSongCommandHandler', () => {
  let commandHandler: SavePlayedSongCommandHandler;
  let mockStreamFactory: StreamFactory;
  let mockStreamRepository: StreamRepository;

  beforeEach(() => {
    mockStreamRepository = {
      loadStream: vi.fn(),
      saveStream: vi.fn()
    };
    mockStreamFactory = { createStream: vi.fn() } as unknown as StreamFactory;
    commandHandler = new SavePlayedSongCommandHandler(mockStreamFactory, mockStreamRepository);
    vi.clearAllMocks();
  });

  it('should save a played song successfully', async () => {
    const mockStream = {
      savePlayedSong: vi.fn()
    };
    const mockCommand = new SavePlayedSongCommand(
      'songId123',
      'Song title',
      'Kaladin',
      300
    );

    (mockStreamFactory.createStream as any).mockResolvedValue(mockStream);
    (Song.load as any).mockReturnValue({
      id: 'songId123',
      requestedBy: 'Kaladin',
      title: 'Song title',
      status: SongRequestStatus.PLAYED,
      duration: 300
    });

    await commandHandler.execute(mockCommand);

    expect(mockStream.savePlayedSong).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'songId123',
        requestedBy: 'Kaladin',
        title: 'Song title',
        status: SongRequestStatus.PLAYED,
        duration: 300
      })
    );
    expect(mockStreamRepository.saveStream).toHaveBeenCalledWith(mockStream);
  });

  it('should throw an error if StreamFactory fails', async () => {
    const mockCommand = new SavePlayedSongCommand(
      'songId123',
      'user123',
      'Test Song',
      300
    );

    (mockStreamFactory.createStream as any).mockRejectedValue(
      new Error('Stream creation failed')
    );

    await expect(commandHandler.execute(mockCommand)).rejects.toThrow(
      'Stream creation failed'
    );

    expect(mockStreamFactory.createStream).toHaveBeenCalled();
    expect(Song.load).not.toHaveBeenCalled();
    expect(mockStreamRepository.saveStream).not.toHaveBeenCalled();
  });

  it('should throw an error if saving the stream fails', async () => {
    const mockStream = {
      savePlayedSong: vi.fn()
    };
    const mockCommand = new SavePlayedSongCommand(
      'songId123',
      'Song title',
      'Shallan',
      300
    );

    (mockStreamFactory.createStream as any).mockResolvedValue(mockStream);
    (Song.load as any).mockReturnValue({
      id: 'songId123',
      requestedBy: 'Shallan',
      title: 'Song title',
      status: SongRequestStatus.PLAYED,
      duration: 300
    });
    (mockStreamRepository.saveStream as any).mockRejectedValue(
      new Error('Failed to save stream')
    );

    await expect(commandHandler.execute(mockCommand)).rejects.toThrow(
      'Failed to save stream'
    );

    expect(mockStreamFactory.createStream).toHaveBeenCalled();
    expect(Song.load).toHaveBeenCalledWith(
      'songId123',
      'Shallan',
      'Song title',
      SongRequestStatus.PLAYED,
      300
    );
    expect(mockStream.savePlayedSong).toHaveBeenCalled();
    expect(mockStreamRepository.saveStream).toHaveBeenCalledWith(mockStream);
  });
});

