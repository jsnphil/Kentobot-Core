import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RemoveSongCommand } from '@commands/remove-song-command';
import { RemoveSongCommandHandler } from '@command-handlers/remove-song-command-handler';
import { Code } from 'better-status-codes';
import { KentobotErrorCode } from '../types/types';
import { DynamoDBStreamRepository } from '@repositories/stream-repository';

const streamRepository = new DynamoDBStreamRepository();

export const handler = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // TODO Improve this
    const body = JSON.parse(event.body || '{}');

    const songId = event.pathParameters?.songId;

    if (!songId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'songId is required'
        })
      };
    }

    const commandHandler = new RemoveSongCommandHandler(streamRepository);
    const command = new RemoveSongCommand(songId);

    await commandHandler.execute(command);

    return {
      statusCode: Code.OK,
      body: JSON.stringify({
        message: 'Song removed from queue successfully',
        songId
      })
    };
  } catch (error) {
    console.error('Error processing request:', error);
    if ((error as Error).message === 'Stream not found') {
      return {
        statusCode: Code.FORBIDDEN,
        body: JSON.stringify({
          error: {
            code: KentobotErrorCode.StreamNotFound,
            message: 'Stream not found'
          }
        })
      };
    } else if ((error as Error).message === 'Song not found in the queue') {
      return {
        statusCode: Code.BAD_REQUEST,
        body: JSON.stringify({
          error: {
            code: KentobotErrorCode.SongNotFound,
            message: 'Could not find song in the queue'
          }
        })
      };
    } else {
      console.error('Error processing request:', error);
      // TODO How to differentiate error codes
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
  }
};
