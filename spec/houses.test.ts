import { expect, inject, it } from "vitest";
import { createHouse, formPost, inHouse, inviteCodeOf, signup, uniqueName } from "./auth-helpers";
import { openStream, pause } from "./sse";

// The houses contract: anyone logged in can build a house; you get in by
// its invite link or by typing its name; and a house's posts, plant, wall,
// party room and live events are for its members only --- checked on the
// server, so a non-member gets a 403 and none of the data, whatever they
// send.
const baseUrl = inject("baseUrl");
const origin = new URL(baseUrl).origin;
const page = (slug: string, cookie: string) =>
  fetch(new URL(`/h/${encodeURIComponent(slug)}`, baseUrl), { headers: { cookie }, redirect: "manual" });

async function post(slug: string, cookie: string, body: string): Promise<Response> {
  const form = new FormData();
  form.set("category", "practical");
  form.set("body", body);
  return fetch(new URL(inHouse("/api/posts", slug), baseUrl), {
    method: "POST",
    headers: { origin, cookie },
    body: form,
    redirect: "manual",
  });
}

it("a new account has no house, and lands on the street page", async () => {
  const cookie = await signup(baseUrl, uniqueName("Houseless"));
  const root = await fetch(new URL("/", baseUrl), { headers: { cookie }, redirect: "manual" });
  expect(root.status).toBe(302);
  expect(root.headers.get("location")).toBe("/houses");
  const street = await fetch(new URL("/houses", baseUrl), { headers: { cookie } });
  expect(street.status).toBe(200);
  const html = await street.text();
  expect(html).toContain('action="/api/houses"');
  expect(html).toContain('action="/api/houses/join"');
});

it("building a house makes you its first member, and / remembers it", async () => {
  const cookie = await signup(baseUrl, uniqueName("Builder"));
  const name = uniqueName("Our Place");
  const res = await formPost(baseUrl, "/api/houses", { name }, cookie);
  expect(res.status).toBe(303);
  const location = res.headers.get("location")!;
  expect(location).toMatch(/^\/h\/our-place-/);

  const inside = await fetch(new URL(location, baseUrl), { headers: { cookie } });
  expect(inside.status).toBe(200);
  const html = await inside.text();
  expect(html).toContain(name);
  expect(html).toContain('id="corridor"');
  expect(html).toContain('id="party-room-dropzone"');
  expect(html).toContain('id="street-door"');

  const root = await fetch(new URL("/", baseUrl), { headers: { cookie }, redirect: "manual" });
  expect(root.headers.get("location")).toBe(location);

  // the street lists it
  expect(await (await fetch(new URL("/houses", baseUrl), { headers: { cookie } })).text()).toContain(name);
});

it("house names are unique ignoring case and punctuation", async () => {
  const cookie = await signup(baseUrl, uniqueName("Twin"));
  const name = uniqueName("Twin House");
  expect((await formPost(baseUrl, "/api/houses", { name }, cookie)).status).toBe(303);
  const again = await formPost(baseUrl, "/api/houses", { name: `${name.toUpperCase()}!!` }, cookie);
  expect(again.status).toBe(303);
  expect(again.headers.get("location")).toContain("/houses?error=house-name-taken");
});

it("joins by invite code", async () => {
  const owner = await signup(baseUrl, uniqueName("Host"));
  const slug = await createHouse(baseUrl, owner);
  const code = await inviteCodeOf(baseUrl, owner, slug);
  const guest = await signup(baseUrl, uniqueName("Guest"));

  expect((await page(slug, guest)).status, "not a member yet").toBe(403);

  // the invite page itself only asks; it doesn't join on a GET
  const invite = await fetch(new URL(`/join/${code}`, baseUrl), { headers: { cookie: guest } });
  expect(invite.status).toBe(200);
  expect((await page(slug, guest)).status, "opening the link alone must not join").toBe(403);

  const joined = await formPost(baseUrl, "/api/houses/join", { code }, guest);
  expect(joined.status).toBe(303);
  expect(joined.headers.get("location")).toBe(`/h/${encodeURIComponent(slug)}`);
  expect((await page(slug, guest)).status).toBe(200);

  const bad = await formPost(baseUrl, "/api/houses/join", { code: "not-a-real-code" }, guest);
  expect(bad.headers.get("location")).toContain("error=bad-invite");
});

