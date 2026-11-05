// Phone notifications (Web Push), for three events only: a heart sent to
// you, a knock at a house you live in, and a new post in a house you live in.
// Event-driven on purpose --- no timers, no "you haven't visited in a while":
// fly.toml scales the one machine to zero between visits, so there is no
// process awake to run a scheduler, and a nudge nobody asked for is the
// opposite of what a 15-person board is for. Full reasoning in PROCESS.md's
// "Phone notifications" section.
//
// Rules this file holds to:
//  - no VAPID keys in the environment means the whole feature is OFF: no
//    sending, and pushPublicKey() is null so the page hides the opt-in. Local
//    dev, CI and the spec all run like that.
//  - someone with the house open right now (events.ts presence) is NOT
//    pushed --- the page already shows them the thing live.
//  - new-post pushes are rate-limited per (recipient, house): at most one
//    every POST_PUSH_COOLDOWN_MS, so a burst of five posts is one buzz.
//  - sending never blocks or fails the request that caused it: every send
//    is fire-and-forget, and every error ends at console.error.
//  - a 404/410 from the push service means that device's subscription is
//    gone for good, so its row is deleted. That's delivery plumbing, never
//    content: nothing here ever touches posts, photos or anything else.
import { and, eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "./db";
import { isPresent } from "./events";
import type { House } from "./houses";
import { membersOf } from "./houses";
import type { Person } from "./identity";
import { pushSubscriptions } from "./schema";

export const POST_PUSH_COOLDOWN_MS = 30 * 60 * 1000;

let configured: boolean | null = null;

// Read the env once, lazily (so a test or a build never needs the keys).
function enabled(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  if (!publicKey || !privateKey) return (configured = false);
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (err) {
    // A malformed key shouldn't take the app down --- just leave push off.
    console.error("[push] VAPID keys present but invalid; notifications stay off:", err);
    configured = false;
  }
  return configured;
}

// The key the browser needs to subscribe, or null when push is off (the
// page renders no opt-in control at all then).
export function pushPublicKey(): string | null {
  return enabled() ? (process.env.VAPID_PUBLIC_KEY ?? null) : null;
}

export interface SubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// A push endpoint is the push service's https URL for one device. Anything
// else is refused rather than stored and later POSTed to.
export function validSubscription(s: SubscriptionInput): boolean {
  if (!s.endpoint || s.endpoint.length > 1000 || !s.p256dh || !s.auth) return false;
  if (s.p256dh.length > 200 || s.auth.length > 100) return false;
  try {
    return new URL(s.endpoint).protocol === "https:";
  } catch {
    return false;
  }
}

// Subscribing the same device again is the same row (endpoint is unique):
// keys refreshed, and it moves to whoever is logged in on that device now.
// Returns whether this made a NEW row, so the route can say so.
export function saveSubscription(personId: string, s: SubscriptionInput): { created: boolean } {
  const existing = db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, s.endpoint))
    .get();
  db.insert(pushSubscriptions)
    .values({ personId, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { personId, p256dh: s.p256dh, auth: s.auth },
    })
    .run();
  return { created: !existing };
}

// Only ever your own device's row: someone else's endpoint is a no-op.
export function removeSubscription(personId: string, endpoint: string): boolean {
  const res = db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.personId, personId)))
    .run();
  return res.changes > 0;
}

export interface PushPayload {
  title: string;
  body: string;
  // where tapping the notification takes you (a same-origin path)
  url: string;
  // same tag replaces an older notification instead of stacking another
  tag: string;
}

async function sendToDevices(personId: string, payload: PushPayload): Promise<void> {
  const subs = db.select().from(pushSubscriptions).where(eq(pushSubscriptions.personId, personId)).all();
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          // a knock or a heart that's a day old isn't worth a buzz anymore
          { TTL: 12 * 60 * 60 },
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)).run();
          console.log(`[push] subscription ${sub.id} gone (${status}); removed`);
        } else {
          console.error(`[push] send to subscription ${sub.id} failed:`, status ?? err);
        }
      }
    }),
  );
}

// Fire-and-forget: whatever happens in here, the caller has already got its
// response on the way. Synchronous DB reads are inside the try too.
function dispatch(what: string, recipients: () => { personId: string; payload: PushPayload }[]): void {
  if (!enabled()) return;
  try {
    for (const { personId, payload } of recipients()) {
      sendToDevices(personId, payload).catch((err) => console.error(`[push] ${what} failed:`, err));
    }
  } catch (err) {
    console.error(`[push] ${what} failed:`, err);
  }
}

const houseUrl = (house: House) => `/h/${encodeURIComponent(house.slug)}`;

// A heart that didn't arrive live (the recipient doesn't have the house open).
export function pushLieb(house: House, from: Person, toPersonId: string): void {
  dispatch("lieb", () =>
    isPresent(house.id, toPersonId)
      ? []
      : [
          {
            personId: toPersonId,
            payload: {
              title: "ich hab dich lieb",
              body: `${from.name} sent you a heart in ${house.name}`,
              url: houseUrl(house),
              tag: `lieb-${house.slug}`,
            },
          },
        ],
  );
}

// Someone's at the door: every member who isn't already looking at it.
export function pushKnock(house: House, knockerName: string): void {
  dispatch("knock", () =>
    membersOf(house.id)
      .filter((m) => !isPresent(house.id, m.personId))
      .map((m) => ({
        personId: m.personId,
        payload: {
          title: house.name,
          body: `${knockerName} is knocking on the door`,
          url: houseUrl(house),
          tag: `knock-${house.slug}`,
        },
      })),
  );
}

// "houseId:personId" -> when they were last pushed about a post there. In
// memory, like ratelimit.ts: one machine, and forgetting it on a restart
// costs at most one extra buzz per person.
const lastPostPush = new Map<string, number>();

export function pushNewPost(house: House, author: Person, now = Date.now()): void {
  dispatch("post", () => {
    const out: { personId: string; payload: PushPayload }[] = [];
    for (const m of membersOf(house.id)) {
      if (m.personId === author.id || isPresent(house.id, m.personId)) continue;
      const key = `${house.id}:${m.personId}`;
      const last = lastPostPush.get(key);
      if (last !== undefined && now - last < POST_PUSH_COOLDOWN_MS) continue;
      lastPostPush.set(key, now);
      out.push({
        personId: m.personId,
        payload: {
          title: house.name,
          body: `${author.name} posted in ${house.name}`,
          url: houseUrl(house),
          tag: `post-${house.slug}`,
        },
      });
    }
    return out;
  });
}
