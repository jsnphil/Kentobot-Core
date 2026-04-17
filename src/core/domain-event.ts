// Base type
export type KentobotDomainEvent<TPayload> = {
    type: string;
    occurredAt: string;
    source: string;
    version: number;
    payload: TPayload;
  };
  