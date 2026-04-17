import { StreamFactory } from '@domains/stream/factories/stream-factory';
import { GetQueueRequest } from '@queries/get-queue-request';
import { StreamRepository } from '@domains/stream/stream-repository';

export class GetQueueRequestHandler {
  constructor(private readonly streamFactory: StreamFactory) {}

  public async execute(query: GetQueueRequest) {
    const stream = await this.streamFactory.createStream();

    if (!stream) throw new Error('Stream not found');

    return stream.getSongQueue();
  }
}
