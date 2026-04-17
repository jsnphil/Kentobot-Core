# DDD Findings & Mitigation Guide — Kentobot-Core

> **Purpose:** Track all Domain-Driven Design (DDD) gaps identified in the Kentobot-Core codebase and the concrete tasks needed to resolve each one.  
> **How to use:** Check off each task as you complete it. Group headings map to GitHub issue numbers where applicable.

---

## Table of Contents

- [[#Finding 1 — Duplicate / Incomplete DomainEvent Base Type]]
- [[#Finding 2 — Domain Events Are Created But Never Dispatched]]
- [[#Finding 3 — Outbox Pattern Not Implemented]]
- [[#Finding 4 — Aggregates Do Not Collect Domain Events Internally]]
- [[#Finding 5 — Stream Aggregate Owns Logic That Belongs to Sub-Domains]]
- [[#Finding 6 — Song.create() Performs I/O Inside the Entity]]
- [[#Finding 7 — BumpService Is Instantiated Inside the Aggregate]]
- [[#Finding 8 — StreamFactory Does Not Distinguish Create vs Load]]
- [[#Finding 9 — Command Handlers Bypass the Factory]]
- [[#Finding 10 — No Value Objects for Primitive Fields]]
- [[#Finding 11 — Direct Property Mutation on Entities]]
- [[#Finding 12 — Error Handling via String Matching]]
- [[#Finding 13 — Shuffle Domain Is Disconnected from the Stream Domain]]
- [[#Finding 14 — `any` Types in Aggregate Load Methods]]
- [[#Finding 15 — Twitch Event Handling Lacks a Dedicated Stack / Bounded Context]]

---

## Finding 1 — Duplicate / Incomplete DomainEvent Base Type

### Description
Two conflicting base types exist for domain events:

| File | Fields |
|------|--------|
| `src/core/events/domain-event.ts` | `type`, `occurredAt`, `source`, `version`, `payload` |
| `src/domains/domain-event.ts` | `occurredAt`, `payload` only (incomplete) |

The second definition is a subset of the first and will cause silent type mismatches as the codebase grows.

### Tasks
- [ ] Delete `src/domains/domain-event.ts`
- [ ] Update all imports to use the canonical `src/core/events/domain-event.ts` definition
- [ ] Verify all existing event types (`SongAddedToQueueEvent`, `SongBumpedEvent`, etc.) extend `KentobotDomainEvent<TPayload>` from the canonical file

---

## Finding 2 — Domain Events Are Created But Never Dispatched

### Description
Inside `Stream`, every mutating method creates a local domain event variable but immediately discards it. A `TODO` comment acknowledges this on every occurrence:

```ts
// TODO Move this to the queue subdomain and pickup with an event dispatcher
const event: SongAddedToQueueEvent = { … };  // never stored or published
```

Affected methods: `addSongToQueue`, `removeSongFromQueue`, `moveSong`, `bumpSongForUser`, `savePlayedSong`, `bumpShuffleWinner`.

### Tasks
- [ ] Implement an internal domain event collection on the `Stream` aggregate (see Finding 4)
- [ ] Remove the dangling local `event` variables once collection is in place
- [ ] Wire aggregate-collected events to the Outbox/dispatcher after the aggregate is saved (see Finding 3)

---

## Finding 3 — Outbox Pattern Not Implemented

**Related issues:** #225, #331, #332, #333, #334, #335, #336, #343

### Description
Domain events must be persisted in an *outbox table* in the same DynamoDB write as the aggregate to avoid a two-phase-commit problem. Currently events are never saved, meaning any event-driven downstream (WebSocket broadcasts, analytics, etc.) may miss state changes.

### Outbox Table Schema (from Issue #331)

| Field | Type | Notes |
|-------|------|-------|
| `eventId` | String (PK) | UUID |
| `aggregateId` | String | e.g., `streamDate` |
| `eventType` | String | e.g., `song-added-to-queue` |
| `payload` | Map | Full event payload |
| `occurredAt` | String | ISO 8601 timestamp |
| `published` | Boolean | Whether published to event bus |
| `publishedAt` | String (optional) | ISO 8601 timestamp |
| `retryCount` | Number (optional) | Publish attempt count |
| `errorMessage` | String (optional) | Last publish error |

### Tasks

#### Design (Issue #331)
- [ ] Finalize and document the DynamoDB outbox table schema
- [ ] Add the outbox table to `lib/stacks/data-stack.ts`

#### Aggregate Updates (Issue #333)
- [ ] Add `private domainEvents: DomainEvent[]` collection to `Stream`
- [ ] Add `private domainEvents: DomainEvent[]` collection to `Shuffle`
- [ ] Expose `getDomainEvents(): DomainEvent[]` and `clearDomainEvents()` on each aggregate

#### Outbox Repository (Issue #334)
- [ ] Create `src/repositories/outbox-repository.ts`
- [ ] Implement `saveEvents(events: DomainEvent[], aggregateId: string): Promise<void>`
- [ ] Implement `getUnpublishedEvents(): Promise<OutboxEvent[]>`
- [ ] Implement `markAsPublished(eventId: string): Promise<void>`

#### Application Service / Command Handler Updates (Issue #335)
- [ ] After `StreamRepository.saveStream(stream)`, extract and save domain events to outbox in each command handler
- [ ] Ensure outbox write is in the same transaction (DynamoDB TransactWriteItems) as the aggregate save

#### Outbox Publisher / Dispatcher (Issue #336)
- [ ] Create a Lambda that polls the outbox for unpublished events
- [ ] Publish each event to EventBridge
- [ ] Mark events as published after successful delivery
- [ ] Add retry logic and increment `retryCount` on failure

#### Dead-Letter Queue (Issue #343)
- [ ] Attach a DLQ to the outbox publisher Lambda
- [ ] Configure CloudWatch alarm on DLQ depth

---

## Finding 4 — Aggregates Do Not Collect Domain Events Internally

**Related issue:** #333

### Description
DDD aggregates should accumulate domain events as state changes occur so the application layer can extract and persist them atomically. Neither `Stream` nor `Shuffle` holds an internal event list.

### Tasks
- [ ] Add `private readonly domainEvents: KentobotDomainEvent<unknown>[] = []` to `Stream`
- [ ] Add a `protected addDomainEvent(event)` helper to a `AggregateRoot` base class
- [ ] Have each mutating method in `Stream` call `this.addDomainEvent(event)` instead of creating a discarded local variable
- [ ] Add `getDomainEvents()` and `clearDomainEvents()` methods
- [ ] Apply the same pattern to `Shuffle`

---

## Finding 5 — Stream Aggregate Owns Logic That Belongs to Sub-Domains

### Description
`Stream` directly calls `SongQueue` methods and constructs `SongQueue`-scoped events (e.g., `SongAddedToQueueEvent` with `source: 'song-queue'`). The `TODO` comments in the code indicate this was known at authoring time. This couples two bounded contexts unnecessarily.

### Tasks
- [ ] Evaluate whether `SongQueue` should be promoted to its own aggregate root (separate from `Stream`)
- [ ] If yes: move `addSongToQueue`, `removeSongFromQueue`, `moveSong`, `bumpSongForUser` onto `SongQueue` and have `Stream` delegate
- [ ] Move `SongQueue`-scoped event creation into `SongQueue` methods
- [ ] Update `StreamRepository` to persist/restore `SongQueue` independently if it becomes its own aggregate

---

## Finding 6 — Song.create() Performs I/O Inside the Entity

### Description
`Song.create()` calls `YouTubeService.getVideo(id)` — a network I/O operation — inside a static factory on the entity itself. DDD entities must be pure; infrastructure concerns belong in domain services or application services.

```ts
// Current — problematic
public static async create(id: string, requestedBy: string): Promise<Song> {
  const youtubeVideo = await YouTubeService.getVideo(id);  // I/O inside entity
  SongValidator.validate(youtubeVideo);
  return new Song(…);
}
```

### Tasks
- [ ] Remove the `YouTubeService` call from `Song.create()`
- [ ] Change `Song.create()` to accept pre-fetched video metadata: `Song.create(videoMetadata: YouTubeVideoResult, requestedBy: string): Song`
- [ ] Move the YouTube lookup + validation into `RequestSongCommandHandler.execute()` (or a `SongRequestDomainService`)
- [ ] Update tests to pass metadata directly to `Song.create()`

---

## Finding 7 — BumpService Is Instantiated Inside the Aggregate

### Description
`Stream`'s constructor instantiates `BumpService` directly:

```ts
this.bumpService = new BumpService();
```

This creates a hidden dependency on an infrastructure service inside a domain aggregate, making the aggregate harder to test and violating the dependency-inversion principle.

### Tasks
- [ ] Inject `BumpService` (or a `IBumpService` interface) via the constructor of `Stream`
- [ ] Update `StreamFactory` / command handlers to provide the dependency
- [ ] Update tests to pass a mock/stub `BumpService`

---

## Finding 8 — StreamFactory Does Not Distinguish Create vs Load

### Description
`StreamFactory.createStream()` only *loads* an existing stream from DynamoDB. A `TODO` comment acknowledges it should be split:

```ts
// TODO Need to split this between create and load?
public static async createStream(): Promise<Stream> { … }
```

The actual creation logic lives in `StartStreamCommandHandler`, bypassing the factory entirely.

### Tasks
- [ ] Rename `StreamFactory.createStream()` → `StreamFactory.loadStream(streamDate: string): Promise<Stream>`
- [ ] Add `StreamFactory.createStream(streamDate: string): Stream` for creating a brand-new stream without DB I/O
- [ ] Update `StartStreamCommandHandler` to use `StreamFactory.createStream()`
- [ ] Update all other command handlers (`RequestSongCommandHandler`, etc.) to use `StreamFactory.loadStream()`

---

## Finding 9 — Command Handlers Bypass the Factory

### Description
Every command handler (e.g., `RequestSongCommandHandler`, `BumpSongCommandHandler`) calls `StreamRepository.loadStream()` directly and then `Stream.load()` manually — duplicating the same loading logic. The `StreamFactory` exists but is unused by command handlers.

### Tasks
- [ ] Once Finding 8 is resolved, update each command handler to call `StreamFactory.loadStream(streamDate)` instead of duplicating repository + aggregate construction
- [ ] Affected handlers: `RequestSongCommandHandler`, `BumpSongCommandHandler`, `RemoveSongCommandHandler`, `MoveSongCommandHandler`, `SavePlayedSongCommandHandler`, `ShuffleCommandHandler`

---

## Finding 10 — No Value Objects for Primitive Fields

### Description
Core domain identifiers and domain concepts are plain `string` / `number` primitives, making it easy to pass arguments in the wrong order and preventing domain-specific validation at the type level.

Examples:
- `streamDate: string` — should be a `StreamDate` value object
- `requestedBy: string` — should be a `UserId` value object  
- `songId: string` — should be a `SongId` value object
- `duration: number` (seconds) — should be a `SongDuration` value object with built-in max-duration rule

### Tasks
- [ ] Create `src/domains/stream/value-objects/StreamDate.ts`
- [ ] Create `src/domains/stream/value-objects/SongId.ts`
- [ ] Create `src/domains/shared/value-objects/UserId.ts`
- [ ] Create `src/domains/stream/value-objects/SongDuration.ts` (encapsulate the 360-second rule from `SongValidator`)
- [ ] Replace raw primitives in `Song`, `SongQueue`, and `Stream` with the new value objects
- [ ] Update factories, repositories, and tests

---

## Finding 11 — Direct Property Mutation on Entities

### Description
`Song.status` is declared `public` and mutated directly in multiple places outside the entity:

```ts
// In Stream.bumpShuffleWinner()
song.status = SongRequestStatus.SHUFFLE_WINNER;

// In SongQueue.enterShuffle()
songRequest.status = SongRequestStatus.SHUFFLE_ENTERED;
```

Domain state should only change through explicit methods that can enforce invariants and raise events.

### Tasks
- [ ] Change `Song.status` to `private` (or `readonly` where appropriate)
- [ ] Add explicit state-transition methods: `song.markAsBumped()`, `song.enterShuffle()`, `song.markAsShuffleWinner()`, `song.markAsPlayed()`
- [ ] Each method should validate the transition is legal and raise a domain event
- [ ] Update all callers

---

## Finding 12 — Error Handling via String Matching

**Related issue:** #223

### Description
API handlers detect domain errors by comparing raw error message strings:

```ts
if ((error as Error).message === 'Stream not found') { … }
if ((error as Error).message === 'Song already exists in the queue') { … }
```

This is fragile — any typo in the error message or refactor silently breaks error handling.

### Tasks
- [ ] Create custom exception classes: `StreamNotFoundException`, `SongAlreadyInQueueException`, `UserRequestLimitException`, `SongNotFoundException`, `BumpNotAvailableException`, `UserNotEligibleForBumpException`
- [ ] Throw custom exceptions in domain / command handler code
- [ ] Replace string-comparison `catch` branches in API handlers with `instanceof` checks
- [ ] Review HTTP status codes returned for each error (Issue #223)

---

## Finding 13 — Shuffle Domain Is Disconnected from the Stream Domain

**Related issue:** #324

### Description
- `Shuffle` raises events (`ShuffleWinnerSelected`, `UserEnteredInShuffle`) but they are incomplete type aliases that don't conform to the `KentobotDomainEvent` structure.
- The `Stream` aggregate's `bumpShuffleWinner()` method directly manipulates the song queue instead of reacting to a `ShuffleWinnerSelected` domain event published by the `Shuffle` aggregate.
- There is no event handler that bridges a shuffle winner to the stream's song queue.

### Tasks
- [ ] Complete `ShuffleWinnerSelectedEvent` and `UserEnteredInShuffleEvent` to conform to `KentobotDomainEvent<TPayload>`
- [ ] Have `Shuffle.selectWinner()` collect a `ShuffleWinnerSelectedEvent` internally
- [ ] Create a `ShuffleWinnerEventHandler` in the Stream domain that calls `stream.bumpShuffleWinner(winner)` in response
- [ ] Wire the handler to the EventBridge / event dispatcher (Issue #324)
- [ ] Update `stream-event-handler.ts` to handle `shuffle-winner-selected` events from EventBridge

---

## Finding 14 — `any` Types in Aggregate Load Methods

### Description
`Stream.load()` uses `any` for the incoming data and for iteration:

```ts
public static load(data: any): Stream { … }
data.songQueue.songs.forEach((songAttrs: any) => { … });
data.songHistory.forEach((playedSongs: any) => { … });
```

This bypasses TypeScript's type safety and can hide schema drift between DynamoDB and domain models.

### Tasks
- [ ] Define a `StreamSnapshot` interface (or use a Zod/io-ts schema) that describes the raw DynamoDB shape
- [ ] Replace `data: any` in `Stream.load()` with `data: StreamSnapshot`
- [ ] Define `SongSnapshot` for the song sub-objects
- [ ] Add validation/parsing in `StreamRepository.loadStream()` before passing data to `Stream.load()`

---

## Finding 15 — Twitch Event Handling Lacks a Dedicated Stack / Bounded Context

**Related issues:** #312, #317, #319, #323

### Description
Twitch events are defined as domain events (`stream-online-event.ts`, `user-cheered-event.ts`, etc.) but there is no dedicated stack, command handlers, or event handlers that consume them. The `stream-event-handler.ts` Lambda only handles song-queue events.

### Tasks

#### Bounded Context
- [ ] Create `src/domains/twitch/` command handlers for each Twitch event type
- [ ] Define explicit mappings: Twitch event → system command (Issue #312)

#### Individual Event Handlers (per Issue #317, #319, #316)
- [ ] `stream.online` → trigger stream start-up processes (Issue #317)
- [ ] `channel.cheer` → update user's bit counts (Issue #319)
- [ ] `user.authorization.grant` → end and save stream (Issue #316)

#### Infrastructure (Issue #323)
- [ ] Refactor Twitch event handling into its own CDK stack (`TwitchEventStack`)
- [ ] Update `event-subscription-stack.ts` to route Twitch events to the new stack

---

## Summary Checklist

### High Priority (Correctness / Data Loss Risk)
- [ ] Implement Outbox Pattern end-to-end (Finding 3)
- [ ] Add internal domain event collection to aggregates (Finding 4)
- [ ] Dispatch domain events after aggregate saves (Finding 2)
- [ ] Fix two-phase-commit risk in command handlers (Finding 3 — DynamoDB TransactWriteItems)

### Medium Priority (Domain Model Integrity)
- [ ] Remove I/O from `Song.create()` (Finding 6)
- [ ] Add custom exception types and fix error handling (Finding 12)
- [ ] Replace direct `Song.status` mutation with transition methods (Finding 11)
- [ ] Inject `BumpService` instead of constructing it inside `Stream` (Finding 7)
- [ ] Fix duplicate `DomainEvent` base type (Finding 1)

### Low Priority / Refactoring
- [ ] Promote `SongQueue` to its own aggregate root (Finding 5)
- [ ] Add Value Objects for primitives (Finding 10)
- [ ] Fix `StreamFactory` create vs load split (Finding 8)
- [ ] Consolidate factory usage in command handlers (Finding 9)
- [ ] Replace `any` types in `Stream.load()` (Finding 14)
- [ ] Connect Shuffle domain events to Stream via event handler (Finding 13)
- [ ] Extract Twitch handling into its own bounded context and stack (Finding 15)

---

*Last updated: 2026-04-17*
