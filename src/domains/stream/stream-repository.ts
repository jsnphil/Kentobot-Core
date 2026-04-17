import { Stream } from './models/stream';

export interface StreamRepository {
  loadStream(date: string): Promise<Stream | null>;
  saveStream(stream: Stream): Promise<void>;
}
