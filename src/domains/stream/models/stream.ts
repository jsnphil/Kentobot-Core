// import { EventPublisher } from '../../../common/event-publisher';
// import { StreamEvent } from '../../../types/event-types';
import { Song } from './song';
import { SongQueue } from './song-queue';
// import { SongMovedInQueueEvent } from '../events/song-moved-in-queue-event';
// import { SongRemovedFromQueue } from '../events/song-removed-from-queue-event';
import { BumpType, SongRequestStatus } from '../../../types/song-request';
// import { SongBumpedEvent } from '../events/song-bumped-event';
// import { SongAddedToQueueEvent } from '../events/song-added-to-queue-event';
// import { SongPlayedEvent } from '../events/song-played-event';
import { BumpService } from '@services/bump-service';
import { SongAddedToQueueEvent } from '../events/song-added-to-queue-event';
import { SongRemovedFromQueueEvent } from '../events/song-removed-from-queue-event';
import { SongMovedInQueueEvent } from '../events/song-moved-in-queue-event';
import { SongBumpedEvent } from '../events/song-bumped-event';
import { SongPlayedEvent } from '../events/song-played-event';

export class Stream {
  private streamDate: string;
  private songQueue: SongQueue;
  private beanBumpsAvailable: number;
  private channelPointBumpsAvailable: number;
  private songHistory: Song[]; // List of songs that have been played in the stream
  private domainEvents: (
    | SongAddedToQueueEvent
    | SongRemovedFromQueueEvent
    | SongMovedInQueueEvent
    | SongBumpedEvent
    | SongPlayedEvent
  )[];

  private bumpService;

