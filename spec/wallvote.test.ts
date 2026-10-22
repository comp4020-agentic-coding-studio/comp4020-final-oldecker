import { expect, inject, it } from "vitest";
import { createHouse, formPost, inHouse, inviteCodeOf, signup, uniqueName } from "./auth-helpers";
import { openStream, pause } from "./sse";

// Vote to wipe the wall: any member can start or join one by casting a
// ballot. Strictly more than half the CURRENT membership voting yes passes
// it immediately; otherwise it stays open and, when read-time sweeping (or
// an in-flight timer) notices its 3-day deadline has passed, it passes only
// if yes > no AND there are at least 2 yes votes. Passing never destroys the
// wall: the old pixels move into a "past walls" gallery, and the live wall
// clears for everyone. Only one vote is ever open per house at a time.
const baseUrl = inject("baseUrl");
const origin = new URL(baseUrl).origin;

interface Resident {
  cookie: string;
  slug: string;
  name: string;
}

async function join(prefix: string): Promise<Resident> {
  const name = uniqueName(prefix);
  const cookie = await signup(baseUrl, name);
  return { cookie, slug: await createHouse(baseUrl, cookie), name };
}

async function moveIn(host: Resident, prefix: string): Promise<Resident> {
  const name = uniqueName(prefix);
  const cookie = await signup(baseUrl, name);
  const code = await inviteCodeOf(baseUrl, host.cookie, host.slug);
  expect((await formPost(baseUrl, "/api/houses/join", { code }, cookie)).status).toBe(303);
  return { cookie, slug: host.slug, name };
}

function castVote(resident: Resident, choice: "yes" | "no"): Promise<Response> {
  return fetch(new URL(inHouse("/api/wall/vote", resident.slug), baseUrl), {
    method: "POST",
    headers: { cookie: resident.cookie, origin },
    body: new URLSearchParams({ choice }),
  });
}

function paint({ cookie, slug }: Resident, x: number, y: number, color = 5): Promise<Response> {
  return fetch(new URL(inHouse("/api/canvas/pixel", slug), baseUrl), {
    method: "POST",
    headers: { cookie, origin },
    body: new URLSearchParams({ x: String(x), y: String(y), color: String(color) }),
  });
}

const page = (viewer: Resident) =>
  fetch(new URL(`/h/${encodeURIComponent(viewer.slug)}`, baseUrl), { headers: { cookie: viewer.cookie } }).then((r) =>
    r.text(),
  );

const gallery = (viewer: Resident) =>
  fetch(new URL(`/h/${encodeURIComponent(viewer.slug)}/walls`, baseUrl), { headers: { cookie: viewer.cookie } }).then(
    (r) => r.text(),
  );

it("more than half the house voting yes passes the wall vote immediately", async () => {
  const host = await join("wv-quick-host");
  const friend = await moveIn(host, "wv-quick-friend");
  const third = await moveIn(host, "wv-quick-third");

  const v1 = await castVote(host, "yes");
  expect(v1.status).toBe(200);
  const s1 = await v1.json();
  expect(s1.status).toBe("open");
  expect(s1.yes).toBe(1);
  expect(s1.memberCount).toBe(3);

  // 1 of 3 isn't a majority yet
  expect((await page(host)).includes("the wall")).toBe(true);

  const v2 = await castVote(friend, "yes");
  const s2 = await v2.json();
  // 2 of 3 IS strictly more than half: passes immediately
  expect(s2.status).toBe("passed");
  expect(s2.yes).toBe(2);

  // a fresh ballot after it's resolved starts a NEW vote
  const v3 = await castVote(third, "no");
  const s3 = await v3.json();
  expect(s3.status).toBe("open");
  expect(s3.id).not.toBe(s2.id);
});

it("a single-member house passes on its own first yes vote", async () => {
  const solo = await join("wv-solo");
  const res = await castVote(solo, "yes");
  const state = await res.json();
  expect(state.status).toBe("passed");
  expect(state.yes).toBe(1);
  expect(state.memberCount).toBe(1);
});