it("joins by typing the house's name, in any case", async () => {
  const owner = await signup(baseUrl, uniqueName("Namer"));
  const name = uniqueName("Visit Me");
  const created = await formPost(baseUrl, "/api/houses", { name }, owner);
  const slug = decodeURIComponent(created.headers.get("location")!.slice(3));
  const visitor = await signup(baseUrl, uniqueName("Visitor"));

  const joined = await formPost(baseUrl, "/api/houses/join", { name: `  ${name.toUpperCase()} ` }, visitor);
  expect(joined.headers.get("location")).toBe(`/h/${encodeURIComponent(slug)}`);
  expect((await page(slug, visitor)).status).toBe(200);

  const nope = await formPost(baseUrl, "/api/houses/join", { name: uniqueName("Nowhere") }, visitor);
  expect(nope.headers.get("location")).toContain("error=no-such-house");
});

it("a person can belong to several houses, and each keeps its own posts", async () => {
  const cookie = await signup(baseUrl, uniqueName("Two Homes"));
  const a = await createHouse(baseUrl, cookie, "Home A");
  const b = await createHouse(baseUrl, cookie, "Home B");
  const markerA = `in-a-${Date.now()}-${Math.random()}`;
  expect((await post(a, cookie, markerA)).status).toBe(303);

  expect(await (await page(a, cookie)).text()).toContain(markerA);
  expect(await (await page(b, cookie)).text(), "a post leaked into another house").not.toContain(markerA);

  const street = await (await fetch(new URL("/houses", baseUrl), { headers: { cookie } })).text();
  expect(street).toContain(`/h/${encodeURIComponent(a)}`);
  expect(street).toContain(`/h/${encodeURIComponent(b)}`);
});

it("a non-member can't read or change another house", async () => {
  const owner = await signup(baseUrl, uniqueName("Owner"));
  const slug = await createHouse(baseUrl, owner);
  const secret = `secret-${Date.now()}-${Math.random()}`;
  expect((await post(slug, owner, secret)).status).toBe(303);
  const ownerPage = await (await page(slug, owner)).text();
  const postId = ownerPage.match(/data-post-id="(\d+)"/)?.[1];
  expect(postId).toBeTruthy();

  const outsider = await signup(baseUrl, uniqueName("Outsider"));
  // the outsider has a house of their own, so "logged in" isn't the issue
  const theirs = await createHouse(baseUrl, outsider);

  const door = await page(slug, outsider);
  expect(door.status).toBe(403);
  const doorHtml = await door.text();
  expect(doorHtml).not.toContain(secret);
  expect(doorHtml).not.toContain("party-room-guests");

  const asOutsider = (path: string, fields: Record<string, string> = {}) =>
    formPost(baseUrl, inHouse(path, slug), fields, outsider);
  expect((await asOutsider("/api/water")).status).toBe(403);
  expect((await asOutsider("/api/canvas/pixel", { x: "1", y: "1", color: "3" })).status).toBe(403);
  expect((await asOutsider("/api/canvas/name", { name: "mine now" })).status).toBe(403);
  expect((await asOutsider("/api/plant/name", { name: "mine now" })).status).toBe(403);
  expect((await asOutsider("/api/party/join")).status).toBe(403);
  expect((await asOutsider("/api/party/leave")).status).toBe(403);
  expect((await asOutsider(`/api/posts/${postId}/score`, { score: "100" })).status).toBe(403);
  expect((await asOutsider(`/api/posts/${postId}/delete`)).status).toBe(403);
  expect((await post(slug, outsider, "graffiti")).status).toBe(403);
  const events = await fetch(new URL(inHouse("/api/events", slug), baseUrl), { headers: { cookie: outsider } });
  expect(events.status).toBe(403);
  await events.body?.cancel();

  // Naming your OWN house doesn't reach a post in someone else's.
  expect(
    (await formPost(baseUrl, inHouse(`/api/posts/${postId}/score`, theirs), { score: "100" }, outsider)).status,
  ).toBe(404);
  expect((await formPost(baseUrl, inHouse(`/api/posts/${postId}/delete`, theirs), {}, outsider)).status).toBe(404);

  // ...and nothing the outsider tried landed
  const after = await (await page(slug, owner)).text();
  expect(after).toContain(secret);
  expect(after).not.toContain("mine now");
  expect(after).not.toContain("graffiti");
  expect(after).toContain("no one has rated this post yet");
});

