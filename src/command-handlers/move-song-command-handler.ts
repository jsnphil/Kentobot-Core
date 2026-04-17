import { generateStreamDate } from '@utils/utilities';
import { StreamRepository } from '@domains/stream/stream-repository';
import { Stream } from '@domains/stream/models/stream';
import { MoveSongCommand } from '@commands/move-song-command';

export class MoveSongCommandHandler {
  constructor(private readonly streamRepository: StreamRepository) {}

  public async execute(command: MoveSongCommand) {
    // Here you would typically interact with your song repository to remove the song
    // For this example, we'll just return the songId to simulate the removal

    const streamDate = generateStreamDate();
    const streamData = await this.streamRepository.loadStream(streamDate);

    if (!streamData) {
      throw new Error('Stream not found');
    }

    const stream = Stream.load(streamData);

    stream.moveSong(command.songId, command.position);
    await this.streamRepository.saveStream(stream);
  }
}
