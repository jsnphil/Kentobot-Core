import {
  DynamoDB,
  GetItemCommand,
  PutItemCommand
} from '@aws-sdk/client-dynamodb';
import { Stream } from '@domains/stream/models/stream';
import { StreamRepository } from '@domains/stream/stream-repository';

import { Logger } from '@aws-lambda-powertools/logger';
import { unmarshall } from '@aws-sdk/util-dynamodb';

export class DynamoDBStreamRepository implements StreamRepository {
  private readonly ddbClient = new DynamoDB({
    region: process.env.AWS_REGION
  });

  private readonly TABLE_NAME = process.env.STREAM_DATA_TABLE!;

  private readonly logger = new Logger({ serviceName: 'stream-repository' });

  public async loadStream(streamDate: string): Promise<Stream | null> {
    this.logger.info(`Loading stream for date: ${streamDate}`);
    const command = new GetItemCommand({
      TableName: this.TABLE_NAME,
      Key: {
        pk: { S: 'stream' },
        sk: { S: `streamDate#${streamDate}` }
      }
    });

    const { Item } = await this.ddbClient.send(command);

    this.logger.info(`Item: ${JSON.stringify(Item)}`);

    if (!Item) {
      return null;
    }

    const unmarshalledItem = unmarshall(Item);

    return {
      ...unmarshalledItem,
      songQueue: JSON.parse(unmarshalledItem.songQueue),
      songHistory: JSON.parse(unmarshalledItem.songHistory)
    } as unknown as Stream;
  }

  public async saveStream(stream: Stream): Promise<void> {
    try {
      const command = new PutItemCommand({
        TableName: this.TABLE_NAME,
        Item: {
          pk: { S: 'stream' },
          sk: { S: `streamDate#${stream.getStreamDate()}` },
          streamId: { S: 'stream' },
          streamDate: {
            S: stream.getStreamDate()
          },
          songQueue: {
            S: JSON.stringify(stream.getSongQueue())
          },
          songHistory: {
            S: JSON.stringify(stream.getSongHistory())
          },
          beanBumpsAvailable: {
            N: stream.getAvailableBeanBumps().toString()
          },
          channelPointBumpsAvailable: {
            N: stream.getAvailableChannelPointBumps().toString()
          }
        }
      });

      await this.ddbClient.send(command);
    } catch (err) {
      this.logger.error((err as Error).message);
      throw new Error('Error saving stream');
    }
  }
}
