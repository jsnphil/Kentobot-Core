import { StreamFactory } from './stream-factory';
import { StreamRepository } from '@domains/stream/stream-repository';
import { Stream } from '../models/stream';
import { generateStreamDate } from '@utils/utilities';
import { vi, describe, expect, it, Mock } from 'vitest';

vi.mock('../models/stream');
vi.mock('@utils/utilities');

describe('StreamFactory', () => {
  describe('createStream', () => {
    it('should create a stream successfully', async () => {
      const mockStreamDate = '2023-10-01';
      const mockStreamData = { id: 1, name: 'Test Stream' };
      const mockStream = { id: 1, name: 'Test Stream' };

      const mockRepository: StreamRepository = {
        loadStream: vi.fn().mockResolvedValue(mockStreamData),
        saveStream: vi.fn()
      };

      (generateStreamDate as Mock).mockReturnValue(mockStreamDate);
      (Stream.load as Mock).mockReturnValue(mockStream);

      const factory = new StreamFactory(mockRepository);
      const result = await factory.createStream();

      expect(generateStreamDate).toHaveBeenCalled();
      expect(mockRepository.loadStream).toHaveBeenCalledWith(mockStreamDate);
      expect(Stream.load).toHaveBeenCalledWith(mockStreamData);
      expect(result).toEqual(mockStream);
    });

    it('should throw an error if stream data is not found', async () => {
      const mockStreamDate = '2023-10-01';

      const mockRepository: StreamRepository = {
        loadStream: vi.fn().mockResolvedValue(null),
        saveStream: vi.fn()
      };

      (generateStreamDate as Mock).mockReturnValue(mockStreamDate);
      (Stream.load as Mock).mockClear();

      const factory = new StreamFactory(mockRepository);
      await expect(factory.createStream()).rejects.toThrow('Stream not found');

      expect(generateStreamDate).toHaveBeenCalled();
      expect(mockRepository.loadStream).toHaveBeenCalledWith(mockStreamDate);
      expect(Stream.load).not.toHaveBeenCalled();
    });
  });
});

