import { generateStreamDate } from '@utils/utilities';
import { Stream } from '../models/stream';
import { StreamRepository } from '../stream-repository';

export class StreamFactory {
  constructor(private readonly streamRepository: StreamRepository) {}

  // TODO Need to split this between create and load?
  public async createStream(): Promise<Stream> {
    const streamDate = generateStreamDate();
    const streamData = await this.streamRepository.loadStream(streamDate);

    if (!streamData) {
      throw new Error('Stream not found');
    }

    return Stream.load(streamData);
  }
}

