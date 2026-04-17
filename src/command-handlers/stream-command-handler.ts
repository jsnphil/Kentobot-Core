import { Command } from '@commands/command';
import { StreamFactory } from '@domains/stream/factories/stream-factory';
import { Song } from '@domains/stream/models/song';
import { StreamRepository } from '@domains/stream/stream-repository';
import { SongRequestStatus } from '../types/song-request';
import { Logger } from '@aws-lambda-powertools/logger';

export class StreamCommandHandler {
  private logger = new Logger({
    serviceName: 'stream-command-handler'
  });

  public async execute(command: Command): Promise<string | void> {}

  private async handleAddSongToHistoryCommand(): Promise<void> {
    // TODO Implement this method
  }
}