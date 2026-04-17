import { KentobotDomainEvent } from './domain-event';

export abstract class AggregateRoot {
  private readonly _events: KentobotDomainEvent<unknown>[] = [];

  protected addDomainEvent(event: KentobotDomainEvent<unknown>): void {
    this._events.push(event);
  }

  public getDomainEvents(): ReadonlyArray<KentobotDomainEvent<unknown>> {
    return [...this._events];
  }

  public clearDomainEvents(): void {
    this._events.length = 0;
  }
}
