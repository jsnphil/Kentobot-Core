import { KentobotDomainEvent } from '@core/domain-event';

export type UserEnteredInShuffleEventPayload = {
  username: string;
};

// TODO Finish and move to shuffle domain
export type UserEnteredInShuffleEvent =
  KentobotDomainEvent<UserEnteredInShuffleEventPayload> & {
    type: 'user-entered-in-shuffle';
    payload: UserEnteredInShuffleEventPayload;
    source: 'shuffle';
    version: 1;
  };
