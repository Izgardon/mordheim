import { realtimeSocketId } from "./client";

/**
 * Writes name this browser's socket (ECON-PERF-02, CAMP-NEW-07), so the server leaves it out of
 * the event the write broadcasts: the writer already has the answer. Needs `x-pusher-socket-id`
 * in the backend's CORS_ALLOW_HEADERS (it is).
 */
export function socketIdHeaders(): Record<string, string> | undefined {
  const socketId = realtimeSocketId();
  return socketId ? { "X-Pusher-Socket-Id": socketId } : undefined;
}
