import { BumpSongCommandHandler } from './bump-song-command-handler';
import { BumpSongCommand } from '@commands/bump-song-command';
import { StreamFactory } from '@domains/stream/factories/stream-factory';
import { StreamRepository } from '@domains/stream/stream-repository';
import { BumpType } from '../types/song-request';
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest';

describe('BumpSongCommandHandler', () => {
  let handler: BumpSongCommandHandler;
  let mockStreamFactory: StreamFactory;
  let mockStreamRepository: StreamRepository;

  beforeEach(() => {
    mockStreamRepository = {
      loadStream: vi.fn(),
      saveStream: vi.fn()
    };
    mockStreamFactory = { createStream: vi.fn() } as unknown as StreamFactory;
    handler = new BumpSongCommandHandler(mockStreamFactory, mockStreamRepository);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should bump a song successfully', async () => {
    const mockStream = {
      bumpSongForUser: vi.fn().mockResolvedValue(undefined)
    };
    (mockStreamFactory.createStream as any).mockResolvedValue(mockStream);

    const command: BumpSongCommand = {
      requestedBy: 'Kaladin',
      bumpType: BumpType.Bean,
      position: 1,
      modOverride: false
    };

    await handler.execute(command);

    expect(mockStreamFactory.createStream).toHaveBeenCalled();
    expect(mockStream.bumpSongForUser).toHaveBeenCalledWith(
      command.requestedBy,
      command.bumpType,
      command.position,
      command.modOverride
    );
    expect(mockStreamRepository.saveStream).toHaveBeenCalledWith(mockStream);
  });

  it('should throw an error if StreamFactory fails', async () => {
    (mockStreamFactory.createStream as any).mockRejectedValue(
      new Error('Stream creation failed')
    );

    const command: BumpSongCommand = {
      requestedBy: 'Kaladin',
      bumpType: BumpType.Bean,
      position: 1,
      modOverride: false
    };

    await expect(handler.execute(command)).rejects.toThrow(
      'Stream creation failed'
    );
    expect(mockStreamFactory.createStream).toHaveBeenCalled();
    expect(mockStreamRepository.saveStream).not.toHaveBeenCalled();
  });

  it('should throw an error if bumpSongForUser fails', async () => {
    const mockStream = {
      bumpSongForUser: vi.fn().mockRejectedValue(new Error('Bump song failed'))
    };
    (mockStreamFactory.createStream as any).mockResolvedValue(mockStream);

    const command: BumpSongCommand = {
      requestedBy: 'Kaladin',
      bumpType: BumpType.Bean,
      position: 1,
      modOverride: false
    };

    await expect(handler.execute(command)).rejects.toThrow('Bump song failed');
    expect(mockStream.bumpSongForUser).toHaveBeenCalledWith(
      command.requestedBy,
      command.bumpType,
      command.position,
      command.modOverride
    );
    expect(mockStreamRepository.saveStream).not.toHaveBeenCalled();
  });

  it('should throw an error if StreamRepository.saveStream fails', async () => {
    const mockStream = {
      bumpSongForUser: vi.fn().mockResolvedValue(undefined)
    };
    (mockStreamFactory.createStream as any).mockResolvedValue(mockStream);
    (mockStreamRepository.saveStream as any).mockRejectedValue(
      new Error('Save stream failed')
    );

    const command: BumpSongCommand = {
      requestedBy: 'Kaladin',
      bumpType: BumpType.Bean,
      position: 1,
      modOverride: false
    };

    await expect(handler.execute(command)).rejects.toThrow(
      'Save stream failed'
    );
    expect(mockStream.bumpSongForUser).toHaveBeenCalledWith(
      command.requestedBy,
      command.bumpType,
      command.position,
      command.modOverride
    );
    expect(mockStreamRepository.saveStream).toHaveBeenCalledWith(mockStream);
  });
});

