import { expect, inject, it } from "vitest";
import { createHouse, inHouse, signup, uniqueName } from "./auth-helpers";

// The brief's own test for this week: "a stranger can visit, do the core
// thing, and find their trace still there when they come back." Here: sign
// up, build a house, post in it, then a wholly separate request comes back
// in through the root URL --- which sends a returning person to the house
// they last used --- and the post is still on it. Posting across
// restarts/redeploys is checked manually against a real Docker run (see
// PROCESS.md) --- this checks the same path a browser takes, over HTTP,
// against whatever's running at baseUrl.
const baseUrl = inject("baseUrl");

it("a stranger can post, and the post is still there when they come back", async () => {
  const origin = new URL(baseUrl).origin;
  const marker = `spec-check-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const sessionCookie = await signup(baseUrl, uniqueName("Spec Stranger"));
  const slug = await createHouse(baseUrl, sessionCookie);

  const form = new FormData();
  form.set("category", "emotional");
  form.set("body", marker);

  const createPost = await fetch(new URL(inHouse("/api/posts", slug), baseUrl), {
    method: "POST",
    headers: { origin, cookie: sessionCookie },
    body: form,
    redirect: "manual",
  });
  expect(createPost.status, "posting should redirect back to the house").toBe(303);
  expect(createPost.headers.get("location")).toBe(`/h/${encodeURIComponent(slug)}`);

  // "comes back": a fresh request to the root URL, nothing shared with the
  // ones above but the identity cookie a returning browser would still hold.
  const root = await fetch(new URL("/", baseUrl), { headers: { cookie: sessionCookie }, redirect: "manual" });
  expect(root.headers.get("location"), "/ should send you back to your last house").toBe(
    `/h/${encodeURIComponent(slug)}`,
  );
  const board = await fetch(new URL(root.headers.get("location")!, baseUrl), { headers: { cookie: sessionCookie } });
  expect(board.status).toBe(200);
  const html = await board.text();
  expect(html, "the post isn't on the board after posting it").toContain(marker);
});
