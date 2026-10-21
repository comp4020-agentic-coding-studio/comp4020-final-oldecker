import { expect, inject, it } from "vitest";
import { createHouse, formPost, inHouse, inviteCodeOf, signup, uniqueName } from "./auth-helpers";
import { openStream, pause } from "./sse";

// The knock contract. Typing a house's name stands you at its door instead
// of making you a member; any member can let you in or turn you away; only
// you can walk away; and none of it is a way around the server's checks.
// An invite link still walks you straight in.
const baseUrl = inject("baseUrl");
const page = (slug: string, cookie: string) =>
  fetch(new URL(`/h/${encodeURIComponent(slug)}`, baseUrl), { headers: { cookie }, redirect: "manual" });
const street = async (cookie: string) =>
  (await fetch(new URL("/houses", baseUrl), { headers: { cookie } })).text();
// What the street page RENDERS, matched on markup rather than wording: the
// page also inlines its live script, whose strings say the same words.
const WAITING = 'class="lot waiting-lot"';
const LET_IN_NOTICE = 'class="knock-notice let-in"';
const TURNED_AWAY_NOTICE = 'class="knock-notice turned-away"';

// A house with an owner, and someone who has just knocked on it by name.
// Returns the knock's id, read off the knocker's street page (its "stop
// waiting" form) the way a browser would see it.
async function knocking(): Promise<{ slug: string; owner: string; knocker: string; knockerName: string; knockId: string }> {
  const owner = await signup(baseUrl, uniqueName("Doorkeeper"));
  const slug = await createHouse(baseUrl, owner, "Knock House");
  const knockerName = uniqueName("Knocker");
  const knocker = await signup(baseUrl, knockerName);
  const res = await formPost(baseUrl, "/api/houses/join", { name: slug }, knocker);
  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toContain("/houses?knocked=");
  const html = await street(knocker);
  const knockId = html.match(/data-knock-id="(\d+)"/)?.[1];
  if (!knockId) throw new Error("no waiting lot on the knocker's street page");
  return { slug, owner, knocker, knockerName, knockId };
}

const answer = (kind: "let-in" | "turn-away", slug: string, knockId: string, cookie: string) =>
  formPost(baseUrl, inHouse(`/api/houses/knocks/${kind}`, slug), { knock: knockId }, cookie);
const cancel = (knockId: string, cookie: string) =>
  formPost(baseUrl, "/api/houses/knocks/cancel", { knock: knockId }, cookie);

it("knocking by name doesn't grant access: the house page and its APIs stay shut", async () => {
  const { slug, owner, knocker, knockerName } = await knocking();

  expect((await page(slug, knocker)).status).toBe(403);
  const asKnocker = (path: string, fields: Record<string, string> = {}) =>
    formPost(baseUrl, inHouse(path, slug), fields, knocker);
  expect((await asKnocker("/api/water")).status).toBe(403);
  expect((await asKnocker("/api/party/join")).status).toBe(403);
  expect((await asKnocker("/api/plant/name", { name: "knocked in" })).status).toBe(403);
  const events = await fetch(new URL(inHouse("/api/events", slug), baseUrl), { headers: { cookie: knocker } });
  expect(events.status).toBe(403);
  await events.body?.cancel();

  // the knocker's street shows them waiting at that door
  const html = await street(knocker);
  expect(html).toContain(WAITING);
  expect(html).not.toContain(`href="/h/${encodeURIComponent(slug)}"`);

  // the member sees them on the doormat, with the buttons to answer
  const inside = await (await page(slug, owner)).text();
  expect(inside).toContain('id="front-door"');
  expect(inside).toContain(knockerName);
  expect(inside).toContain('action="/api/houses/knocks/let-in"');

  // knocking again while waiting is the same knock, not a second one
  await formPost(baseUrl, "/api/houses/join", { name: slug }, knocker);
  expect((await street(knocker)).match(/class="lot waiting-lot"/g)).toHaveLength(1);
});

it("a member can let a knocker in, and then they're a member", async () => {
  const { slug, owner, knocker, knockId } = await knocking();
  const res = await answer("let-in", slug, knockId, owner);
  expect(res.status).toBe(303);
  expect((await page(slug, knocker)).status).toBe(200);
  expect((await formPost(baseUrl, inHouse("/api/water", slug), {}, knocker)).status).toBe(200);
  // ...the house is on their street now, and they're told once
  const first = await street(knocker);
  expect(first).toContain(`href="/h/${encodeURIComponent(slug)}"`);
  expect(first).toContain(LET_IN_NOTICE);
  expect(await street(knocker)).not.toContain(LET_IN_NOTICE);
  // and the doormat is clear
  expect(await (await page(slug, owner)).text()).not.toContain('class="fd-knocker"');
});

it("a member can turn a knocker away: still no access, they're told once, and may knock again", async () => {
  const { slug, owner, knocker, knockId } = await knocking();
  expect((await answer("turn-away", slug, knockId, owner)).status).toBe(303);
  expect((await page(slug, knocker)).status).toBe(403);

  const told = await street(knocker);
  expect(told).toContain(TURNED_AWAY_NOTICE);
  expect(told).not.toContain(WAITING);
  expect(await street(knocker), "the turn-away is said once").not.toContain(TURNED_AWAY_NOTICE);

  // answering an already-answered knock is a no-op, even the other way
  expect((await answer("let-in", slug, knockId, owner)).status).toBe(303);
  expect((await page(slug, knocker)).status, "a late 'let in' must not undo the turn-away").toBe(403);

  // knocking again works, as a fresh knock
  await formPost(baseUrl, "/api/houses/join", { name: slug }, knocker);
  const again = (await street(knocker)).match(/data-knock-id="(\d+)"/)?.[1];
  expect(again).toBeTruthy();
  expect(again).not.toBe(knockId);
  expect((await answer("let-in", slug, again!, owner)).status).toBe(303);
  expect((await page(slug, knocker)).status).toBe(200);
});