  private constructor(streamDate: string, songQueue: SongQueue) {
    this.streamDate = streamDate;
    this.songQueue = songQueue;
    this.beanBumpsAvailable = 3;
    this.channelPointBumpsAvailable = 3;
    this.bumpService = new BumpService();
    this.songHistory = [];
    this.domainEvents = [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static load(data: any): Stream {
    const songs: Song[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.songQueue.songs.forEach((songAttrs: any) => {
      const song = Song.load(
        songAttrs.id,
        songAttrs.requestedBy,
        songAttrs.title,
        songAttrs.status,
        songAttrs.duration
      );

      songs.push(song);
    });

    const songQueue = new SongQueue(songs);

    const stream = new Stream(data.streamDate, songQueue);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.songHistory.forEach((playedSongs: any) => {
      const song = Song.load(
        playedSongs.id,
        playedSongs.requestedBy,
        playedSongs.title,
        playedSongs.status,
        playedSongs.duration
      );

      stream.songHistory.push(song);
    });

    return stream;
  }

  public static create(streamDate: string): Stream {
    const songQueue = new SongQueue();
    return new Stream(streamDate, songQueue);
  }

  public async addSongToQueue(song: Song) {
    this.songQueue.addSong(song);

    const event: SongAddedToQueueEvent = {
      type: 'song-added-to-queue',
      source: 'kentobot.streaming.system',
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: {
        songId: song.id,
        requestedBy: song.requestedBy,
        title: song.title,
        duration: song.duration
      }
    };

    this.addDomainEvent(event);
  }

  public removeSongFromQueue(songId: string) {
    this.songQueue.removeSong(songId);

    const event: SongRemovedFromQueueEvent = {
      type: 'song-removed-from-queue',
      source: 'kentobot.streaming.system',
      occurredAt: new Date().toISOString(),
      payload: {
        songId
      },
      version: 1
    };

    this.addDomainEvent(event);
  }

  public moveSong(songId: string, newPosition: number) {
    this.songQueue.moveSong(songId, newPosition - 1);

    const event: SongMovedInQueueEvent = {
      type: 'song-moved-in-queue',
      source: 'kentobot.streaming.system',
      occurredAt: new Date().toISOString(),
      payload: {
        songId,
        newPosition
      },
      version: 1
    };
    this.addDomainEvent(event);
  }

  public async bumpSongForUser(
    user: string,
    bumpType: BumpType,
    position?: number,
    modOverride?: boolean
  ) {
    if (!this.bumpAvailable(bumpType)) {
      throw new Error(`No bumps available for type [${bumpType}]`);
    }

    const isUserEligible = await this.bumpService.isUserEligible(
      user,
      bumpType
    );

    // TODO need to check list of bumps from the stream to see if the user has already used their bump when redeeming a paid bump

    if (!isUserEligible && !modOverride) {
      throw new Error('User is not eligible for a free bump');
    }

    const { songId, bumpPosition } = this.songQueue.bumpUserRequest(
      user,
      bumpType,
      position
    );

    this.decrementBumpCount(bumpType);

    // TODO Add a bump type to the payload
    const event: SongBumpedEvent = {
      source: 'kentobot.streaming.system',
      occurredAt: new Date().toISOString(),
      type: 'song-bumped-in-queue',
      payload: {
        songId,
        bumpPosition,
        bumpType
      },
      version: 1
    };

    this.addDomainEvent(event);
  }

  bumpAvailable(bumpType: BumpType) {
    if (bumpType === BumpType.Bean) {
      return this.beanBumpsAvailable > 0;
    } else if (bumpType === BumpType.ChannelPoints) {
      return this.channelPointBumpsAvailable > 0;
    }

    // This should never happen in reality
    /* istanbul ignore next */
    throw new Error('Invalid bump type');
  }

  decrementBumpCount(bumpType: BumpType) {
    if (bumpType === BumpType.Bean) {
      this.beanBumpsAvailable--;
    } else if (bumpType === BumpType.ChannelPoints) {
      this.channelPointBumpsAvailable--;
    }
  }

  public getSongQueue(): SongQueue {
    return this.songQueue;
  }

  public getStreamDate(): string {
    return this.streamDate;
  }

  public getAvailableBeanBumps(): number {
    return this.beanBumpsAvailable;
  }

  public getAvailableChannelPointBumps(): number {
    return this.channelPointBumpsAvailable;
  }

  public getSongHistory(): Song[] {
    return this.songHistory;
  }

  public savePlayedSong(song: Song) {
    this.songHistory.push(song);

    const event: SongPlayedEvent = {
      payload: {
        songId: song.id,
        requestedBy: song.requestedBy,
        title: song.title,
        duration: song.duration,
        playedAt: new Date().toISOString()
      },
      source: 'kentobot.streaming.system',
      type: 'song-played',
      occurredAt: new Date().toISOString(),
      version: 1
    };

    this.addDomainEvent(event);
  }

  public bumpShuffleWinner(shuffleWinner: string) {
    const song = this.songQueue.getSongRequestByUser(shuffleWinner);
    if (!song) {
      throw new Error(`No song found for user: ${shuffleWinner}`);
    }

    song.status = SongRequestStatus.SHUFFLE_WINNER;

    this.songQueue.moveSong(song.id, 0);

    const event: SongBumpedEvent = {
      source: 'kentobot.streaming.system',
      occurredAt: new Date().toISOString(),
      type: 'song-bumped-in-queue',
      payload: {
        songId: song.id,
        bumpPosition: 0,
        bumpType: BumpType.ShuffleWinner
      },
      version: 1
    };
    this.addDomainEvent(event);
  }

  public getDomainEvents(): ReadonlyArray<
    | SongAddedToQueueEvent
    | SongRemovedFromQueueEvent
    | SongMovedInQueueEvent
    | SongBumpedEvent
    | SongPlayedEvent
  > {
    return [...this.domainEvents];
  }

  public clearDomainEvents(): void {
    this.domainEvents = [];
  }

  private addDomainEvent(
    event:
      | SongAddedToQueueEvent
      | SongRemovedFromQueueEvent
      | SongMovedInQueueEvent
      | SongBumpedEvent
      | SongPlayedEvent
  ): void {
    this.domainEvents.push(event);
  }
}
