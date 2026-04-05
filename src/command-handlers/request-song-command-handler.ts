import { RequestSongCommand } from '@commands/request-song-command';

import { Song } from '@domains/stream/models/song';
import { generateStreamDate } from '@utils/utilities';
import { StreamRepository } from '@repositories/stream-repository';
import { Stream } from '@domains/stream/models/stream';
import { EventOutboxRepository } from '@repositories/event-outbox-repository';

export class RequestSongCommandHandler {
  constructor() {}

  public async execute(command: RequestSongCommand): Promise<Song> {
    const { requestedBy, songId } = command;

    // Look up the stream. Use current date for now, but in the future, the UI and bot should be able to specify which stream to load
    const streamDate = generateStreamDate();
    const streamData = await StreamRepository.loadStream(streamDate);

    if (!streamData) {
      throw new Error('Stream not found');
    }

    // Hydrate the stream domain object from the raw data returned by the repository
    const stream = Stream.load(streamData);

    // Create the song domain object and add it to the stream's queue
    // This will also create a SongAddedToQueueEvent
    const song = await Song.create(songId, requestedBy);
    await stream.addSongToQueue(song);

    // Persist the updated stream state back to the repository
    await StreamRepository.saveStream(stream);

    // TODO Need to either invoke a WSS broadcast, or use an event to notify connected clients that the stream's queue has been updated

    const domainEvents = stream.getDomainEvents();

    await EventOutboxRepository.saveEvents(domainEvents);
    // Here you would typically publish these domain events to an event bus or message broker
    // so that other parts of the system (e.g., WebSocket server) can react to the changes
    // For example:
    // domainEvents.forEach(event => EventBus.publish(event));
    stream.clearDomainEvents();

    // Return the newly created song so the caller can respond with it
    return song;
  }
}
