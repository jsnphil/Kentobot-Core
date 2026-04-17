import { Logger } from '@aws-lambda-powertools/logger';
import { APIGatewayEvent } from 'aws-lambda';
import { KentobotErrorCode } from '../types/types';
import { Code } from 'better-status-codes';
import { BumpSongCommandHandler } from '@command-handlers/bump-song-command-handler';
import { BumpSongCommand } from '@commands/bump-song-command';
import { DynamoDBStreamRepository } from '@repositories/stream-repository';
import { StreamFactory } from '@domains/stream/factories/stream-factory';

const logger = new Logger({ serviceName: 'bump-song-lambda' });
const streamRepository = new DynamoDBStreamRepository();
const streamFactory = new StreamFactory(streamRepository);

export const handler = async (event: APIGatewayEvent) => {
  const body = JSON.parse(event.body || '{}');
  const { user, position, bumpType, modOverride } = body;

  if (!user) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'User is required'
      })
    };
  }

  // Your logic here
  // For example, bump the song in the playlist
  try {
    const commandHandler = new BumpSongCommandHandler(streamFactory, streamRepository);
    const command = new BumpSongCommand(bumpType, user, position, modOverride);

    await commandHandler.execute(command);

    return {
      statusCode: Code.OK,
      body: JSON.stringify({})
    };
  } catch (error) {
    logger.error(`Error processing request: ${error}`);
    return {
      statusCode: Code.INTERNAL_SERVER_ERROR,
      body: JSON.stringify({
        error: {
          code: KentobotErrorCode.SystemError,
          message: 'An error occurred while removing the song from the queue'
        }
      })
    };
  }
};
