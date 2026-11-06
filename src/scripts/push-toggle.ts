// The notifications control (src/components/PushToggle.astro). Registers
// /sw.js, then shows one of:
//   on          this device is subscribed (click: turn off)
//   off         not subscribed (click: ask, subscribe)
//   blocked     the browser said no; only its own settings can undo that
//   unsupported no Push API here at all
//   iPhone hint Safari outside a home-screen app has no Push API, but CAN
//               get it once added to the home screen, so say how.
// The permission prompt only ever comes from a click (browsers, and iOS in
// particular, refuse one that isn't a user gesture). Server calls are
// form-encoded like every other mutation here.

const IOS_HINT = "On iPhone: Share → Add to Home Screen, then open from there to turn on notifications.";
const BRAVE_HINT =
  "Brave blocks Google's push delivery by default, so this can say \"on\" but never actually buzz. " +
  "Turn on brave://settings/privacy → \"Use Google services for push messaging\" to fix it.";

function isBrave(): boolean {
  const nav = navigator as Navigator & { brave?: { isBrave: () => Promise<boolean> } };
  return typeof nav.brave?.isBrave === "function";
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function post(path: string, fields: Record<string, string>): Promise<Response> {
  return fetch(path, { method: "POST", body: new URLSearchParams(fields) });
}

async function sendToServer(sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON();
  const res = await post("/api/push/subscribe", {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  });
  return res.ok;
}

async function setup(root: HTMLElement): Promise<void> {
  const button = root.querySelector<HTMLButtonElement>(".push-button");
  const note = root.querySelector<HTMLElement>(".push-note");
  const key = root.dataset.vapidKey ?? "";
  if (!button || !note || !key) return;

  const say = (text: string) => {
    note.textContent = text;
    note.hidden = !text;
  };
  const show = (state: "on" | "off" | "blocked" | "busy") => {
    button.hidden = false;
    button.dataset.state = state;
    button.disabled = state === "blocked" || state === "busy";
    button.textContent =
      state === "on"
        ? "notifications on"
        : state === "blocked"
          ? "notifications blocked"
          : state === "busy"
            ? "…"
            : "turn on notifications";
    button.title =
      state === "on"
        ? "this device buzzes for hearts, knocks and new posts. Click to turn off."
        : state === "blocked"
          ? "your browser is blocking notifications for this site; allow them in its settings"
          : "";
  };

  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) {
    if (isIos() && !isStandalone()) say(IOS_HINT);
    else say("notifications aren't supported in this browser");
    return;
  }

  let reg: ServiceWorkerRegistration;
  try {
    reg = await navigator.serviceWorker.register("/sw.js");
  } catch {
    say("notifications aren't available here");
    return;
  }

  // Brave subscribes fine but drops the actual push silently unless the
  // person has turned Google's delivery channel back on --- there's no
  // error for push.ts to see, so the only thing that can catch this is
  // telling the person up front while they're looking at "on".
  const showOn = () => {
    show("on");
    if (isBrave()) say(BRAVE_HINT);
  };

  const refresh = async () => {
    if (Notification.permission === "denied") return show("blocked");
    const sub = await reg.pushManager.getSubscription();
    // The browser has one, so make sure the server does too (cheap, and
    // repairs a row removed after a 410 or a different login on this device).
    if (sub) {
      await sendToServer(sub).catch(() => {});
      return showOn();
    }
    show("off");
  };

  button.addEventListener("click", async () => {
    const was = button.dataset.state;
    show("busy");
    say("");
    try {
      if (was === "on") {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await post("/api/push/unsubscribe", { endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
        return show("off");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return show(permission === "denied" ? "blocked" : "off");
      const ready = await navigator.serviceWorker.ready;
      const sub = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      if (!(await sendToServer(sub))) {
        await sub.unsubscribe().catch(() => {});
        say("couldn't turn them on just now, try again");
        return show("off");
      }
      showOn();
    } catch {
      say("couldn't change notifications just now, try again");
      await refresh().catch(() => show("off"));
    }
  });

  await refresh().catch(() => show("off"));
}

for (const root of document.querySelectorAll<HTMLElement>(".push-toggle")) void setup(root);
