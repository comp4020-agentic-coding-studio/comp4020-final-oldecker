import { expect, inject, it } from "vitest";

// The wall's per-person placement cooldown is enforced server-side and gets
// shorter with (private) activity. Each test joins a fresh person, so the
// level starts from zero regardless of what else is in the database.
const baseUrl = inject("baseUrl");
const origin = new URL(baseUrl).origin;

async function join(name: string): Promise<string> {
  const res = await fetch(new URL("/api/join", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin },
    body: new URLSearchParams({ name, avatar: "bunyip" }),
    redirect: "manual",
  });
  expect(res.status).toBe(303);
  return res.headers.get("set-cookie")!.split(";")[0];
}

function place(cookie: string, x: number): Promise<Response> {
  return fetch(new URL("/api/canvas/pixel", baseUrl), {
    method: "POST",
    headers: { cookie, origin },
    body: new URLSearchParams({ x: String(x), y: "0", color: "5" }),
  });
}

it("enforces the base cooldown for a person with no activity", async () => {
  const cookie = await join("cooldown-fresh");
  const first = await place(cookie, 0);
  expect(first.status).toBe(200);
  expect((await first.json()).cooldownSeconds).toBe(30);

  const second = await place(cookie, 1);
  expect(second.status).toBe(429);
  const { remaining } = await second.json();
  expect(remaining).toBeGreaterThan(24);
  expect(remaining).toBeLessThanOrEqual(30);
});

it("shortens the cooldown after the person posts", async () => {
  const cookie = await join("cooldown-active");
  const body = new FormData();
  body.set("category", "emotional");
  body.set("body", "activity level spec post");
  const post = await fetch(new URL("/api/posts", baseUrl), {
    method: "POST",
    headers: { cookie, origin },
    body,
    redirect: "manual",
  });
  expect(post.status).toBe(303);

  expect((await place(cookie, 2)).status).toBe(200);
  const blocked = await place(cookie, 3);
  expect(blocked.status).toBe(429);
  const { remaining, cooldownSeconds } = await blocked.json();
  expect(cooldownSeconds).toBeLessThan(30);
  expect(remaining).toBeLessThanOrEqual(cooldownSeconds);
});

it("never shows a person's level to anyone else", async () => {
  const cookie = await join("cooldown-private");
  const other = await join("cooldown-other");
  const mine = await (await fetch(baseUrl, { headers: { cookie } })).text();
  const theirs = await (await fetch(baseUrl, { headers: { cookie: other } })).text();
  expect(mine).toContain("you can place every");
  // Their own line appears once, for them; nothing of mine leaks into it.
  expect(theirs.match(/you can place every/g)).toHaveLength(1);
});
