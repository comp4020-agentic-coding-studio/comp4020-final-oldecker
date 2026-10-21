import { expect, inject, it } from "vitest";
import { createHouse, formPost, inHouse, inviteCodeOf, signup, uniqueName } from "./auth-helpers";
import { openStream, pause } from "./sse";

// This week's own spec line: "a change one person makes appears in every
// other open session within about a second, with no reload." Two separate
// people in the same house, two separate connections --- one does
// something, the other's already-open SSE stream has to see it without
// asking again.
const baseUrl = inject("baseUrl");

// A house with two members: the watcher who built it, and someone who
// joined by its invite link.
async function twoInAHouse(): Promise<{ slug: string; watcher: string; other: string }> {
  const watcher = await signup(baseUrl, uniqueName("Watcher"), "bunyip");
  const slug = await createHouse(baseUrl, watcher);
  const code = await inviteCodeOf(baseUrl, watcher, slug);
  const other = await signup(baseUrl, uniqueName("Other"), "drop-bear");
  const joined = await formPost(baseUrl, "/api/houses/join", { code }, other);
  expect(joined.status).toBe(303);
  return { slug, watcher, other };
}

it("a watering by one person reaches another person's already-open session live", async () => {
  const { slug, watcher, other } = await twoInAHouse();

  const stream = await openStream(baseUrl, watcher, slug);
  expect(stream.status, "/api/events should answer").toBe(200);
  try {
    // give the watcher's stream a moment to actually connect before the
    // event fires, same as a real browser opening the page first
    await pause(150);
    const water = await formPost(baseUrl, inHouse("/api/water", slug), {}, other);
    expect(water.status).toBe(200);
    expect(await stream.waitFor((e) => e.type === "watered", 2000), "the watcher never saw the watering").toBe(true);
  } finally {
    stream.close();
  }
});

it("someone opening the house shows up as presence to someone already in it", async () => {
  const { slug, watcher, other } = await twoInAHouse();

  const stream = await openStream(baseUrl, watcher, slug);
  const late = { close: () => {} };
  try {
    await pause(150);
    Object.assign(late, await openStream(baseUrl, other, slug));
    const seen = await stream.waitFor(
      (e) => e.type === "presence" && ((e.data as { here?: unknown[] }).here?.length ?? 0) >= 2,
      2000,
    );
    expect(seen, "the watcher's open session never saw the second person arrive").toBe(true);
  } finally {
    stream.close();
    late.close();
  }
});
