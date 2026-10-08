import { expect, inject, it } from "vitest";

// This week's own spec line: "a change one person makes appears in every
// other open session within about a second, with no reload." Two separate
// people, two separate connections --- one does something, the other's
// already-open SSE stream has to see it without asking again.
const baseUrl = inject("baseUrl");

async function join(name: string, avatar: string): Promise<string> {
  const origin = new URL(baseUrl).origin;
  const res = await fetch(new URL("/api/join", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin },
    body: new URLSearchParams({ name, avatar }),
    redirect: "manual",
  });
  expect(res.status, "joining should redirect back to the board").toBe(303);
  const setCookie = res.headers.get("set-cookie");
  expect(setCookie, "joining did not set an identity cookie").toBeTruthy();
  return setCookie!.split(";")[0];
}

// Reads Server-Sent Events off a fetch body stream until `want` returns
// true for a parsed event, or `timeoutMs` elapses.
async function waitForEvent(
  cookie: string,
  want: (event: { type: string; data: unknown }) => boolean,
  timeoutMs: number,
): Promise<boolean> {
  const res = await fetch(new URL("/api/events", baseUrl), { headers: { cookie } });
  expect(res.status, "/api/events should answer").toBe(200);
  expect(res.body, "/api/events should stream a body").toBeTruthy();

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;

  try {
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const chunk = await Promise.race([
        reader.read(),
        new Promise<{ done: true; value: undefined }>((resolve) =>
          setTimeout(() => resolve({ done: true, value: undefined }), remaining),
        ),
      ]);
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      for (const block of buffer.split("\n\n").slice(0, -1)) {
        const eventLine = block.split("\n").find((l) => l.startsWith("event:"));
        const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        const type = eventLine?.slice(6).trim() ?? "message";
        const data = JSON.parse(dataLine.slice(5).trim());
        if (want({ type, data })) return true;
      }
      buffer = buffer.split("\n\n").slice(-1)[0];
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return false;
}

it("a watering by one person reaches another person's already-open session live", async () => {
  const origin = new URL(baseUrl).origin;
  const watcherCookie = await join("Watcher", "bunyip");
  const waterer = await join("Waterer", "drop-bear");

  const seen = waitForEvent(watcherCookie, (e) => e.type === "watered", 2000);

  // give the watcher's stream a moment to actually connect before the
  // event fires, same as a real browser opening the page first
  await new Promise((r) => setTimeout(r, 150));
  const water = await fetch(new URL("/api/water", baseUrl), {
    method: "POST",
    headers: { origin, cookie: waterer },
  });
  expect(water.status).toBe(200);

  expect(await seen, "the watcher's open session never saw the watering event").toBe(true);
});

it("joining shows up as presence to someone already on the board", async () => {
  const watcherCookie = await join("Watcher2", "yowie");

  const seen = waitForEvent(
    watcherCookie,
    (e) => e.type === "presence" && Array.isArray((e.data as { here?: unknown[] }).here),
    2000,
  );

  await new Promise((r) => setTimeout(r, 150));
  await join("LateJoiner", "min-min-light");

  expect(await seen, "the watcher's open session never saw a presence update").toBe(true);
});
