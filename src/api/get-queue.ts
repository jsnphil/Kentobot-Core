import { Logger } from '@aws-lambda-powertools/logger';
import { APIGatewayEvent } from 'aws-lambda';
import { GetQueueRequestHandler } from '@query-handlers/get-queue-query-handler';
import { GetQueueRequest } from '@queries/get-queue-request';
import { Code } from 'better-status-codes';
import { DynamoDBStreamRepository } from '@repositories/stream-repository';
import { StreamFactory } from '@domains/stream/factories/stream-factory';

const logger = new Logger({ serviceName: 'get-queue-lambda' });

export const handler = async (event: APIGatewayEvent) => {
  // TODO Later, get date from the parameters

  try {
    const streamRepository = new DynamoDBStreamRepository();
    const streamFactory = new StreamFactory(streamRepository);
    const queryHandler = new GetQueueRequestHandler(streamFactory);
    const queue = await queryHandler.execute(new GetQueueRequest('stream'));

    return {
      statusCode: Code.OK,
      body: JSON.stringify(queue)
    };
  } catch (error) {
    // TODO Update these errors
    logger.error(`Error processing request: ${error}`);
    return {
      statusCode: Code.INTERNAL_SERVER_ERROR,
      body: JSON.stringify({
        error: {
          message: 'An error occurred while getting the queue'
        }
      })
    };
  }
};
