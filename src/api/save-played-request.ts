import { APIGatewayEvent } from 'aws-lambda';
import { SavePlayedSongCommandHandler } from '@command-handlers/save-played-song-command-handler';
import { SavePlayedSongCommand } from '@commands/save-played-song-command';
import { DynamoDBStreamRepository } from '@repositories/stream-repository';
import { StreamFactory } from '@domains/stream/factories/stream-factory';

const streamRepository = new DynamoDBStreamRepository();
const streamFactory = new StreamFactory(streamRepository);

export const handler = async (event: APIGatewayEvent) => {
  // Parse the event to get the song details
  // TODO Type check this with zod
  const body = JSON.parse(event.body || '{}');

  const { songId, title, requestedBy, duration } = body;

  if (!songId || !title || !requestedBy || !duration) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Missing required fields'
      })
    };
  }

  // Simulate saving the played song
  const savePlayedSongCommand = new SavePlayedSongCommand(
    songId,
    title,
    requestedBy,
    duration
  );

  const commandHandler = new SavePlayedSongCommandHandler(streamFactory, streamRepository);
  await commandHandler.execute(savePlayedSongCommand);

  return {
    statusCode: 201,
    body: ''
  };
};
