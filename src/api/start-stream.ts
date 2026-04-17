import { generateStreamDate } from '@utils/utilities';
import { StartStreamCommand } from '@commands/start-stream-command';
import { StartStreamCommandHandler } from '@command-handlers/start-stream-command-handler';
import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Code } from 'better-status-codes';
import { KentobotErrorCode } from '../types/types';
import { DynamoDBStreamRepository } from '@repositories/stream-repository';

const streamRepository = new DynamoDBStreamRepository();

export const handler = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  const commandHandler = new StartStreamCommandHandler(streamRepository);

  try {
    const streamDate = generateStreamDate();
    const command = new StartStreamCommand(streamDate);
    await commandHandler.execute(command);

    return {
      statusCode: Code.Created,
      body: ''
    };
  } catch (error) {
    if ((error as Error).message === 'Stream already exists') {
      return {
        statusCode: Code.Conflict,
        body: JSON.stringify({
          error: {
            code: KentobotErrorCode.StreamAlreadyExists,
            message: 'Stream already exists'
          }
        })
      };
    } else {
      return {
        statusCode: Code.INTERNAL_SERVER_ERROR,
        body: JSON.stringify({
          error: {
            code: KentobotErrorCode.SystemError,
            message: 'An error occurred while starting the stream'
          }
        })
      };
    }
  }
};
