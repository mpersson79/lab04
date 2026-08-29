import { EventEmitter } from "node:events";
import type { RunEvent } from "@studio/shared";

type Listener = (event: RunEvent) => void;

/**
 * Fan-out of run events to any number of SSE subscribers, with a replay buffer
 * so a browser that connects (or reconnects) mid-run still sees the whole
 * transcript instead of joining halfway through a sentence.
 */
class RunBus {
  private readonly emitter = new EventEmitter();
  private readonly history = new Map<string, RunEvent[]>();

  constructor() {
    // A busy run with several subscribers can legitimately exceed the default.
    this.emitter.setMaxListeners(200);
  }

  publish(event: RunEvent): void {
    const buffer = this.history.get(event.runId) ?? [];
    if (event.type !== "ping") {
      buffer.push(event);
      // Token deltas dominate; keep the tail bounded so a long run cannot pin
      // an unbounded amount of memory.
      if (buffer.length > 5_000) buffer.splice(0, buffer.length - 5_000);
      this.history.set(event.runId, buffer);
    }
    this.emitter.emit(event.runId, event);
  }

  replay(runId: string): RunEvent[] {
    return this.history.get(runId) ?? [];
  }

  subscribe(runId: string, listener: Listener): () => void {
    this.emitter.on(runId, listener);
    return () => this.emitter.off(runId, listener);
  }

  forget(runId: string): void {
    this.history.delete(runId);
    this.emitter.removeAllListeners(runId);
  }
}

export const runBus = new RunBus();
