import { Logger } from '@aws-lambda-powertools/logger';
import { WebSocketService } from '@services/web-socket-service';
import { StreamRepository } from '@repositories/stream-repository';
import { Stream } from '@domains/stream/models/stream';
import { generateStreamDate } from '@utils/utilities';
import { StreamEvent } from '../../../types/event-types';

const webSocketService = new WebSocketService();
const logger = new Logger({ serviceName: 'add-song-to-queue-event-handler' });

export const handler = async (event: any): Promise<void> => {
  logger.debug(`Received event: ${event}`);

  const detailType = event['detail-type'];

  let wssMessage;
  if (detailType === StreamEvent.SONG_ADDED_TO_QUEUE) {
    const streamDate = generateStreamDate();
    const streamData = await StreamRepository.loadStream(streamDate);

    if (!streamData) {
      logger.warn('Stream not found when broadcasting queue update');
      return;
    }

    const stream = Stream.load(streamData);
    const songs = stream.getSongQueue().getSongs();

    wssMessage = {
      event: StreamEvent.SONG_ADDED_TO_QUEUE,
      data: {
        songQueue: songs.map((song) => ({
          songId: song.id,
          title: song.title,
          requestedBy: song.requestedBy,
          duration: song.duration,
          status: song.status
        }))
      }
    };
  }

  if (detailType === StreamEvent.SONG_REMOVED_FROM_QUEUE) {
    const { songId } = event.detail;

    wssMessage = {
      event: StreamEvent.SONG_REMOVED_FROM_QUEUE, // TODO Make this an enum
      data: {
        songId
      }
    };
  }

  if (
    detailType === StreamEvent.SONG_MOVED ||
    detailType === StreamEvent.SONG_BUMPED
  ) {
    const { songId, position } = event.detail;
    wssMessage = {
      event: detailType,
      data: {
        songId,
        position
      }
    };
  }

  await webSocketService.broadcast(JSON.stringify(wssMessage));
};