it("only a member of that house can answer its knocks", async () => {
  const { slug, knocker, knockId } = await knocking();
  const stranger = await signup(baseUrl, uniqueName("Stranger"));
  const theirs = await createHouse(baseUrl, stranger, "Elsewhere");

  // not a member: 403, from either answer
  expect((await answer("let-in", slug, knockId, stranger)).status).toBe(403);
  expect((await answer("turn-away", slug, knockId, stranger)).status).toBe(403);
  // a member of a DIFFERENT house naming their own: the knock isn't at that door
  expect((await answer("let-in", theirs, knockId, stranger)).status).toBe(404);
  // the knocker can't let themselves in
  expect((await answer("let-in", slug, knockId, knocker)).status).toBe(403);
  // logged out
  expect((await answer("let-in", slug, knockId, "")).status).toBe(401);

  expect((await page(slug, knocker)).status).toBe(403);
  expect((await page(slug, stranger)).status).toBe(403);
  expect(await street(knocker)).toContain(WAITING);
});

it("the knocker can stop waiting, and nobody else can do it for them", async () => {
  const { slug, owner, knocker, knockId } = await knocking();
  const stranger = await signup(baseUrl, uniqueName("Meddler"));
  expect((await cancel(knockId, stranger)).status).toBe(403);
  expect((await cancel(knockId, owner)).status, "a member answers, they don't cancel").toBe(403);
  expect(await street(knocker)).toContain(WAITING);

  expect((await cancel(knockId, knocker)).status).toBe(303);
  expect(await street(knocker)).not.toContain(WAITING);
  expect(await (await page(slug, owner)).text()).not.toContain('class="fd-knocker"');
  // a member answering it afterwards changes nothing
  expect((await answer("let-in", slug, knockId, owner)).status).toBe(303);
  expect((await page(slug, knocker)).status).toBe(403);
});

it("the buttons' JSON answers say whether the answer counted", async () => {
  const { slug, owner, knockId } = await knocking();
  const ask = () =>
    fetch(new URL(inHouse("/api/houses/knocks/turn-away", slug), baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: new URL(baseUrl).origin,
        accept: "application/json",
        cookie: owner,
      },
      body: new URLSearchParams({ knock: knockId }),
    }).then((r) => r.json());
  expect(await ask()).toEqual({ changed: true, outcome: "turned_away" });
  expect(await ask()).toEqual({ changed: false, outcome: "turned_away" });
});

it("a knock, and its answer, reach the house's members live --- and nobody else", async () => {
  const owner = await signup(baseUrl, uniqueName("Listener"));
  const slug = await createHouse(baseUrl, owner, "Live Door");
  const other = await signup(baseUrl, uniqueName("Neighbour"));
  const otherHouse = await createHouse(baseUrl, other, "Next Door");
  const knockerName = uniqueName("Live Knocker");
  const knocker = await signup(baseUrl, knockerName);

  const watch = await openStream(baseUrl, owner, slug);
  const elsewhere = await openStream(baseUrl, other, otherHouse);
  try {
    expect(watch.status).toBe(200);
    await pause(150);
    await formPost(baseUrl, "/api/houses/join", { name: slug }, knocker);
    expect(
      await watch.waitFor((e) => e.type === "knock" && (e.data as { name: string }).name === knockerName, 2000),
      "the member never saw the knock",
    ).toBe(true);
    const id = String((watch.events.find((e) => e.type === "knock")!.data as { id: number }).id);
    expect((await answer("let-in", slug, id, owner)).status).toBe(303);
    expect(
      await watch.waitFor(
        (e) => e.type === "knock_answered" && (e.data as { outcome: string }).outcome === "let_in",
        2000,
      ),
    ).toBe(true);
    await pause(200);
    expect(elsewhere.events.map((e) => e.type)).not.toContain("knock");
    expect(elsewhere.events.map((e) => e.type)).not.toContain("knock_answered");
  } finally {
    watch.close();
    elsewhere.close();
  }
});

it("the knocker hears the answer live on their own street channel", async () => {
  const { slug, owner, knocker, knockId } = await knocking();
  const controller = new AbortController();
  const res = await fetch(new URL("/api/street-events", baseUrl), {
    headers: { cookie: knocker },
    signal: controller.signal,
  });
  expect(res.status).toBe(200);
  try {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    await pause(100);
    expect((await answer("let-in", slug, knockId, owner)).status).toBe(303);
    let text = "";
    const deadline = Date.now() + 2000;
    while (!text.includes("event: my_knock") && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    expect(text).toContain("event: my_knock");
    expect(text).toContain('"outcome":"let_in"');
  } finally {
    controller.abort();
  }
  const anon = await fetch(new URL("/api/street-events", baseUrl));
  expect(anon.status).toBe(401);
  await anon.body?.cancel();
});

it("an invite link still walks you straight in, even while you're knocking", async () => {
  const { slug, owner, knocker } = await knocking();
  const code = await inviteCodeOf(baseUrl, owner, slug);
  const res = await formPost(baseUrl, "/api/houses/join", { code }, knocker);
  expect(res.headers.get("location")).toBe(`/h/${encodeURIComponent(slug)}`);
  expect((await page(slug, knocker)).status).toBe(200);
  // the now-moot knock is off the doormat and off their street
  expect(await (await page(slug, owner)).text()).not.toContain('class="fd-knocker"');
  expect(await street(knocker)).not.toContain(WAITING);
});