it("exactly half voting yes does not quick-pass", async () => {
  const host = await join("wv-half-host");
  await moveIn(host, "wv-half-friend"); // just needs the house to have 2 members

  const v1 = await castVote(host, "yes");
  expect((await v1.json()).status).toBe("open");
  // 1 of 2 members is NOT strictly more than half
});

it("changing your vote replaces your ballot, not adds a second one", async () => {
  const host = await join("wv-change-host");
  await moveIn(host, "wv-change-friend"); // a 2nd member, so a solo "yes" can't quick-pass mid-test

  await castVote(host, "yes");
  const after1 = await (await castVote(host, "yes")).json(); // voting yes again: still just 1 yes
  expect(after1.yes).toBe(1);
  expect(after1.no).toBe(0);

  const after2 = await (await castVote(host, "no")).json(); // changed their mind
  expect(after2.yes).toBe(0);
  expect(after2.no).toBe(1);
  expect(after2.status).toBe("open");
});

it("rejects a vote with no choice, and keeps non-members out", async () => {
  const host = await join("wv-reject-host");
  const outsider = await signup(baseUrl, uniqueName("wv-reject-out"));

  const bad = await fetch(new URL(inHouse("/api/wall/vote", host.slug), baseUrl), {
    method: "POST",
    headers: { cookie: host.cookie, origin },
    body: new URLSearchParams({ choice: "maybe" }),
  });
  expect(bad.status).toBe(400);

  const stranger = await fetch(new URL(inHouse("/api/wall/vote", host.slug), baseUrl), {
    method: "POST",
    headers: { cookie: outsider, origin },
    body: new URLSearchParams({ choice: "yes" }),
  });
  expect(stranger.status).toBe(403);

  const loggedOut = await fetch(new URL(inHouse("/api/wall/vote", host.slug), baseUrl), {
    method: "POST",
    headers: { origin },
    body: new URLSearchParams({ choice: "yes" }),
  });
  expect(loggedOut.status).toBe(401);
});

it("a passing vote wipes the live wall but saves it to the past-walls gallery, never touching posts", async () => {
  const host = await join("wv-wipe-host");
  await paint(host, 3, 4, 7);

  // a post stays untouched by any of this
  const body = new FormData();
  body.set("category", "emotional");
  body.set("body", "this post must survive a wall wipe");
  const postRes = await fetch(new URL(inHouse("/api/posts", host.slug), baseUrl), {
    method: "POST",
    headers: { cookie: host.cookie, origin },
    body,
    redirect: "manual",
  });
  expect(postRes.status).toBe(303);

  const beforeWipe = await page(host);
  expect(beforeWipe).toContain('data-x="3" data-y="4"');
  // the painted cell's fill is the colour at palette index 7
  const cellMatch = beforeWipe.match(/<rect x="3" y="4"[^>]*fill="(#[0-9a-f]+)"/);
  expect(cellMatch?.[1]).not.toBe("#ffffff");

  // solo house: one yes passes it immediately
  const v = await castVote(host, "yes");
  expect((await v.json()).status).toBe("passed");

  const afterWipe = await page(host);
  // the post is untouched
  expect(afterWipe).toContain("this post must survive a wall wipe");
  // the cell is back to white (unpainted)
  const cellAfter = afterWipe.match(/<rect x="3" y="4"[^>]*fill="(#[0-9a-f]+)"/);
  expect(cellAfter?.[1]).toBe("#ffffff");

  const galleryHtml = await gallery(host);
  expect(galleryHtml).toContain("wall-card");
  // the saved snapshot shows the painted cell at its old colour
  expect(galleryHtml).toContain(cellMatch![1]);
});

