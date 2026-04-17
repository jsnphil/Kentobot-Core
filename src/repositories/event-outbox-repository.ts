import { DynamoDB, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { KentobotDomainEvent } from '@core/domain-event';

export class EventOutboxRepository {
  private static ddbClient = new DynamoDB({
    region: process.env.AWS_REGION
  });

  private static readonly TABLE_NAME = process.env.EVENTS_OUTBOX_TABLE!;

  private static logger = new Logger({
    serviceName: 'event-outbox-repository'
  });

  public static async saveEvents(
    events: KentobotDomainEvent<unknown>[]
  ): Promise<void> {
    for (const event of events) {
      const command = new PutItemCommand({
        TableName: this.TABLE_NAME,
        Item: {
          pk: { S: 'event' },
          sk: { S: `${event.type}#${event.occurredAt}#${crypto.randomUUID()}` },
          type: { S: event.type },
          source: { S: event.source },
          occurredAt: { S: event.occurredAt },
          version: { N: event.version.toString() },
          payload: { S: JSON.stringify(event.payload) }
        }
      });

      try {
        await this.ddbClient.send(command);
        this.logger.debug(`Saved event to outbox: ${event.type}`);
      } catch (err) {
        this.logger.error((err as Error).message);
        throw new Error(`Error saving event to outbox: ${event.type}`);
      }
    }
  }
}
