import { AggregateRoot } from '@core/aggregate-root';
import { ShuffleEntry } from './shuffle-entry';

type User = string;
type StreamId = string;

export class Shuffle extends AggregateRoot {
  private readonly streamId: StreamId;
  private openedAt: Date;
  private durationMs: number = 60000;

  private entries: ShuffleEntry[] = [];
  // private previousWinners: User[] = [];
  private open = false;

  private winnerCooldowns: Map<string, number> = new Map();

  constructor(streamId: StreamId, openedAt: Date) {
    super();
    this.streamId = streamId;
    this.openedAt = openedAt;
    // this.previousWinners = previousWinners;
    this.winnerCooldowns = new Map<string, number>();
  }

  static create(streamId: StreamId, openedAt: Date): Shuffle {
    return new Shuffle(streamId, openedAt);
  }

  static load(
    streamId: StreamId,
    openedAt: Date,
    entries: ShuffleEntry[],
    isOpen: boolean,
    winnerCooldowns: Map<string, number>
  ) {
    const shuffle = new Shuffle(streamId, openedAt);
    shuffle.entries = entries;
    shuffle.open = isOpen;
    shuffle.winnerCooldowns = winnerCooldowns;
    return shuffle;
  }

  start(): void {
    if (this.isOpen) {
      throw new Error('Shuffle is already open.');
    }

    this.open = true;
    this.openedAt = new Date();
  }

  get isOpen(): boolean {
    return this.open && Date.now() < this.openedAt.getTime() + this.durationMs;
  }

  join(user: User, songId: string): void {
    if (!this.isOpen) {
      throw new Error('Shuffle is not open.');
    }

    if (this.winnerCooldowns.has(user)) {
      throw new Error('User is on cooldown.');
    }

    console.log(`Entries: ${JSON.stringify(this.entries)}`);
    const existingEntry = this.entries.find(
      (entry) => entry.getUser() === user
    );

    if (existingEntry) {
      throw new Error('User already entered.');
    }

    this.entries.push(new ShuffleEntry(user, songId));
  }

  close(): void {
    this.open = false;
  }

  selectWinner(): ShuffleEntry | null {
    if (this.isOpen) {
      this.close();
    }

    if (this.entries.length === 0) {
      return null;
    }

    const winner =
      this.entries[Math.floor(Math.random() * this.entries.length)];

    this.updateCooldowns();
    this.winnerCooldowns.set(winner.getUser(), 2);

    this.entries = [];

    return winner;
  }

  getEntries() {
    return this.entries;
  }

  getCountdownRemaining(): number {
    const remaining = this.openedAt.getTime() + this.durationMs - Date.now();
    return Math.max(0, remaining);
  }

  /* istanbul ignore next */
  getStreamId(): StreamId {
    return this.streamId;
  }

  /* istanbul ignore next */
  getOpenedAt(): Date {
    return this.openedAt;
  }

  private updateCooldowns(): void {
    this.winnerCooldowns.forEach((winner, user) => {
      if (winner <= 1) {
        this.winnerCooldowns.delete(user);
      } else {
        this.winnerCooldowns.set(user, winner - 1);
      }
    });
  }

  getCooldowns(): Map<string, number> {
    return this.winnerCooldowns;
  }
}
