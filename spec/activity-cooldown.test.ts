import { expect, inject, it } from "vitest";
import { createHouse, formPost, inHouse, inviteCodeOf, signup, uniqueName } from "./auth-helpers";
import { openStream } from "./sse";

// The wall's per-person placement cooldown is enforced server-side and gets
// shorter with activity: 10 min, 5 min, 2 min, 1 min, 30 s for levels 1-5.
// Levels are public within a house (badges and a leaderboard). Each test
// joins fresh people in their own fresh house, so levels start from zero
// regardless of what else is in the database. Nothing here waits out a
// cooldown: the curve is read off the server's own answers.
const baseUrl = inject("baseUrl");
const origin = new URL(baseUrl).origin;

interface Resident {
  cookie: string;
  slug: string;
  name: string;
}

// Usernames (and house names) are unique, so each run needs fresh ones.
async function join(prefix: string): Promise<Resident> {
  const name = uniqueName(prefix);
  const cookie = await signup(baseUrl, name);
  return { cookie, slug: await createHouse(baseUrl, cookie), name };
}

// A second person moving into `host`'s house via its invite link.
async function moveIn(host: Resident, prefix: string): Promise<Resident> {
  const name = uniqueName(prefix);
  const cookie = await signup(baseUrl, name);
  const code = await inviteCodeOf(baseUrl, host.cookie, host.slug);
  expect((await formPost(baseUrl, "/api/houses/join", { code }, cookie)).status).toBe(303);
  return { cookie, slug: host.slug, name };
}

function place({ cookie, slug }: Resident, x: number): Promise<Response> {
  return fetch(new URL(inHouse("/api/canvas/pixel", slug), baseUrl), {
    method: "POST",
    headers: { cookie, origin },
    body: new URLSearchParams({ x: String(x), y: "0", color: "5" }),
  });
}

async function post({ cookie, slug }: Resident): Promise<void> {
  const body = new FormData();
  body.set("category", "emotional");
  body.set("body", "activity level spec post");
  const res = await fetch(new URL(inHouse("/api/posts", slug), baseUrl), {
    method: "POST",
    headers: { cookie, origin },
    body,
    redirect: "manual",
  });
  expect(res.status).toBe(303);
}

const bodyless = ({ cookie, slug }: Resident, path: string) =>
  fetch(new URL(inHouse(path, slug), baseUrl), { method: "POST", headers: { cookie, origin } });

const page = (viewer: Resident) =>
  fetch(new URL(`/h/${encodeURIComponent(viewer.slug)}`, baseUrl), { headers: { cookie: viewer.cookie } }).then((r) =>
    r.text(),
  );

// The leaderboard row for one person, cut out of the house page's HTML.
function leaderboardRow(html: string, name: string): string {
  const list = html.slice(html.indexOf('id="leaderboard-list"'));
  const at = list.indexOf(`data-name="${name}"`);
  expect(at, `${name} should be on the leaderboard`).toBeGreaterThan(-1);
  return list.slice(at, list.indexOf("</li>", at));
}

it("enforces the 10-minute base cooldown for a person with no activity", async () => {
  const me = await join("cooldown-fresh");
  const first = await place(me, 0);
  expect(first.status).toBe(200);
  const placed = await first.json();
  expect(placed.cooldownSeconds).toBe(600);
  expect(placed.level).toBe(1);

  const second = await place(me, 1);
  expect(second.status).toBe(429);
  const { remaining, cooldownSeconds } = await second.json();
  expect(cooldownSeconds).toBe(600);
  expect(remaining).toBeGreaterThan(590);
  expect(remaining).toBeLessThanOrEqual(600);
});

it("follows the new curve as points come in: 10 min, 5 min, 2 min", async () => {
  const me = await join("cooldown-curve");
  // A post (4 points) reaches level 2.
  await post(me);
  const afterPost = await place(me, 2);
  expect(afterPost.status).toBe(200);
  const l2 = await afterPost.json();
  // 4 for the post + 1 for this first pixel today = 5 points, level 2.
  expect(l2.level).toBe(2);
  expect(l2.cooldownSeconds).toBe(300);

  // Watering (+3) and joining the party room (+2) take it to 10: level 3.
  expect((await bodyless(me, "/api/water")).status).toBe(200);
  const party = await bodyless(me, "/api/party/join");
  expect(party.status).toBe(200);
  expect((await party.json()).level).toBe(3);

  // Still on the cooldown from the last pixel, but it's now the level-3 one.
  const blocked = await place(me, 3);
  expect(blocked.status).toBe(429);
  const { remaining, cooldownSeconds, level } = await blocked.json();
  expect(level).toBe(3);
  expect(cooldownSeconds).toBe(120);
  expect(remaining).toBeLessThanOrEqual(120);
});

it("repeating an action the same day earns nothing more", async () => {
  const me = await join("cooldown-repeat");
  await post(me);
  await post(me);
  await post(me);
  const res = await place(me, 4);
  // 4 (posting, once today) + 1 (a pixel) --- not 13.
  expect((await res.json()).points).toBe(5);
});

it("shows someone's level to the other members of the house", async () => {
  const host = await join("level-host");
  const friend = await moveIn(host, "level-friend");
  // The host gets to level 3: post 4 + water 3 + party 2 + pixel 1 = 10.
  await post(host);
  expect((await bodyless(host, "/api/water")).status).toBe(200);
  expect((await bodyless(host, "/api/party/join")).status).toBe(200);
  expect((await place(host, 5)).status).toBe(200);

  const html = await page(friend);
  const hostRow = leaderboardRow(html, host.name);
  expect(hostRow).toContain("level 3");
  expect(hostRow).toContain("10 pts");
  expect(hostRow).toContain('data-level="3"');
  const friendRow = leaderboardRow(html, friend.name);
  expect(friendRow).toContain("level 1");
  // Ranked: the host above the friend.
  const board = html.slice(html.indexOf('id="leaderboard-list"'));
  expect(board.indexOf(`data-name="${host.name}"`)).toBeLessThan(board.indexOf(`data-name="${friend.name}"`));
  // The host is in the party room, so the friend sees their badge there too.
  const room = html.slice(html.indexOf('id="party-room-guests"'));
  expect(room.slice(0, room.indexOf("</div>") + 400)).toMatch(/class="lvl-flair" data-level="3"/);
});

it("doesn't show one house's people on another house's leaderboard", async () => {
  const a = await join("level-house-a");
  const b = await join("level-house-b");
  const html = await page(a);
  expect(html).toContain(`data-name="${a.name}"`);
  expect(html).not.toContain(b.name);
});

it("pushes a level change live to the rest of the house", async () => {
  const host = await join("level-live");
  const friend = await moveIn(host, "level-live-friend");
  const stream = await openStream(baseUrl, friend.cookie, host.slug);
  try {
    expect(stream.status).toBe(200);
    await post(host);
    const got = await stream.waitFor(
      (e) => e.type === "level" && (e.data as { level?: number; points?: number }).points === 4,
      5000,
    );
    expect(got, "a level event about the host should reach the friend").toBe(true);
    const event = stream.events.find((e) => e.type === "level")!.data as { level: number };
    expect(event.level).toBe(2);
  } finally {
    stream.close();
  }
});
