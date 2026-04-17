import { generateStreamDate } from '@utils/utilities';
import { StreamRepository } from '@domains/stream/stream-repository';
import { Stream } from '@domains/stream/models/stream';

export class RemoveSongCommandHandler {
  constructor(private readonly streamRepository: StreamRepository) {}

  public async execute(command: {
    songId: string;
  }): Promise<{ songId: string }> {
    // Here you would typically interact with your song repository to remove the song
    // For this example, we'll just return the songId to simulate the removal

    const streamDate = generateStreamDate();
    const streamData = await this.streamRepository.loadStream(streamDate);

    if (!streamData) {
      throw new Error('Stream not found');
    }

    const stream = Stream.load(streamData);

    await stream.removeSongFromQueue(command.songId);
    await this.streamRepository.saveStream(stream);

    return { songId: command.songId };
  }
}
