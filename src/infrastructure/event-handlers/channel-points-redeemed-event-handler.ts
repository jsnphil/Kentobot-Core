import { Logger } from '@aws-lambda-powertools/logger';
import { BumpSongCommandHandler } from '@command-handlers/bump-song-command-handler';
import { BumpSongCommand } from '@commands/bump-song-command';
import { BumpType } from '../../types/song-request';
import { UserRedeemedChannelRewardEvent } from '@domains/twitch/events/user-redeemed-channel-reward';
import { DynamoDBStreamRepository } from '@repositories/stream-repository';
import { StreamFactory } from '@domains/stream/factories/stream-factory';

const logger = new Logger();

export const handler = async (
  event: UserRedeemedChannelRewardEvent
): Promise<void> => {
  logger.logEventIfEnabled(event);

  const { rewardId, username } = event.payload;

  if (rewardId !== 'song-bump') {
    // TODO Update this to the real ID
    logger.debug('Non song bump channel point reward redeemed, skipping...');
    return;
  }

  const streamRepository = new DynamoDBStreamRepository();
  const streamFactory = new StreamFactory(streamRepository);
  const commandHandler = new BumpSongCommandHandler(streamFactory, streamRepository);
  const command = new BumpSongCommand(BumpType.ChannelPoints, username);
  await commandHandler.execute(command);
};
