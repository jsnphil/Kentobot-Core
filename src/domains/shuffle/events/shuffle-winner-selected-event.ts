import { KentobotDomainEvent } from '../../../core/domain-event';
import { ShuffleWinnerSelectedPayload } from './event-payload';

export type ShuffleWinnerSelectedEvent =
  KentobotDomainEvent<ShuffleWinnerSelectedPayload> & {
    type: 'shuffle-winner-selected';
    payload: ShuffleWinnerSelectedPayload;
    version: 1;
  };
