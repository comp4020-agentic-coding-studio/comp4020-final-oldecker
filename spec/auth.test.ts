import { expect, inject, it } from "vitest";
import { formPost, PASSWORD, sessionCookieOf, signup, uniqueName } from "./auth-helpers";

// The auth contract: real accounts, with sessions the server can revoke and
// nobody can forge. "Logged in" is checked the way the app itself decides it:
// /api/water answers 200 for a known person and 401 for anyone else.
const baseUrl = inject("baseUrl");

async function isLoggedIn(cookie: string): Promise<boolean> {
  const res = await formPost(baseUrl, "/api/water", {}, cookie);
  expect([200, 401], "/api/water should answer 200 (known) or 401 (unknown)").toContain(res.status);
  return res.status === 200;
}

it("signing up logs you in, with an opaque session cookie", async () => {
  const name = uniqueName("Auth Signup");
  const res = await formPost(baseUrl, "/api/signup", {
    name,
    password: PASSWORD,
    confirm: PASSWORD,
    avatar: "yowie",
  });
  expect(res.status).toBe(303);
  const cookie = sessionCookieOf(res);
  expect(cookie, "signup did not set a session cookie").toBeTruthy();
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith("session="))!;
  expect(setCookie.toLowerCase()).toContain("httponly");
  expect(setCookie.toLowerCase()).toContain("samesite=lax");
  expect(await isLoggedIn(cookie!)).toBe(true);
});

it("the board is reachable from the root URL by someone with no account", async () => {
  const res = await fetch(new URL("/", baseUrl));
  const html = await res.text();
  expect(html).toContain('href="/signup"');
  expect(html).toContain('href="/login"');
  expect((await fetch(new URL("/signup", baseUrl))).status).toBe(200);
  expect((await fetch(new URL("/login", baseUrl))).status).toBe(200);
});

it("names are unique ignoring case, with an inline error", async () => {
  const name = uniqueName("Auth Dupe");
  await signup(baseUrl, name);
  const again = await formPost(baseUrl, "/api/signup", {
    name: name.toUpperCase(),
    password: PASSWORD,
    confirm: PASSWORD,
    avatar: "bunyip",
  });
  expect(again.status).toBe(303);
  expect(again.headers.get("location")).toContain("/signup?error=name-taken");
  expect(sessionCookieOf(again)).toBeNull();
});

it("rejects a short password and mismatched confirmation", async () => {
  const short = await formPost(baseUrl, "/api/signup", {
    name: uniqueName("Auth Short"),
    password: "short",
    confirm: "short",
    avatar: "bunyip",
  });
  expect(short.headers.get("location")).toContain("error=password-invalid");
  const mismatch = await formPost(baseUrl, "/api/signup", {
    name: uniqueName("Auth Mismatch"),
    password: PASSWORD,
    confirm: PASSWORD + "x",
    avatar: "bunyip",
  });
  expect(mismatch.headers.get("location")).toContain("error=password-mismatch");
});

it("logging in needs the right password; wrong ones get an inline error and no cookie", async () => {
  const name = uniqueName("Auth Login");
  await signup(baseUrl, name);

  const wrong = await formPost(baseUrl, "/api/login", { name, password: "not the password" });
  expect(wrong.status).toBe(303);
  expect(wrong.headers.get("location")).toContain("/login?error=bad-credentials");
  expect(sessionCookieOf(wrong)).toBeNull();

  const page = await fetch(new URL(wrong.headers.get("location")!, baseUrl));
  expect(await page.text()).toContain("don&#39;t match");

  // a name that doesn't exist looks identical to a wrong password
  const nobody = await formPost(baseUrl, "/api/login", { name: uniqueName("Nobody"), password: PASSWORD });
  expect(nobody.headers.get("location")).toContain("error=bad-credentials");

  // right password, different capitalisation of the name, from "another device"
  const ok = await formPost(baseUrl, "/api/login", { name: name.toLowerCase(), password: PASSWORD });
  expect(ok.status).toBe(303);
  expect(ok.headers.get("location")).toBe("/");
  const cookie = sessionCookieOf(ok);
  expect(cookie).toBeTruthy();
  expect(await isLoggedIn(cookie!)).toBe(true);
});

it("logout ends that session only", async () => {
  const name = uniqueName("Auth Logout");
  const first = await signup(baseUrl, name);
  const second = sessionCookieOf(await formPost(baseUrl, "/api/login", { name, password: PASSWORD }))!;
  expect(second).not.toBe(first);

  const out = await formPost(baseUrl, "/api/logout", {}, first);
  expect(out.status).toBe(303);
  expect(await isLoggedIn(first), "the logged-out session still works").toBe(false);
  expect(await isLoggedIn(second), "logging out one device logged out the other").toBe(true);
});

it("a raw person id as a cookie does not authenticate (the old scheme, and a forged one)", async () => {
  const name = uniqueName("Auth Victim");
  const cookie = await signup(baseUrl, name);

  // the victim's id is public: it's in the party-room markup once they join
  await formPost(baseUrl, "/api/party/join", {}, cookie);
  const html = await (await fetch(new URL("/", baseUrl), { headers: { cookie } })).text();
  const id = html.match(/data-person-id="([0-9a-f-]{36})"/)?.[1];
  expect(id, "expected a person id in the board HTML to try forging with").toBeTruthy();

  for (const forged of [`person_id=${id}`, `session=${id}`]) {
    expect(await isLoggedIn(forged), `${forged.split("=")[0]}=<id> authenticated`).toBe(false);
  }
  expect(await isLoggedIn("session=made-up-token")).toBe(false);
  expect(await isLoggedIn(cookie)).toBe(true);
});