it("doesn't let two votes be open in the same house at once", async () => {
  const host = await join("wv-single-host");
  const friend = await moveIn(host, "wv-single-friend");
  const third = await moveIn(host, "wv-single-third");

  const v1 = await castVote(host, "no");
  const id1 = (await v1.json()).id;
  const v2 = await castVote(friend, "no"); // "starts" another, but finds the same one
  const id2 = (await v2.json()).id;
  expect(id2).toBe(id1);

  const v3 = await castVote(third, "yes");
  const s3 = await v3.json();
  expect(s3.id).toBe(id1);
  expect(s3.yes).toBe(1);
  expect(s3.no).toBe(2);
});

it("a vote in one house doesn't show up or count towards another house's panel", async () => {
  const host = await join("wv-iso-host");
  const other = await join("wv-iso-other");
  await castVote(host, "no"); // opens a vote in host's house only

  // other's own house page still shows its own (empty) panel, unaffected
  const otherPage = await page(other);
  expect(otherPage).toContain('id="wall-vote"');
  expect(otherPage).toContain("no vote to wipe the wall is open right now");
  expect(otherPage).not.toContain('data-status="open"');

  // and host's house page shows its own vote as open
  expect(await page(host)).toContain('data-status="open"');
});

it("an open vote and a wipe reach the house's members live --- and nobody else", async () => {
  const host = await join("wv-live-host");
  const friend = await moveIn(host, "wv-live-friend");
  const outsider = await join("wv-live-outsider");

  const watch = await openStream(baseUrl, friend.cookie, host.slug);
  const elsewhere = await openStream(baseUrl, outsider.cookie, outsider.slug);
  try {
    expect(watch.status).toBe(200);
    await pause(150);

    await castVote(host, "yes");
    expect(
      await watch.waitFor((e) => e.type === "wall_vote_update" && (e.data as { yes: number }).yes === 1, 2000),
      "the friend never saw the first ballot",
    ).toBe(true);

    await castVote(friend, "yes"); // 2 of 2: quick pass
    expect(
      await watch.waitFor((e) => e.type === "wall_wiped", 2000),
      "the friend never saw the wall actually wipe",
    ).toBe(true);
    expect(
      await watch.waitFor(
        (e) => e.type === "wall_vote_update" && (e.data as { status: string }).status === "passed",
        2000,
      ),
    ).toBe(true);

    await pause(200);
    const outsideTypes = elsewhere.events.map((e) => e.type);
    expect(outsideTypes).not.toContain("wall_vote_update");
    expect(outsideTypes).not.toContain("wall_wiped");
  } finally {
    watch.close();
    elsewhere.close();
  }
});

it("a reconnecting stream gets a snapshot of the open vote, not a stale 'no vote' view", async () => {
  const host = await join("wv-snap-host");
  const friend = await moveIn(host, "wv-snap-friend");
  await castVote(host, "yes"); // 1 of 2: stays open

  const stream = await openStream(baseUrl, friend.cookie, host.slug);
  try {
    expect(stream.status).toBe(200);
    const got = await stream.waitFor(
      (e) => e.type === "wall_vote_snapshot" && (e.data as { status: string }).status === "open",
      2000,
    );
    expect(got, "a fresh connection should see the already-open vote").toBe(true);
  } finally {
    stream.close();
  }
});

it("the past-walls gallery lists the most recent wipe first", async () => {
  const host = await join("wv-gallery-host");
  await paint(host, 0, 0, 1);
  expect((await castVote(host, "yes")).status).toBe(200); // passes, wall 1 saved

  await paint(host, 1, 1, 2);
  expect((await castVote(host, "yes")).status).toBe(200); // passes again, wall 2 saved

  const html = await gallery(host);
  const grid = html.slice(html.indexOf('class="walls-grid"'));
  const firstCard = grid.indexOf("wall-card");
  const secondCard = grid.indexOf("wall-card", firstCard + 1);
  expect(firstCard).toBeGreaterThan(-1);
  expect(secondCard).toBeGreaterThan(firstCard);
  // two snapshots total --- matched only within the grid, not the page's own
  // <style> block, which also contains the literal class name once
  expect(grid.match(/class="wall-card-when"/g)?.length).toBe(2);
});
