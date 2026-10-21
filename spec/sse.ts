// Reads Server-Sent Events off /api/events for one house, shared by the
// realtime and houses specs.
export interface SseEvent {
  type: string;
  data: unknown;
}

// An open stream. `events` collects everything seen so far; `waitFor`
// resolves true once an event matching `want` arrives (or has already), or
// false after timeoutMs. Always close() it.
export interface Stream {
  status: number;
  events: SseEvent[];
  waitFor(want: (e: SseEvent) => boolean, timeoutMs: number): Promise<boolean>;
  close(): void;
}

export async function openStream(baseUrl: string, cookie: string, slug: string): Promise<Stream> {
  const url = new URL(`/api/events?${new URLSearchParams({ house: slug })}`, baseUrl);
  const controller = new AbortController();
  const res = await fetch(url, { headers: { cookie }, signal: controller.signal });
  const events: SseEvent[] = [];
  const waiters = new Set<() => void>();

  if (res.ok && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    void (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            const lines = block.split("\n");
            const dataLine = lines.find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            const type = lines.find((l) => l.startsWith("event:"))?.slice(6).trim() ?? "message";
            events.push({ type, data: JSON.parse(dataLine.slice(5).trim()) });
            for (const wake of waiters) wake();
          }
        }
      } catch {
        // aborted by close()
      }
    })();
  } else {
    await res.body?.cancel().catch(() => {});
  }

  return {
    status: res.status,
    events,
    waitFor(want, timeoutMs) {
      if (events.some(want)) return Promise.resolve(true);
      return new Promise((resolve) => {
        const wake = () => {
          if (!events.some(want)) return;
          waiters.delete(wake);
          clearTimeout(timer);
          resolve(true);
        };
        const timer = setTimeout(() => {
          waiters.delete(wake);
          resolve(false);
        }, timeoutMs);
        waiters.add(wake);
      });
    },
    close() {
      controller.abort();
    },
  };
}

export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
