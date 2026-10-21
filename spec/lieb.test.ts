import { expect, inject, it } from "vitest";
import { createHouse, formPost, inHouse, inviteCodeOf, signup, uniqueName } from "./auth-helpers";
import { openStream, pause } from "./sse";

// "ich hab dich lieb" and the bedroom. The contract: double-clicking someone
// sends them a heart, but only between two members of the house it's sent
// in, never to yourself, and once per sender -> recipient per day (enforced
// on the server). It's private: it goes live to the recipient's own streams
// only, and if they're away it waits until they next open the house, then
// counts as seen. The bedroom lists every member, online or not.
const baseUrl = inject("baseUrl");

const housePage = async (slug: string, cookie: string) =>
  (await fetch(new URL(`/h/${encodeURIComponent(slug)}`, baseUrl), { headers: { cookie } })).text();

const lieb = (slug: string, cookie: string, to: string) => formPost(baseUrl, inHouse("/api/lieb", slug), { to }, cookie);

// Your own person id, off your own corridor chip.
async function personIdOf(slug: string, cookie: string): Promise<string> {
  const id = (await housePage(slug, cookie)).match(/id="party-you"[^>]*data-person-id="([^"]+)"/)?.[1];
  if (!id) throw new Error("no #party-you on the house page");
  return id;
}

interface InboxItem {
  id: number;
  fromPersonId: string;
  fromName: string;
  createdAt: number;
}
function inboxOf(html: string): InboxItem[] {
  const raw = html.match(/<script type="application\/json" id="lieb-inbox">([\s\S]*?)<\/script>/)?.[1];
  if (raw === undefined) throw new Error("no lieb inbox on the house page");
  return JSON.parse(raw) as InboxItem[];
}

async function join(slug: string, owner: string, cookie: string): Promise<void> {
  const code = await inviteCodeOf(baseUrl, owner, slug);
  const res = await formPost(baseUrl, "/api/houses/join", { code }, cookie);
  if (res.status !== 303) throw new Error(`join failed: ${res.status}`);
}

// A house with `n` members; returns their cookies, names and ids.
async function household(n: number) {
  const names = Array.from({ length: n }, (_, i) => uniqueName(`Lieb ${String.fromCharCode(65 + i)}`));
  const cookies = await Promise.all(names.map((name) => signup(baseUrl, name)));
  const slug = await createHouse(baseUrl, cookies[0], "Lieb House");
  for (const c of cookies.slice(1)) await join(slug, cookies[0], c);
  const ids = await Promise.all(cookies.map((c) => personIdOf(slug, c)));
  return { slug, names, cookies, ids };
}

it("sends once per person per day; a second try that day is refused", async () => {
  const { slug, names, cookies, ids } = await household(3);
  const [a, b] = cookies;

  const first = await lieb(slug, a, ids[1]);
  expect(first.status).toBe(200);
  expect(await first.json()).toMatchObject({ ok: true, toName: names[1] });

  const again = await lieb(slug, a, ids[1]);
  expect(again.status).toBe(409);
  expect(await again.json()).toMatchObject({ ok: false, reason: "already-today", toName: names[1] });

  // the limit is per pair: A can still tell C, and B can still tell A
  expect((await lieb(slug, a, ids[2])).status).toBe(200);
  expect((await lieb(slug, b, ids[0])).status).toBe(200);

  // and B only got the one from A, not two
  const fromA = inboxOf(await housePage(slug, b)).filter((i) => i.fromPersonId === ids[0]);
  expect(fromA).toHaveLength(1);
});

it("many quick double-clicks still only send one", async () => {
  const { slug, cookies, ids } = await household(2);
  const results = await Promise.all(Array.from({ length: 6 }, () => lieb(slug, cookies[0], ids[1])));
  expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  expect(results.filter((r) => r.status === 409)).toHaveLength(5);
});

it("can't send one to yourself", async () => {
  const { slug, cookies, ids } = await household(1);
  const res = await lieb(slug, cookies[0], ids[0]);
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ reason: "self" });
  expect(inboxOf(await housePage(slug, cookies[0]))).toHaveLength(0);
});

it("sender and recipient must both be members of the house it's sent in", async () => {
  const { slug, cookies, ids } = await household(2);
  const [a, b] = cookies;
  const outsider = await signup(baseUrl, uniqueName("Lieb Outsider"));
  const theirs = await createHouse(baseUrl, outsider, "Outsider House");
  const outsiderId = await personIdOf(theirs, outsider);

  // to a non-member of this house
  expect((await lieb(slug, a, outsiderId)).status).toBe(404);
  expect((await lieb(slug, a, "not-a-person")).status).toBe(404);
  // from a non-member: the outsider naming a house they're not in
  expect((await lieb(slug, outsider, ids[1])).status).toBe(403);
  // ...or naming their OWN house, to someone who doesn't live there
  expect((await lieb(theirs, outsider, ids[1])).status).toBe(404);
  // and not logged in at all
  expect((await formPost(baseUrl, inHouse("/api/lieb", slug), { to: ids[1] })).status).toBe(401);

  expect(inboxOf(await housePage(slug, b)), "nothing the outsider tried landed").toHaveLength(0);
  expect(inboxOf(await housePage(theirs, outsider))).toHaveLength(0);
});

