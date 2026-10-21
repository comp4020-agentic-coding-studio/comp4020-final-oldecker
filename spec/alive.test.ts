import { expect, inject, it } from "vitest";
import { signup, uniqueName } from "./auth-helpers";

// The brief's own test for this week: "a stranger can visit, do the core
// thing, and find their trace still there when they come back." Here: sign up,
// post, then a wholly separate request re-fetches the board and the post is
// still on it. Posting across restarts/redeploys is checked manually against
// a real Docker run (see PROCESS.md) --- this checks the same path a browser
// takes, over HTTP, against whatever's running at baseUrl.
const baseUrl = inject("baseUrl");

it("a stranger can post, and the post is still there when they come back", async () => {
  const origin = new URL(baseUrl).origin;
  const marker = `spec-check-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const sessionCookie = await signup(baseUrl, uniqueName("Spec Stranger"));

  const form = new FormData();
  form.set("category", "emotional");
  form.set("body", marker);

  const createPost = await fetch(new URL("/api/posts", baseUrl), {
    method: "POST",
    headers: { origin, cookie: sessionCookie },
    body: form,
    redirect: "manual",
  });
  expect(createPost.status, "posting should redirect back to the board").toBe(303);

  // "comes back": a fresh request, nothing shared with the one above but the
  // identity cookie a returning visitor's browser would still be holding.
  const board = await fetch(new URL("/", baseUrl), { headers: { cookie: sessionCookie } });
  expect(board.status).toBe(200);
  const html = await board.text();
  expect(html, "the post isn't on the board after posting it").toContain(marker);
});
