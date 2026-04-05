import { z } from 'zod';

// Base WebSocket message structure
export const WebSocketBaseMessageSchema = z.object({
  type: z.string(),
  timestamp: z.string().datetime(),
  payload: z.unknown()
});
