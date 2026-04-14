import { Logger } from '@aws-lambda-powertools/logger';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import {
  EventBridgeClient,
  PutEventsCommand
} from '@aws-sdk/client-eventbridge';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { DynamoDBStreamEvent, DynamoDBStreamHandler } from 'aws-lambda';

const logger = new Logger({ serviceName: 'event-publisher' });

const eventBridgeClient = new EventBridgeClient({
  region: process.env.AWS_REGION
});

export const handler: DynamoDBStreamHandler = async (
  event: DynamoDBStreamEvent
) => {
  logger.logEventIfEnabled(event);

  for (const record of event.Records) {
    if (record.eventName !== 'INSERT') {
      continue;
    }

    const image = record.dynamodb?.NewImage;

    if (!image) {
      continue;
    }

    const outboxItem = unmarshall(image as Record<string, AttributeValue>);

    logger.debug(`Publishing event: ${outboxItem.type}`);

    await eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: outboxItem.source,
            DetailType: outboxItem.type,
            Detail: outboxItem.payload,
            EventBusName: process.env.EVENT_BUS_NAME
          }
        ]
      })
    );

    logger.debug(`Published event: ${outboxItem.type}`);
  }
};