it("an offline recipient gets it on their next visit, and then it's seen", async () => {
  const { slug, names, cookies, ids } = await household(3);
  const [a, , c] = cookies;
  // C has the house closed (no stream open)
  const res = await lieb(slug, a, ids[2]);
  expect(await res.json()).toMatchObject({ ok: true, live: false });

  const inbox = inboxOf(await housePage(slug, c));
  expect(inbox).toHaveLength(1);
  expect(inbox[0]).toMatchObject({ fromPersonId: ids[0], fromName: names[0] });
  expect(Math.abs(inbox[0].createdAt - Date.now() / 1000)).toBeLessThan(120);

  // shown once, then marked seen: the next load has nothing waiting
  expect(inboxOf(await housePage(slug, c))).toHaveLength(0);
  // and nobody else ever saw it in their inbox
  expect(inboxOf(await housePage(slug, cookies[1]))).toHaveLength(0);
});

it("a heart waits in the house it was sent in", async () => {
  const { slug, cookies, ids } = await household(2);
  const [a, b] = cookies;
  const other = await createHouse(baseUrl, a, "Other Lieb House");
  await join(other, a, b);
  expect((await lieb(slug, a, ids[1])).status).toBe(200);
  expect(inboxOf(await housePage(other, b)), "shown in the wrong house").toHaveLength(0);
  expect(inboxOf(await housePage(slug, b))).toHaveLength(1);
  // the limit is per pair per day, not per house
  expect((await lieb(other, a, ids[1])).status).toBe(409);
});

it("goes live to the recipient's stream only, and is seen once they confirm it", async () => {
  const { slug, names, cookies, ids } = await household(3);
  const [a, b, c] = cookies;
  const toB = await openStream(baseUrl, b, slug);
  const toC = await openStream(baseUrl, c, slug);
  const toA = await openStream(baseUrl, a, slug);
  try {
    await pause(150);
    const res = await lieb(slug, a, ids[1]);
    expect(await res.json()).toMatchObject({ ok: true, live: true });
    expect(await toB.waitFor((e) => e.type === "lieb", 2000), "B never got it live").toBe(true);
    const event = toB.events.find((e) => e.type === "lieb")!.data as InboxItem;
    expect(event).toMatchObject({ fromPersonId: ids[0], fromName: names[0] });

    // a house-wide control event, so we know C's and A's streams are live
    expect((await formPost(baseUrl, inHouse("/api/water", slug), {}, c)).status).toBe(200);
    expect(await toC.waitFor((e) => e.type === "watered", 2000)).toBe(true);
    expect(await toA.waitFor((e) => e.type === "watered", 2000)).toBe(true);
    await pause(200);
    expect(toC.events.some((e) => e.type === "lieb"), "a third member saw someone else's heart").toBe(false);
    expect(toA.events.some((e) => e.type === "lieb"), "the sender's own stream got it").toBe(false);

    // C can't mark B's heart seen...
    expect((await formPost(baseUrl, inHouse("/api/lieb/seen", slug), { id: String(event.id) }, c)).status).toBe(204);
    // ...so until B's page confirms it, it's still waiting for B
    // (a background tab "receives" it without showing it)
    expect((await formPost(baseUrl, inHouse("/api/lieb/seen", slug), { id: String(event.id) }, b)).status).toBe(204);
  } finally {
    for (const s of [toA, toB, toC]) s.close();
  }
  expect(inboxOf(await housePage(slug, b)), "confirmed live, so not shown again").toHaveLength(0);
});

it("an unconfirmed live heart is still waiting on the next visit", async () => {
  const { slug, cookies, ids } = await household(2);
  const [a, b] = cookies;
  const toB = await openStream(baseUrl, b, slug);
  try {
    await pause(150);
    expect(await (await lieb(slug, a, ids[1])).json()).toMatchObject({ live: true });
    expect(await toB.waitFor((e) => e.type === "lieb", 2000)).toBe(true);
  } finally {
    toB.close();
  }
  expect(inboxOf(await housePage(slug, b))).toHaveLength(1);
});

it("the bedroom shows every member, awake or asleep", async () => {
  const { slug, names, cookies } = await household(4);
  const [a, b] = cookies;
  const bStream = await openStream(baseUrl, b, slug);
  try {
    await pause(150);
    const html = await housePage(slug, a);
    const beds = html.match(/id="bedroom-beds"[\s\S]*?<script type="application\/json" id="bedroom-data"/)?.[0] ?? "";
    expect(beds).toBeTruthy();
    // everyone has a bunk (your own is labelled "you")
    for (const name of names.slice(1)) expect(beds).toContain(name);
    expect(beds).toMatch(/data-own="true"/);
    // two to a bunk bed
    expect(beds.match(/class="bunk-bed"/g)).toHaveLength(2);
    const stateOf = (name: string) => beds.match(new RegExp(`data-name="${name}" data-state="(\\w+)"`))?.[1];
    expect(stateOf(names[1]), "B has the house open").toBe("awake");
    expect(stateOf(names[2]), "C doesn't").toBe("asleep");
    expect(html).toContain("2 of 4 awake");
  } finally {
    bStream.close();
  }
});

it("a new member's arrival is announced to the house", async () => {
  const { slug, cookies } = await household(1);
  const watch = await openStream(baseUrl, cookies[0], slug);
  try {
    const newcomer = uniqueName("Lieb Newcomer");
    await join(slug, cookies[0], await signup(baseUrl, newcomer));
    expect(
      await watch.waitFor(
        (e) => e.type === "member_joined" && (e.data as { name: string }).name === newcomer,
        2000,
      ),
    ).toBe(true);
  } finally {
    watch.close();
  }
});
