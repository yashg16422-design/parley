import { EventEmitter } from "node:events";

/**
 * Wake-up signal for SSE streams on this server instance. It carries no data:
 * Postgres is the source of truth, and a stream that wakes re-reads from its last
 * seq. Streams on other instances catch up on their own poll, so a missed signal
 * only costs latency, never lines.
 */
const g = globalThis as { __parleyBus?: EventEmitter };
const bus = (g.__parleyBus ??= new EventEmitter().setMaxListeners(0));

export const notifyMeeting = (meetingId: string) => void bus.emit(meetingId);
export function onMeeting(meetingId: string, fn: () => void) {
  bus.on(meetingId, fn);
  return () => void bus.off(meetingId, fn);
}
