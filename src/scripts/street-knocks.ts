// The street page, live, for someone waiting at a door: when a member lets
// you in, the waiting lot turns into one of your houses (enterable, a drop
// target, windows and all) without a reload; when they turn you away, the
// lot goes and you're told so. The stream is /api/street-events --- your own
// channel, since a knocker can't hold the house's. Only opened while you're
// actually waiting somewhere; a street with no knocks has nothing to hear.
// (Not imported from party-dom.ts: that module queries the house page's
// DOM at load and pulls in the face renderer, neither of which this needs.)
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

interface MyKnock {
  id: number;
  outcome: string;
  houseSlug: string;
  houseName: string;
}

const news = document.querySelector<HTMLElement>("#knock-news");
const lede = document.querySelector<HTMLElement>(".street-lede");

function waitingLot(id: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.waiting-lot[data-knock-id="${id}"]`);
}

function notice(cls: string, html: string): void {
  if (!news) return;
  // the "you knocked" line is out of date the moment there's an answer
  news.querySelector(".knock-notice.knocked")?.remove();
  const p = document.createElement("p");
  p.className = `knock-notice ${cls}`;
  p.innerHTML = html;
  news.prepend(p);
}

// Copy Astro's scoped-style markers from one element to another, so a
// client-built element picks up the page's scoped CSS like its siblings.
function copyScope(from: Element, to: Element): void {
  for (const attr of from.attributes) {
    if (attr.name.startsWith("data-astro-cid")) to.setAttribute(attr.name, attr.value);
  }
  for (const c of from.classList) if (c.startsWith("astro-")) to.classList.add(c);
}

// Let in: the waiting lot becomes a house lot, built from its own parts
// (the house drawing and the name sign), so it looks exactly like the
// server-rendered ones. You stop standing on the step; you're on the
// pavement again, free to drag yourself in.
function becomeHouse(lot: HTMLElement, k: MyKnock): void {
  const href = `/h/${encodeURIComponent(k.houseSlug)}`;
  const a = document.createElement("a");
  copyScope(lot, a);
  a.classList.add("lot", "house-lot");
  a.href = href;
  a.dataset.href = href;
  a.title = `go into ${k.houseName}`;
  const house = lot.querySelector(".lot-house");
  const sign = lot.querySelector<HTMLElement>(".lot-sign");
  if (house) {
    house.classList.add("just-opened");
    a.append(house);
  }
  if (sign) {
    sign.classList.remove("waiting-sign");
    sign.querySelector(".waiting-cancel")?.remove();
    const status = sign.querySelector<HTMLElement>(".waiting-status");
    if (status) {
      status.classList.remove("waiting-status");
      status.textContent = "you live here now";
    }
    a.append(sign);
  }
  lot.replaceWith(a);
  // with a house on the street, you can be dragged onto it
  document.querySelector<HTMLElement>("#street-you")?.setAttribute("data-draggable", "true");
  if (lede) lede.textContent = "Your houses. Drag yourself onto one to go in, or just tap it.";
}

function markSeen(id: number): void {
  void fetch("/api/houses/knocks/seen", {
    method: "POST",
    body: new URLSearchParams({ knock: String(id) }),
  }).catch(() => {
    // if this fails, the same news is shown once more next visit --- harmless
  });
}

if (document.querySelector(".waiting-lot")) {
  const source = new EventSource("/api/street-events");
  source.addEventListener("my_knock", (e) => {
    const k = JSON.parse((e as MessageEvent).data) as MyKnock;
    const lot = waitingLot(k.id);
    const name = `<strong>${escapeHtml(k.houseName)}</strong>`;
    if (k.outcome === "let_in") {
      if (lot) becomeHouse(lot, k);
      notice(
        "let-in",
        `You were let into ${name}. <a href="/h/${encodeURIComponent(k.houseSlug)}">go in</a>`,
      );
      markSeen(k.id);
    } else if (k.outcome === "turned_away") {
      lot?.remove();
      notice("turned-away", `${name} didn't let you in this time. You can knock again later.`);
      markSeen(k.id);
    } else if (k.outcome === "cancelled") {
      // walked away in another tab
      lot?.remove();
    }
    if (!document.querySelector(".waiting-lot")) {
      source.close();
      // no longer waiting anywhere, and still no house: the lede that said
      // "while you wait" is out of date
      if (lede && !document.querySelector(".house-lot")) {
        lede.textContent = "You don't live anywhere yet. Build a house, or knock on one by its name.";
      }
    }
  });
}
