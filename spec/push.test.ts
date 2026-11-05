import { expect, inject, it } from "vitest";
import { formPost, signup, uniqueName } from "./auth-helpers";

// Phone notifications. The contract the spec can check without real push
// keys (CI and local dev have none, so nothing is ever SENT here): saving
// and removing a device's subscription needs a login, subscribing the same
// device twice is one subscription, only your own device can be removed by
// you, and the two files a phone needs to install the board as an app ---
// the service worker and the manifest --- are served as what they are.
const baseUrl = inject("baseUrl");

const fakeSub = () => ({
  endpoint: `https://push.example.test/${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`,
  p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
  auth: "tBHItJI5svbpez7KI4CCXg",
});

it("subscribing and unsubscribing need a login", async () => {
  const sub = fakeSub();
  expect((await formPost(baseUrl, "/api/push/subscribe", sub)).status).toBe(401);
  expect((await formPost(baseUrl, "/api/push/unsubscribe", { endpoint: sub.endpoint })).status).toBe(401);
});

it("subscribing the same device twice is one subscription; removing it removes it", async () => {
  const cookie = await signup(baseUrl, uniqueName("Push A"));
  const sub = fakeSub();

  const first = await formPost(baseUrl, "/api/push/subscribe", sub, cookie);
  expect(first.status).toBe(200);
  expect(await first.json()).toMatchObject({ ok: true, created: true });

  const again = await formPost(baseUrl, "/api/push/subscribe", sub, cookie);
  expect(again.status).toBe(200);
  expect(await again.json()).toMatchObject({ ok: true, created: false });

  const off = await formPost(baseUrl, "/api/push/unsubscribe", { endpoint: sub.endpoint }, cookie);
  expect(await off.json()).toMatchObject({ ok: true, removed: true });
  // already gone: nothing more to remove
  const offAgain = await formPost(baseUrl, "/api/push/unsubscribe", { endpoint: sub.endpoint }, cookie);
  expect(await offAgain.json()).toMatchObject({ ok: true, removed: false });
});

it("you can't remove someone else's device", async () => {
  const a = await signup(baseUrl, uniqueName("Push Owner"));
  const b = await signup(baseUrl, uniqueName("Push Other"));
  const sub = fakeSub();
  await formPost(baseUrl, "/api/push/subscribe", sub, a);

  const res = await formPost(baseUrl, "/api/push/unsubscribe", { endpoint: sub.endpoint }, b);
  expect(await res.json()).toMatchObject({ removed: false });
  // still A's: A removing it actually removes something
  const own = await formPost(baseUrl, "/api/push/unsubscribe", { endpoint: sub.endpoint }, a);
  expect(await own.json()).toMatchObject({ removed: true });
});

it("refuses something that isn't a push subscription", async () => {
  const cookie = await signup(baseUrl, uniqueName("Push Bad"));
  const bad = { ...fakeSub(), endpoint: "http://not-https.example/x" };
  expect((await formPost(baseUrl, "/api/push/subscribe", bad, cookie)).status).toBe(400);
  expect((await formPost(baseUrl, "/api/push/subscribe", { endpoint: "", p256dh: "", auth: "" }, cookie)).status).toBe(400);
});

it("serves the service worker as JavaScript, with push and click handlers", async () => {
  const res = await fetch(new URL("/sw.js", baseUrl));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type") ?? "").toMatch(/javascript/);
  const body = await res.text();
  expect(body).toContain('addEventListener("push"');
  expect(body).toContain('addEventListener("notificationclick"');
});

it("serves the web app manifest, standalone, with 192 and 512 icons that exist", async () => {
  const res = await fetch(new URL("/manifest.webmanifest", baseUrl));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type") ?? "").toMatch(/application\/manifest\+json|application\/json/);
  const manifest = (await res.json()) as { name: string; display: string; icons: { src: string; sizes: string }[] };
  expect(manifest.name).toBeTruthy();
  expect(manifest.display).toBe("standalone");
  for (const size of ["192x192", "512x512"]) {
    const icon = manifest.icons.find((i) => i.sizes === size);
    expect(icon, size).toBeDefined();
    const img = await fetch(new URL(icon!.src, baseUrl));
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toBe("image/png");
  }
});

it("every page links the manifest (the landing page, logged out)", async () => {
  const html = await (await fetch(baseUrl)).text();
  expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
});
