import { BumpSongCommand } from '@commands/bump-song-command';
import { StreamFactory } from '@domains/stream/factories/stream-factory';
import { StreamRepository } from '@domains/stream/stream-repository';

export class BumpSongCommandHandler {
  constructor(
    private readonly streamFactory: StreamFactory,
    private readonly streamRepository: StreamRepository
  ) {}

  public async execute(command: BumpSongCommand): Promise<void> {
    // Here you would typically interact with your song repository to bump the song
    // For this example, we'll just return the songId to simulate the bump

    const stream = await this.streamFactory.createStream();

    await stream.bumpSongForUser(
      command.requestedBy,
      command.bumpType,
      command.position,
      command.modOverride
    );

    console.log(
      `Bumped song at position ${command.position} for user ${command.requestedBy} with bump type ${command.bumpType} and mod override ${command.modOverride}`
    );

    await this.streamRepository.saveStream(stream);

    // return { songId: command.songId };
  }
}
