import { Logger } from '@aws-lambda-powertools/logger';
import { BumpSongCommandHandler } from '@command-handlers/bump-song-command-handler';
import { BumpSongCommand } from '@commands/bump-song-command';
import { ChannelRaidedEvent } from '@domains/twitch/events/channel-raided-event';
import { BumpType } from '../../types/song-request';
import { DynamoDBStreamRepository } from '@repositories/stream-repository';
import { StreamFactory } from '@domains/stream/factories/stream-factory';

const logger = new Logger();

export const handler = async (event: ChannelRaidedEvent): Promise<void> => {
  logger.logEventIfEnabled(event);

  const { raiderUsername } = event.payload;

  const streamRepository = new DynamoDBStreamRepository();
  const streamFactory = new StreamFactory(streamRepository);
  const commandHandler = new BumpSongCommandHandler(streamFactory, streamRepository);
  const command = new BumpSongCommand(BumpType.Raid, raiderUsername);
  await commandHandler.execute(command);
};
