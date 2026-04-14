import { Stream } from './stream';
import { Song } from './song';
import { BumpType, SongRequestStatus } from '../../../types/song-request';
import {
  EventBridgeClient,
  PutEventsCommand
} from '@aws-sdk/client-eventbridge';
import { mockClient } from 'aws-sdk-client-mock';
import { vi, describe, expect, it, beforeEach } from 'vitest';

const mockEventBridgeClient = mockClient(EventBridgeClient);

// TODO Add tests for event publishing when songs are added, removed, moved, or bumped
describe('Stream', () => {
  beforeEach(() => {
    mockEventBridgeClient.on(PutEventsCommand).resolves({});
  });

  it('should create a new Stream instance', () => {
    const streamDate = '2023-10-01';
    const stream = Stream.create(streamDate);

    expect(stream).toBeInstanceOf(Stream);
    expect(stream.getStreamDate()).toBe(streamDate);
    expect(stream.getSongQueue().getSongs()).toEqual([]);
  });

  it('should load a Stream instance from data', () => {
    const data: any = {
      streamDate: '2023-10-01',
      songQueue: {
        songs: [
          {
            id: '1',
            requestedBy: 'user1',
            title: 'Song 1',
            status: SongRequestStatus.QUEUED,
            duration: 300
          },
          {
            id: '2',
            requestedBy: 'user2',
            title: 'Song 2',
            status: SongRequestStatus.QUEUED,
            duration: 200
          }
        ]
      },
      shuffleEntries: ['Vin', 'Kelsier'],
      songHistory: [
        {
          id: '3',
          requestedBy: 'Sazed',
          title: 'Song 3',
          status: SongRequestStatus.PLAYED,
          duration: 180
        },
        {
          id: '4',
          requestedBy: 'Elend',
          title: 'Song 4',
          status: SongRequestStatus.PLAYED,
          duration: 220
        }
      ]
    };

    const stream = Stream.load(data);

    expect(stream).toBeInstanceOf(Stream);
    expect(stream.getStreamDate()).toBe(data.streamDate);
    expect(stream.getSongQueue().getSongs().length).toBe(2);
    expect(stream.getSongHistory().length).toBe(2);
    expect(stream.getSongHistory()[0].id).toBe('3');
  });

  describe('moveSong', () => {
    let stream: Stream;

    beforeEach(async () => {
      const streamDate = '2023-10-01';
      stream = Stream.create(streamDate);

      const songs = [
        Song.load('1', 'Vin', 'Song 1', SongRequestStatus.QUEUED, 300),
        Song.load('2', 'Kelsier', 'Song 2', SongRequestStatus.QUEUED, 250),
        Song.load('3', 'Sazed', 'Song 3', SongRequestStatus.QUEUED, 200),
        Song.load('4', 'Elend', 'Song 4', SongRequestStatus.QUEUED, 180),
        Song.load('5', 'Marsh', 'Song 5', SongRequestStatus.QUEUED, 220)
      ];

      for (const song of songs) {
        await stream.addSongToQueue(song);
      }
    });

    it('should move a song to a new position in the queue', () => {
      stream.moveSong('2', 5);

      const songQueue = stream.getSongQueue();
      console.log(songQueue);

      expect(songQueue.getSongs()[0].id).toBe('1');
      expect(songQueue.getSongs()[1].id).toBe('3');
      expect(songQueue.getSongs()[2].id).toBe('4');
      expect(songQueue.getSongs()[3].id).toBe('5');
      expect(songQueue.getSongs()[4].id).toBe('2');
    });

    it('should throw an error if the queue is empty', () => {
      const stream = Stream.create('2023-10-01');
      const songQueue = stream.getSongQueue();

      expect(songQueue.getSongs().length).toBe(0);
      expect(() => stream.moveSong('1', 2)).toThrow('Queue is empty');
    });

    it('should throw an error if the song is not in the queue', () => {
      expect(() => stream.moveSong('6', 2)).toThrow(
        'Request not found in queue'
      );
    });
  });

  describe('bumpSongForUser', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should bump a song for a user with bean bump', async () => {
      const streamDate = '2023-10-01';
      const stream = Stream.create(streamDate);

      vi.spyOn(stream['bumpService'], 'isUserEligible').mockResolvedValue(true);

      const songs = [
        Song.load('1', 'Vin', 'Song 1', SongRequestStatus.QUEUED, 300),
        Song.load('2', 'Kelsier', 'Song 2', SongRequestStatus.QUEUED, 250),
        Song.load('3', 'Sazed', 'Song 3', SongRequestStatus.QUEUED, 200),
        Song.load('4', 'Elend', 'Song 4', SongRequestStatus.QUEUED, 180),
        Song.load('5', 'Marsh', 'Song 5', SongRequestStatus.QUEUED, 220)
      ];

      for (const song of songs) {
        await stream.addSongToQueue(song);
      }

      await stream.bumpSongForUser('Sazed', BumpType.Bean);

      const songQueue = stream.getSongQueue();
      console.log(songQueue);

      expect(songQueue.getSongs()[0].id).toBe('3');
      expect(songQueue.getSongs()[0].status).toBe(SongRequestStatus.BUMPED);
      expect(stream.getAvailableBeanBumps()).toBe(2);
    });

    it('should throw an error if no bean bumps are available', async () => {
      const streamDate = '2023-10-01';
      const stream = Stream.create(streamDate);

      stream['beanBumpsAvailable'] = 0;

      await expect(
        stream.bumpSongForUser('user1', BumpType.Bean)
      ).rejects.toThrow('No bumps available for type [bean]');
    });

    it('should throw an error if user is not eligible for a free bump', async () => {
      const streamDate = '2023-10-01';
      const stream = Stream.create(streamDate);

      vi.spyOn(stream['bumpService'], 'isUserEligible').mockResolvedValue(
        false
      );

      await expect(
        stream.bumpSongForUser('user1', BumpType.Bean, undefined, false)
      ).rejects.toThrow('User is not eligible for a free bump');
    });

    it('should bump a song for a user with channel points', async () => {
      const streamDate = '2023-10-01';
      const stream = Stream.create(streamDate);

      vi.spyOn(stream['bumpService'], 'isUserEligible').mockResolvedValue(true);

      const songs = [
        Song.load('1', 'Vin', 'Song 1', SongRequestStatus.QUEUED, 300),
        Song.load('2', 'Kelsier', 'Song 2', SongRequestStatus.QUEUED, 250),
        Song.load('3', 'Sazed', 'Song 3', SongRequestStatus.QUEUED, 200),
        Song.load('4', 'Elend', 'Song 4', SongRequestStatus.QUEUED, 180),
        Song.load('5', 'Marsh', 'Song 5', SongRequestStatus.QUEUED, 220)
      ];

      for (const song of songs) {
        await stream.addSongToQueue(song);
      }

      await stream.bumpSongForUser('Sazed', BumpType.ChannelPoints);

      const songQueue = stream.getSongQueue();
      console.log(songQueue);

      expect(songQueue.getSongs()[0].id).toBe('3');
      expect(songQueue.getSongs()[0].status).toBe(SongRequestStatus.BUMPED);
      expect(stream.getAvailableChannelPointBumps()).toBe(2);
    });

    it('should throw an error if no channel point bumps are available', async () => {
      const streamDate = '2023-10-01';
      const stream = Stream.create(streamDate);

      stream['channelPointBumpsAvailable'] = 0;

      await expect(
        stream.bumpSongForUser('user1', BumpType.ChannelPoints)
      ).rejects.toThrow('No bumps available for type [channelPoints]');
    });
  });

  describe('removeSongFromQueue', () => {
    it('should remove a song from the queue', async () => {
      const streamDate = '2023-10-01';
      const stream = Stream.create(streamDate);

      const songs = [
        Song.load('1', 'Vin', 'Song 1', SongRequestStatus.QUEUED, 300),
        Song.load('2', 'Kelsier', 'Song 2', SongRequestStatus.QUEUED, 250),
        Song.load('3', 'Sazed', 'Song 3', SongRequestStatus.QUEUED, 200),
        Song.load('4', 'Elend', 'Song 4', SongRequestStatus.QUEUED, 180),
        Song.load('5', 'Marsh', 'Song 5', SongRequestStatus.QUEUED, 220)
      ];

      for (const song of songs) {
        await stream.addSongToQueue(song);
      }

      stream.removeSongFromQueue('3');

      const songQueue = stream.getSongQueue();
      console.log(songQueue);

      expect(songQueue.getSongs().length).toBe(4);
      expect(songQueue.getSongs()[0].id).toBe('1');
      expect(songQueue.getSongs()[1].id).toBe('2');
      expect(songQueue.getSongs()[2].id).toBe('4');
      expect(songQueue.getSongs()[3].id).toBe('5');
    });

    it('should throw an error if the queue is empty', () => {
      const stream = Stream.create('2023-10-01');
      const songQueue = stream.getSongQueue();

      expect(songQueue.getSongs().length).toBe(0);
      expect(() => stream.removeSongFromQueue('1')).toThrow('Queue is empty');
    });
  });

  describe('savePlayedSong', () => {
    it('should save a played song to the song history', () => {
      const streamDate = '2023-10-01';
      const stream = Stream.create(streamDate);

      const song = Song.load(
        '1',
        'Vin',
        'Song 1',
        SongRequestStatus.PLAYED,
        300
      );

      stream.savePlayedSong(song);

      const songHistory = stream.getSongHistory();
      expect(songHistory.length).toBe(1);
      expect(songHistory[0].id).toBe('1');
      expect(songHistory[0].title).toBe('Song 1');
      expect(songHistory[0].status).toBe(SongRequestStatus.PLAYED);
    });

    it('should not modify the song history if no song is saved', () => {
      const streamDate = '2023-10-01';
      const stream = Stream.create(streamDate);

      const songHistory = stream.getSongHistory();
      expect(songHistory.length).toBe(0);
    });
  });

  describe('bumpShuffleWinner', () => {
    it('should bump the shuffle winner', async () => {
      const streamDate = '2023-10-01';
      const stream = Stream.create(streamDate);

      const songs = [
        Song.load('1', 'Vin', 'Song 1', SongRequestStatus.QUEUED, 300),
        Song.load('2', 'Kelsier', 'Song 2', SongRequestStatus.QUEUED, 250),
        Song.load('3', 'Sazed', 'Song 3', SongRequestStatus.QUEUED, 200),
        Song.load('4', 'Elend', 'Song 4', SongRequestStatus.QUEUED, 180),
        Song.load('5', 'Marsh', 'Song 5', SongRequestStatus.QUEUED, 220)
      ];

      for (const song of songs) {
        await stream.addSongToQueue(song);
      }

      stream.bumpShuffleWinner('Elend');

      const songQueue = stream.getSongQueue();
      console.log(songQueue);

      expect(songQueue.getSongs()[0].id).toBe('4');
      expect(songQueue.getSongs()[0].status).toBe(
        SongRequestStatus.SHUFFLE_WINNER
      );
    });

    it('should throw an error if the song is not in the queue', () => {
      const streamDate = '2023-10-01';
      const stream = Stream.create(streamDate);

      const songs = [
        Song.load('1', 'Vin', 'Song 1', SongRequestStatus.QUEUED, 300),
        Song.load('2', 'Kelsier', 'Song 2', SongRequestStatus.QUEUED, 250),
        Song.load('3', 'Sazed', 'Song 3', SongRequestStatus.QUEUED, 200),
        Song.load('4', 'Elend', 'Song 4', SongRequestStatus.QUEUED, 180),
        Song.load('5', 'Marsh', 'Song 5', SongRequestStatus.QUEUED, 220)
      ];

      for (const song of songs) {
        stream.addSongToQueue(song);
      }

      expect(() => stream.bumpShuffleWinner('NonExistentSong')).toThrow(
        'No song found for user: NonExistentSong'
      );
    });
  });
});
