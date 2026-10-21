import { expect, inject, it } from "vitest";
import { createHouse, inHouse, signup, uniqueName } from "./auth-helpers";

// The wall's per-person placement cooldown is enforced server-side and gets
// shorter with (private) activity. Each test joins a fresh person in their
// own fresh house, so the level starts from zero regardless of what else is
// in the database.
const baseUrl = inject("baseUrl");
const origin = new URL(baseUrl).origin;

interface Resident {
  cookie: string;
  slug: string;
}

// Usernames (and house names) are unique, so each run needs fresh ones.
async function join(prefix: string): Promise<Resident> {
  const cookie = await signup(baseUrl, uniqueName(prefix));
  return { cookie, slug: await createHouse(baseUrl, cookie) };
}

function place({ cookie, slug }: Resident, x: number): Promise<Response> {
  return fetch(new URL(inHouse("/api/canvas/pixel", slug), baseUrl), {
    method: "POST",
    headers: { cookie, origin },
    body: new URLSearchParams({ x: String(x), y: "0", color: "5" }),
  });
}

it("enforces the base cooldown for a person with no activity", async () => {
  const me = await join("cooldown-fresh");
  const first = await place(me, 0);
  expect(first.status).toBe(200);
  expect((await first.json()).cooldownSeconds).toBe(30);

  const second = await place(me, 1);
  expect(second.status).toBe(429);
  const { remaining } = await second.json();
  expect(remaining).toBeGreaterThan(24);
  expect(remaining).toBeLessThanOrEqual(30);
});

it("shortens the cooldown after the person posts", async () => {
  const me = await join("cooldown-active");
  const body = new FormData();
  body.set("category", "emotional");
  body.set("body", "activity level spec post");
  const post = await fetch(new URL(inHouse("/api/posts", me.slug), baseUrl), {
    method: "POST",
    headers: { cookie: me.cookie, origin },
    body,
    redirect: "manual",
  });
  expect(post.status).toBe(303);

  expect((await place(me, 2)).status).toBe(200);
  const blocked = await place(me, 3);
  expect(blocked.status).toBe(429);
  const { remaining, cooldownSeconds } = await blocked.json();
  expect(cooldownSeconds).toBeLessThan(30);
  expect(remaining).toBeLessThanOrEqual(cooldownSeconds);
});

it("never shows a person's level to anyone else", async () => {
  const me = await join("cooldown-private");
  const other = await join("cooldown-other");
  const page = (r: Resident) => fetch(new URL(`/h/${encodeURIComponent(r.slug)}`, baseUrl), { headers: { cookie: r.cookie } });
  const mine = await (await page(me)).text();
  const theirs = await (await page(other)).text();
  expect(mine).toContain("you can place every");
  // Their own line appears once, for them; nothing of mine leaks into it.
  expect(theirs.match(/you can place every/g)).toHaveLength(1);
});