it("live events don't leak across houses", async () => {
  const a = await signup(baseUrl, uniqueName("Leak A"));
  const b = await signup(baseUrl, uniqueName("Leak B"));
  const houseA = await createHouse(baseUrl, a, "Leak House A");
  const houseB = await createHouse(baseUrl, b, "Leak House B");

  const watchA = await openStream(baseUrl, a, houseA);
  try {
    expect(watchA.status).toBe(200);
    await pause(150);
    // b is busy in house B: arrives, waters, paints, joins the party room
    const watchB = await openStream(baseUrl, b, houseB);
    expect((await formPost(baseUrl, inHouse("/api/water", houseB), {}, b)).status).toBe(200);
    expect((await formPost(baseUrl, inHouse("/api/party/join", houseB), {}, b)).status).toBe(200);
    expect(
      (await formPost(baseUrl, inHouse("/api/plant/name", houseB), { name: "B's fern" }, b)).status,
    ).toBe(200);
    // and a control event in house A, so we know A's stream is live
    expect((await formPost(baseUrl, inHouse("/api/water", houseA), {}, a)).status).toBe(200);
    expect(await watchA.waitFor((e) => e.type === "watered", 2000), "A never saw its own house's event").toBe(true);
    await pause(300);
    watchB.close();

    const types = watchA.events.map((e) => e.type);
    expect(types.filter((t) => t === "watered"), "a watering in house B reached house A").toHaveLength(1);
    expect(types).not.toContain("party_joined");
    expect(types).not.toContain("renamed");
    // presence in A only ever lists A's people
    for (const e of watchA.events.filter((e) => e.type === "presence")) {
      const names = ((e.data as { here: Array<{ name: string }> }).here ?? []).map((p) => p.name);
      expect(names.some((n) => n.startsWith("Leak B")), "house B's visitor showed up in house A's corridor").toBe(false);
    }
  } finally {
    watchA.close();
  }
});

it("one person with two houses open stands in both corridors", async () => {
  const me = await signup(baseUrl, uniqueName("Doubled"));
  const friend = await signup(baseUrl, uniqueName("Friend"));
  const h1 = await createHouse(baseUrl, me, "Corridor One");
  const h2 = await createHouse(baseUrl, me, "Corridor Two");
  for (const h of [h1, h2]) {
    const code = await inviteCodeOf(baseUrl, me, h);
    await formPost(baseUrl, "/api/houses/join", { code }, friend);
  }
  const friend1 = await openStream(baseUrl, friend, h1);
  const friend2 = await openStream(baseUrl, friend, h2);
  const mine1 = await openStream(baseUrl, me, h1);
  const mine2 = await openStream(baseUrl, me, h2);
  try {
    const sees = (s: typeof friend1) =>
      s.waitFor(
        (e) =>
          e.type === "presence" &&
          (e.data as { here: Array<{ name: string }> }).here.some((p) => p.name.startsWith("Doubled")),
        2000,
      );
    expect(await sees(friend1)).toBe(true);
    expect(await sees(friend2)).toBe(true);
  } finally {
    for (const s of [friend1, friend2, mine1, mine2]) s.close();
  }
});

it("an invite link sends a logged-out visitor through signup and back to it", async () => {
  const owner = await signup(baseUrl, uniqueName("Inviter"));
  const slug = await createHouse(baseUrl, owner);
  const code = await inviteCodeOf(baseUrl, owner, slug);
  const invite = await (await fetch(new URL(`/join/${code}`, baseUrl))).text();
  expect(invite).toContain(`/signup?next=%2Fjoin%2F${code}`);

  const res = await formPost(baseUrl, "/api/signup", {
    name: uniqueName("Invitee"),
    password: "correct horse battery",
    confirm: "correct horse battery",
    avatar: "bunyip",
    next: `/join/${code}`,
  });
  expect(res.headers.get("location")).toBe(`/join/${code}`);
  // and an off-site ?next= is ignored
  const evil = await formPost(baseUrl, "/api/signup", {
    name: uniqueName("Invitee2"),
    password: "correct horse battery",
    confirm: "correct horse battery",
    avatar: "bunyip",
    next: "//evil.example/",
  });
  expect(evil.headers.get("location")).toBe("/");
});
