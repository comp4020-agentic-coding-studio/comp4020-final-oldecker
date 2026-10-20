// Your own drag in and out of the party room. Someone ELSE joining/leaving
// arrives through live.ts instead (same split as the plant and the canvas).
//
// No drag library: Pointer Events (pointerdown/move/up + setPointerCapture)
// are enough, and this is the only drag gesture in the app, matching its
// existing hand-rolled-everything style. setPointerCapture is what unifies
// mouse and touch --- move/up keep firing on the source element even once
// the pointer travels outside its bounds, so one listener set covers both
// input types without extra branching.
import { applyPartyJoin, applyPartyLeave } from "./party-dom";

const dropzoneEl = document.querySelector<HTMLElement>("#party-room-dropzone");
const roomGuestsEl = document.querySelector<HTMLElement>("#party-room-guests");
const youChip = document.querySelector<HTMLElement>("#party-you");
const ownPersonId = youChip?.dataset.personId ?? "";
const ownName = youChip?.dataset.name ?? "";
const ownAvatar = youChip?.dataset.avatar ?? "";

function pointInRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

// direction: "in" drags FROM the strip's own chip TO the room (drop INSIDE
// the zone counts); "out" drags FROM your in-room avatar back out (drop
// OUTSIDE the zone counts) --- same gesture, opposite hit test and
// opposite API route.
function startDrag(sourceEl: HTMLElement, pointerId: number, direction: "in" | "out"): void {
  // Belt-and-braces: if an earlier drag's ghost somehow survived (a bug we
  // don't expect anymore, but also the exact symptom this function used to
  // cause --- see the finish() comment below), don't let it pile up
  // underneath a new one.
  document.querySelectorAll(".party-drag-ghost").forEach((el) => el.remove());

  const ghost = sourceEl.cloneNode(true) as HTMLElement;
  ghost.classList.add("party-drag-ghost");
  ghost.removeAttribute("id");
  document.body.appendChild(ghost);

  const originRect = sourceEl.getBoundingClientRect();
  const offsetX = originRect.width / 2;
  const offsetY = originRect.height / 2;

  const moveGhost = (x: number, y: number) => {
    ghost.style.left = `${x - offsetX}px`;
    ghost.style.top = `${y - offsetY}px`;
  };
  moveGhost(originRect.left + offsetX, originRect.top + offsetY);

  const isOverZone = (x: number, y: number): boolean => {
    const zone = dropzoneEl?.getBoundingClientRect();
    return !!zone && pointInRect(x, y, zone);
  };

  // Cleanup (ghost + listeners) must run no matter what: a party_joined/
  // party_left broadcast arriving mid-drag (someone re-joining from another
  // tab, a timer expiring your own slot, etc. --- see applyPartyJoin/
  // applyPartyLeave in party-dom.ts) can replace sourceEl's node in the DOM
  // out from under this gesture. That alone doesn't throw anything, but it
  // used to matter a lot: this used to listen on sourceEl itself, and a
  // detached element never receives another pointer event again --- not
  // even pointercancel --- so finish() would simply never run and the ghost
  // (plus its listeners) leaked forever, frozen wherever the pointer last
  // was. That's the exact "avatar stuck in the air" bug this function once
  // had. Listening on `document` instead means the gesture is tracked by
  // pointerId regardless of what happens to sourceEl's node, and wrapping
  // the teardown in try/finally means even an unexpected exception here
  // (e.g. from a future change to this function) can't skip it either.
  const finish = async (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    try {
      // sourceEl may already be detached (see above) or may simply never
      // have had capture if the gesture was interrupted before it got the
      // chance --- either way, hasPointerCapture is the correct check
      // rather than trying/catching whatever releasePointerCapture throws.
      if (sourceEl.isConnected && sourceEl.hasPointerCapture(pointerId)) {
        sourceEl.releasePointerCapture(pointerId);
      }
    } finally {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      dropzoneEl?.classList.remove("drag-over");
      ghost.remove();
    }

    // pointercancel carries no meaningful position --- treat it as always a
    // non-drop, the same as any other interrupted gesture.
    const over = e.type === "pointercancel" ? false : isOverZone(e.clientX, e.clientY);
    const dropped = direction === "in" ? over : !over;
    if (!dropped) return;

    try {
      if (direction === "in") {
        const res = await fetch("/api/party/join", { method: "POST" });
        if (!res.ok) throw new Error("join failed");
        const { expiresAt } = (await res.json()) as { expiresAt: number };
        applyPartyJoin({ personId: ownPersonId, name: ownName, avatar: ownAvatar, expiresAt }, ownPersonId);
      } else {
        const res = await fetch("/api/party/leave", { method: "POST" });
        if (!res.ok) throw new Error("leave failed");
        applyPartyLeave(ownPersonId, ownPersonId);
      }
    } catch {
      // Nothing was removed from the DOM optimistically before the request
      // settled, so a failure just needs the ghost gone (already done) ---
      // the real avatar is exactly where it started.
    }
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    moveGhost(e.clientX, e.clientY);
    const over = isOverZone(e.clientX, e.clientY);
    dropzoneEl?.classList.toggle("drag-over", direction === "in" && over);
  };

  sourceEl.setPointerCapture(pointerId);
  // Bound to `document`, not sourceEl --- see the comment in finish() for
  // why: sourceEl can be replaced mid-gesture by a live party update, and a
  // detached element stops receiving pointer events entirely, taking this
  // whole gesture's cleanup down with it. document is never going anywhere.
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", finish);
  document.addEventListener("pointercancel", finish);
}

youChip?.addEventListener("pointerdown", (e) => startDrag(youChip, e.pointerId, "in"));

// Event-delegated on the room container, not one listener per avatar: the
// guest list's elements come and go as people join/leave, and delegation
// means a newly-added avatar is draggable without any extra wiring.
roomGuestsEl?.addEventListener("pointerdown", (e) => {
  const avatarEl = (e.target as HTMLElement).closest<HTMLElement>(".party-room-avatar[data-own]");
  if (!avatarEl) return;
  startDrag(avatarEl, (e as PointerEvent).pointerId, "out");
});
