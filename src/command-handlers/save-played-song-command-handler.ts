import { SongRequestStatus } from '../types/song-request';
import { SavePlayedSongCommand } from '@commands/save-played-song-command';
import { StreamFactory } from '@domains/stream/factories/stream-factory';
import { Song } from '@domains/stream/models/song';
import { StreamRepository } from '@domains/stream/stream-repository';

export class SavePlayedSongCommandHandler {
  constructor(
    private readonly streamFactory: StreamFactory,
    private readonly streamRepository: StreamRepository
  ) {}

  public async execute(command: SavePlayedSongCommand): Promise<void> {
    // Here you would typically interact with your song repository to save the played song
    // For this example, we'll just return the songId to simulate the save
    const stream = await this.streamFactory.createStream();

    const song = Song.load(
      command.songId,
      command.requestedBy,
      command.songTitle,
      SongRequestStatus.PLAYED,
      command.duration
    );

    stream.savePlayedSong(song);

    await this.streamRepository.saveStream(stream);
  }
}
