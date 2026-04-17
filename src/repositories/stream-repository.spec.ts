import { DynamoDBStreamRepository } from './stream-repository';
import { Stream } from '../domains/stream/models/stream';
import { Logger } from '@aws-lambda-powertools/logger';
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand
} from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { vi, describe, beforeEach, it, expect } from 'vitest';

vi.mock('@aws-lambda-powertools/logger');

const mockDynamoDB = mockClient(DynamoDBClient);

describe('DynamoDBStreamRepository', () => {
  const mockLogger = Logger as any;
  let repository: DynamoDBStreamRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_REGION = 'us-east-1';
    process.env.STREAM_DATA_TABLE = 'StreamDataTable';
    repository = new DynamoDBStreamRepository();
  });

  describe('loadStream', () => {
    it('should return undefined if stream not found', async () => {
      mockDynamoDB.on(GetItemCommand).resolves({
        Item: undefined
      });

      const result = await repository.loadStream('2023-01-01');
      expect(result).toBeNull();
    });
  });

  describe('saveStream', () => {
    it('should throw an error if there is an error saving the stream', async () => {
      mockDynamoDB.on(PutItemCommand).rejects(new Error('Some error'));

      const mockStream = {
        getStreamDate: vi.fn().mockReturnValue('2023-01-01')
      };

      await expect(
        repository.saveStream(mockStream as unknown as Stream)
      ).rejects.toThrow('Error saving stream');
    });
  });
});
