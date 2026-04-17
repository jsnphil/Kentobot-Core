import { APIGatewayEvent } from 'aws-lambda';
import { MoveSongCommandHandler } from '@command-handlers/move-song-command-handler';
import { MoveSongCommand } from '@commands/move-song-command';
import { Code } from 'better-status-codes';
import { apiLambdaWrapper } from '../infrastructure/lambda/api-lambda-wrapper';
import { DynamoDBStreamRepository } from '@repositories/stream-repository';

const streamRepository = new DynamoDBStreamRepository();

export const handler = async (event: APIGatewayEvent) => {
  const songId = event.pathParameters?.songId;

  const body = JSON.parse(event.body || '{}');
  const { position } = body;

  if (!songId || !position) {
    // TODO Throw this instead
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'songId and position are required'
      })
    };
  }

  const commandHandler = new MoveSongCommandHandler(streamRepository);
  const command = new MoveSongCommand(songId, position);

  await commandHandler.execute(command);

  return {
    statusCode: Code.OK,
    body: JSON.stringify({})
  };
};
